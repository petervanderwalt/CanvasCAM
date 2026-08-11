import { CLIPPER_SCALE } from "./constants.js?v=20260730-vcarve8";
import {
  closePoints,
  polygonArea,
  clonePoint,
  pointAtDistance,
  polylineLength,
  boundsOfPoints,
  dist,
} from "./paths.js?v=20260730-vcarve8";
import {
  ensureVCarveReady,
  getVCarveLoadError,
  generateVCarveToolpaths,
  isVCarveReady,
  mmPointsToClipperPath,
} from "./vcarve.js?v=20260730-vcarve8";

export function clipperPathFromPoints(points) {
  const path = points.slice(0, -1).map((point) => ({
    X: Math.round(point.x * CLIPPER_SCALE),
    Y: Math.round(point.y * CLIPPER_SCALE),
  }));
  return ClipperLib.JS.Clean(path, 2);
}

export function pointsFromClipperPath(path) {
  const points = path.map((point) => ({
    x: point.X / CLIPPER_SCALE,
    y: point.Y / CLIPPER_SCALE,
  }));
  return closePoints(points);
}

export function ensurePositiveOrientation(points) {
  return polygonArea(points) < 0 ? closePoints(points.slice(0, -1).reverse()) : points;
}

export function ensureNegativeOrientation(points) {
  return polygonArea(points) > 0 ? closePoints(points.slice(0, -1).reverse()) : points;
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonCentroid(points) {
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const cross = a.x * b.y - b.x * a.y;
    signedArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }

  if (Math.abs(signedArea) < 1e-9) {
    return clonePoint(points[0]);
  }

  const scale = 1 / (3 * signedArea);
  return {
    x: cx * scale,
    y: cy * scale,
  };
}

export function compositePocketSeedPaths(selectedLoops) {
  const records = selectedLoops.map((loop) => ({
    loop,
    points: closePoints(loop.points),
    area: Math.abs(polygonArea(loop.points)),
  }));

  records.sort((a, b) => b.area - a.area);

  for (const record of records) {
    const sample = polygonCentroid(record.points);
    record.depth = records.reduce((depth, candidate) => {
      if (candidate === record || candidate.area <= record.area) {
        return depth;
      }
      return pointInPolygon(sample, candidate.points) ? depth + 1 : depth;
    }, 0);
  }

  const orientedPaths = records.map((record) => (
    record.depth % 2 === 0
      ? ensurePositiveOrientation(record.points)
      : ensureNegativeOrientation(record.points)
  ));

  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(
    orientedPaths.map((points) => clipperPathFromPoints(points)),
    ClipperLib.PolyType.ptSubject,
    true
  );

  const solution = new ClipperLib.Paths();
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return solution
    .map(pointsFromClipperPath)
    .filter((points) => Math.abs(polygonArea(points)) > 1);
}

export function offsetCompositePolygons(paths, delta) {
  if (!paths.length) {
    return [];
  }
  const offsetter = new ClipperLib.ClipperOffset(2, 0.25 * CLIPPER_SCALE);
  offsetter.AddPaths(
    paths.map((points) => clipperPathFromPoints(points)),
    ClipperLib.JoinType.jtRound,
    ClipperLib.EndType.etClosedPolygon
  );
  const solution = new ClipperLib.Paths();
  offsetter.Execute(solution, delta * CLIPPER_SCALE);
  return solution
    .map(pointsFromClipperPath)
    .filter((points) => Math.abs(polygonArea(points)) > 1);
}

export function booleanPolygons(selectedLoops, operation = "union") {
  const records = selectedLoops
    .filter((loop) => loop?.closed !== false && loop?.points?.length >= 4)
    .map((loop) => ({
      points: closePoints(loop.points),
      area: Math.abs(polygonArea(loop.points)),
    }))
    .filter((record) => record.area > 1e-6);

  if (records.length < 2) {
    return [];
  }

  // Boolean inputs represent selected filled vectors. Do not infer holes from
  // centroid nesting: overlapping shapes can have their centroid inside a peer.
  const paths = records.map((record) => clipperPathFromPoints(
    ensurePositiveOrientation(record.points)
  ));
  const fill = ClipperLib.PolyFillType.pftNonZero;
  const execute = (clipType, subject, clip = []) => {
    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
    if (clip.length) {
      clipper.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
    }
    const solution = new ClipperLib.Paths();
    clipper.Execute(clipType, solution, fill, fill);
    return solution;
  };

  let solution;
  if (operation === "difference") {
    solution = execute(ClipperLib.ClipType.ctDifference, [paths[0]], paths.slice(1));
  } else if (operation === "intersection") {
    solution = [paths[0]];
    for (const path of paths.slice(1)) {
      solution = execute(ClipperLib.ClipType.ctIntersection, solution, [path]);
      if (!solution.length) {
        break;
      }
    }
  } else if (operation === "xor") {
    solution = execute(ClipperLib.ClipType.ctXor, paths);
  } else {
    solution = execute(ClipperLib.ClipType.ctUnion, paths);
  }

  return solution
    .map(pointsFromClipperPath)
    .filter((points) => Math.abs(polygonArea(points)) > 1e-6);
}

export function createToolpathFromLoops(selectedLoops, config, options = {}) {
  if (config.operation === "vcarve") {
    throw new Error("V-Carve toolpaths must be built asynchronously.");
  }
  return createToolpathSkeleton(selectedLoops, config, options);
}

export async function createToolpathFromLoopsAsync(selectedLoops, config, options = {}) {
  const toolpath = createToolpathSkeleton(selectedLoops, config, options);

  if (config.operation !== "vcarve") {
    return toolpath;
  }

  const compositeSelection = compositePocketSeedPaths(selectedLoops);
  const vCarvePassDepth = Math.max(0.01, config.cutDepth);
  const motionPaths = await generateVCarveToolpaths(
    compositeSelection.map(mmPointsToClipperPath),
    {
      cutterAngle: config.cutterAngle,
      passDepth: vCarvePassDepth,
      maxDepth: config.cutDepth,
      onProgress: options.onProgress,
    }
  );

  toolpath.motionPaths = motionPaths;
  toolpath.previewContours = motionPaths
    .map((path) => path.points.map(({ x, y }) => ({ x, y })))
    .filter((points) => points.length >= 2);

  return toolpath;
}

function createToolpathSkeleton(selectedLoops, config, options = {}) {
  const reportProgress = options.onProgress || (() => {});
  const previewContours = [];
  const sourceLoops = [];
  reportProgress(10, "Preparing geometry");
  const compositeSelection = compositePocketSeedPaths(selectedLoops);
  reportProgress(32, "Unioning vectors");

  for (const loop of selectedLoops) {
    if (config.operation === "engrave" || config.operation === "chamfer") {
      previewContours.push(loop.points.map(clonePoint));
    }
    sourceLoops.push(loop);
  }

  if (config.operation === "profile-outside") {
    previewContours.push(...offsetCompositePolygons(compositeSelection, config.toolRadius));
    reportProgress(78, "Offsetting outside profile");
  } else if (config.operation === "profile-inside") {
    previewContours.push(...offsetCompositePolygons(compositeSelection, -config.toolRadius));
    reportProgress(78, "Offsetting inside profile");
  }

  if (config.operation === "pocket") {
    const stepOver = config.toolDiameter * (1 - config.overlapPercent / 100);
    const first = offsetCompositePolygons(compositeSelection, -config.toolRadius);
    previewContours.push(...first);
    let current = first;
    let iteration = 0;
    while (current.length) {
      iteration += 1;
      reportProgress(Math.min(84, 40 + iteration * 8), "Calculating pocket passes");
      const next = offsetCompositePolygons(current, -stepOver);
      if (!next.length) {
        break;
      }
      previewContours.push(...next);
      current = next;
    }
  }

  const cutDepth = Math.max(0.01, config.cutDepth);
  const passDepth = Math.max(0.01, config.passDepth);
  const passDepths = [];
  let currentDepth = passDepth;
  while (currentDepth < cutDepth) {
    passDepths.push(-Number(currentDepth.toFixed(4)));
    currentDepth += passDepth;
  }
  passDepths.push(-Number(cutDepth.toFixed(4)));

  const operationLabel = {
    "profile-outside": "Profile Outside",
    "profile-inside": "Profile Inside",
    engrave: "Engrave",
    chamfer: "Chamfer",
    pocket: "Pocket",
    vcarve: "V-Carve",
  }[config.operation];

  const label = options.label || `${operationLabel} (${selectedLoops.length} vector${selectedLoops.length === 1 ? "" : "s"})`;
  const chamferWidth = config.operation === "chamfer" && Number.isFinite(config.cutterAngle)
    ? 2 * cutDepth * Math.tan((config.cutterAngle * Math.PI) / 360)
    : null;
  const cardMeta = config.operation === "vcarve"
    ? `${operationLabel} - T${config.toolNumber} - ${formatNumber(config.cutterAngle)}deg - ${formatNumber(cutDepth)}mm max depth - single pass`
    : config.operation === "chamfer"
      ? `${operationLabel} - T${config.toolNumber} - ${formatNumber(config.cutterAngle)}deg - ${formatNumber(cutDepth)}mm deep - ${passDepth.toFixed(2)}mm/pass - ${passDepths.length} passes${Number.isFinite(chamferWidth) ? ` - ${formatNumber(chamferWidth)}mm top width` : ""}`
      : `${operationLabel} - T${config.toolNumber} - ${config.toolDiameter.toFixed(1)}mm - ${cutDepth.toFixed(2)}mm deep - ${passDepth.toFixed(2)}mm/pass - ${passDepths.length} passes`;

  reportProgress(96, "Finalizing toolpath");

  return {
    id: options.id || crypto.randomUUID(),
    label,
    operation: config.operation,
    operationLabel,
    cardMeta,
    toolDiameter: config.toolDiameter,
    toolRadius: config.toolRadius,
    cutterAngle: config.cutterAngle,
    overlapPercent: config.overlapPercent,
    cutDepth,
    passDepth,
    passDepths,
    tabWidth: config.tabWidth,
    tabHeight: config.tabHeight,
    safeZ: config.safeZ,
    feedRate: config.feedRate,
    plungeRate: config.plungeRate,
    spindle: config.spindle,
    toolNumber: config.toolNumber,
    libraryToolId: config.libraryToolId || null,
    libraryToolName: config.libraryToolName || "",
    libraryToolVendor: config.libraryToolVendor || "",
    libraryToolImage: config.libraryToolImage || "",
    libraryToolUrl: config.libraryToolUrl || "",
    libraryToolDescription: config.libraryToolDescription || "",
    previewContours,
    motionPaths: [],
    sourceLoops,
    tabs: [],
  };
}

export function nearestPointOnPolyline(points, target) {
  let best = null;
  let accumulated = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSq = abx * abx + aby * aby;
    if (lengthSq === 0) {
      continue;
    }
    const t = Math.max(0, Math.min(1, ((target.x - a.x) * abx + (target.y - a.y) * aby) / lengthSq));
    const point = { x: a.x + abx * t, y: a.y + aby * t };
    const distance = dist(point, target);
    const segmentLength = Math.sqrt(lengthSq);
    if (!best || distance < best.distance) {
      best = {
        point,
        distance,
        along: accumulated + segmentLength * t,
      };
    }
    accumulated += segmentLength;
  }
  return best;
}

export function buildTabMarker(contour, alongDistance, width, transform) {
  const half = width / 2;
  const total = polylineLength(contour);
  const startDistance = Math.max(0, alongDistance - half);
  const endDistance = Math.min(total, alongDistance + half);
  const aPoint = pointAtDistance(contour, startDistance);
  const bPoint = pointAtDistance(contour, endDistance);
  const centerPoint = pointAtDistance(contour, alongDistance);
  const spine = slicePolyline(contour, startDistance, endDistance);
  return {
    a: transform(aPoint),
    b: transform(bPoint),
    center: transform(centerPoint),
    spine: spine.map(transform),
    worldA: aPoint,
    worldB: bPoint,
    worldCenter: centerPoint,
    worldSpine: spine,
  };
}

export function getMinimumTabWidth(toolDiameter) {
  return toolDiameter * 1.5;
}

export function getTabCenterlineSpan(tabWidth, toolDiameter) {
  return tabWidth + toolDiameter;
}

export function operationUsesTabs(toolpath) {
  return toolpath.operation === "profile-outside" || toolpath.operation === "profile-inside";
}

export function usesVCarve(operation) {
  return operation === "vcarve";
}

export function isVCarveEngineReady() {
  return isVCarveReady();
}

export function ensureVCarveEngineReady() {
  return ensureVCarveReady();
}

export function getVCarveEngineLoadError() {
  return getVCarveLoadError();
}

export function tabTopDepth(toolpath) {
  return -Math.max(0, toolpath.cutDepth - toolpath.tabHeight);
}

export function buildGcode({ toolpaths, fileName, forcePolylineArcs, onProgress = () => {} }) {
  const lines = [
    "(CAM Canvas GRBL output)",
    `(${fileName || "untitled.dxf"})`,
    "G21",
    "G90",
    "G17",
  ];

  const totalSteps = Math.max(1, toolpaths.reduce((count, toolpath) => {
    if (toolpath.operation === "vcarve") {
      return count + Math.max(1, (toolpath.motionPaths || []).length);
    }
    return count + Math.max(1, toolpath.passDepths.length * Math.max(1, toolpath.previewContours.length));
  }, 0));
  let completedSteps = 0;
  let currentToolNumber = null;
  let spindleRunning = false;
  let currentSpindle = null;
  const reportProgress = (label) => {
    completedSteps += 1;
    onProgress(Math.min(99, Math.round((completedSteps / totalSteps) * 100)), label);
  };

  for (const toolpath of toolpaths) {
    const safeZ = toolpath.safeZ;
    const feed = toolpath.feedRate;
    const plunge = toolpath.plungeRate;
    const spindle = toolpath.spindle;
    const toolNumber = Number.isFinite(toolpath.toolNumber) ? Math.max(1, Math.round(toolpath.toolNumber)) : null;
    lines.push(`(${toolpath.operationLabel} - ${toolpath.label})`);
    const requiresToolChange = toolNumber && toolNumber !== currentToolNumber;
    if (requiresToolChange) {
      lines.push(`G0 Z${formatNumber(safeZ)}`);
      if (spindleRunning) {
        lines.push("M5");
        spindleRunning = false;
      }
      lines.push(`(${buildToolChangeComment(toolpath, toolNumber)})`);
      lines.push(`T${toolNumber}`);
      lines.push("M6");
      currentToolNumber = toolNumber;
    }

    if (toolpath.operation === "vcarve") {
      emitVCarveMoves(lines, toolpath, feed, plunge, safeZ, {
        spindle,
        spindleState: {
          running: spindleRunning,
          speed: currentSpindle,
        },
      });
      spindleRunning = true;
      currentSpindle = spindle;
      reportProgress(`Writing ${toolpath.operationLabel}`);
      lines.push(`G0 Z${formatNumber(safeZ)}`);
      continue;
    }

    let startedThisToolpath = false;
    for (const depth of toolpath.passDepths) {
      for (let contourIndex = 0; contourIndex < toolpath.previewContours.length; contourIndex += 1) {
        const contour = toolpath.previewContours[contourIndex];
        if (!contour.length) {
          continue;
        }

        const start = contour[0];
        lines.push(`G0 Z${formatNumber(safeZ)}`);
        lines.push(`G0 X${formatNumber(start.x)} Y${formatNumber(start.y)}`);
        if (!startedThisToolpath || !spindleRunning || currentSpindle !== spindle) {
          lines.push(`M3 S${Math.round(spindle)}`);
          spindleRunning = true;
          currentSpindle = spindle;
          startedThisToolpath = true;
        }

        const tabsForContour = operationUsesTabs(toolpath)
          ? toolpath.tabs.filter((tab) => tab.contourIndex === contourIndex).sort((a, b) => a.along - b.along)
          : [];

        const fixedTabDepth = tabTopDepth(toolpath);
        const passUsesTabs = tabsForContour.length > 0 && depth < fixedTabDepth;

        if (!passUsesTabs) {
          lines.push(`G1 Z${formatNumber(depth)} F${formatNumber(plunge)}`);
          emitContourMoves(lines, contour, depth, feed, plunge, forcePolylineArcs);
          reportProgress(`Writing ${toolpath.operationLabel}`);
          continue;
        }

        const total = polylineLength(contour);
        const segments = [];
        let cursor = 0;
        for (const tab of tabsForContour) {
          const tabWidth = Math.max(toolpath.tabWidth, getMinimumTabWidth(toolpath.toolDiameter));
          const tabSpan = getTabCenterlineSpan(tabWidth, toolpath.toolDiameter);
          const tabStart = Math.max(0, tab.along - tabSpan / 2);
          const tabEnd = Math.min(total, tab.along + tabSpan / 2);
          if (tabStart > cursor) {
            segments.push({ from: cursor, to: tabStart, depth });
          }
          segments.push({ from: tabStart, to: tabEnd, depth: fixedTabDepth });
          cursor = tabEnd;
        }
        if (cursor < total) {
          segments.push({ from: cursor, to: total, depth });
        }

        let firstSegment = true;
        for (const segment of segments) {
          const segmentStart = pointAtDistance(contour, segment.from);
          if (firstSegment) {
            lines.push(`G1 Z${formatNumber(segment.depth)} F${formatNumber(plunge)}`);
            firstSegment = false;
          } else {
            lines.push(`G1 X${formatNumber(segmentStart.x)} Y${formatNumber(segmentStart.y)} F${formatNumber(feed)}`);
            lines.push(`G1 Z${formatNumber(segment.depth)} F${formatNumber(plunge)}`);
          }
          const segmentPoints = slicePolyline(contour, segment.from, segment.to);
          emitContourMoves(lines, segmentPoints, segment.depth, feed, plunge, forcePolylineArcs);
        }
        reportProgress(`Writing ${toolpath.operationLabel}`);
      }
    }
    lines.push(`G0 Z${formatNumber(safeZ)}`);
  }

  if (spindleRunning) {
    lines.push("M5");
  }
  lines.push("M30");
  return lines.join("\n");
}

function buildToolChangeComment(toolpath, toolNumber) {
  const parts = [`Change to tool T${toolNumber}`];
  const namedTool = (toolpath.libraryToolName || "").trim();
  if (namedTool) {
    parts.push(namedTool);
  } else if ((toolpath.operation === "vcarve" || toolpath.operation === "chamfer") && Number.isFinite(toolpath.cutterAngle)) {
    parts.push(`${formatNumber(toolpath.cutterAngle)}deg V-bit`);
  } else if (Number.isFinite(toolpath.toolDiameter)) {
    parts.push(`${formatNumber(toolpath.toolDiameter)}mm tool`);
  }
  return parts.join(" - ");
}

function emitVCarveMoves(lines, toolpath, feed, plunge, safeZ, options = {}) {
  const spindle = options.spindle;
  const spindleState = options.spindleState || { running: false, speed: null };
  let started = false;
  for (const path of toolpath.motionPaths || []) {
    if (!path.points?.length) {
      continue;
    }
    const [start, ...rest] = path.points;
    lines.push(`G0 Z${formatNumber(safeZ)}`);
    lines.push(`G0 X${formatNumber(start.x)} Y${formatNumber(start.y)}`);
    if (!started || !spindleState.running || spindleState.speed !== spindle) {
      lines.push(`M3 S${Math.round(spindle)}`);
      spindleState.running = true;
      spindleState.speed = spindle;
      started = true;
    }
    lines.push(`G1 Z${formatNumber(start.z)} F${formatNumber(plunge)}`);

    let previous = start;
    for (const point of rest) {
      const sameXY = Math.abs(point.x - previous.x) < 0.0001 && Math.abs(point.y - previous.y) < 0.0001;
      if (sameXY) {
        const rate = point.z < previous.z ? plunge : feed;
        lines.push(`G1 Z${formatNumber(point.z)} F${formatNumber(rate)}`);
      } else {
        lines.push(`G1 X${formatNumber(point.x)} Y${formatNumber(point.y)} Z${formatNumber(point.z)} F${formatNumber(feed)}`);
      }
      previous = point;
    }
  }
}

function emitContourMoves(lines, contour, depth, feed, plunge, forcePolylineArcs) {
  if (contour.length < 2) {
    return;
  }
  if (!forcePolylineArcs && tryEmitCircleArcs(lines, contour, depth, feed, plunge)) {
    return;
  }
  for (let i = 1; i < contour.length; i += 1) {
    const point = contour[i];
    lines.push(`G1 X${formatNumber(point.x)} Y${formatNumber(point.y)} F${formatNumber(feed)}`);
  }
}

function tryEmitCircleArcs(lines, contour, depth, feed, plunge) {
  if (contour.length < 16) {
    return false;
  }
  const bounds = boundsOfPoints(contour);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const radius = dist(contour[0], { x: cx, y: cy });
  const maxError = contour.reduce((error, point) => Math.max(error, Math.abs(dist(point, { x: cx, y: cy }) - radius)), 0);
  if (maxError > 0.05) {
    return false;
  }
  const start = contour[0];
  const half = pointAtDistance(contour, polylineLength(contour) / 2);
  lines.push(`G1 Z${formatNumber(depth)} F${formatNumber(plunge)}`);
  lines.push(`G2 X${formatNumber(half.x)} Y${formatNumber(half.y)} I${formatNumber(cx - start.x)} J${formatNumber(cy - start.y)} F${formatNumber(feed)}`);
  lines.push(`G2 X${formatNumber(start.x)} Y${formatNumber(start.y)} I${formatNumber(cx - half.x)} J${formatNumber(cy - half.y)} F${formatNumber(feed)}`);
  return true;
}

function slicePolyline(points, fromDistance, toDistance) {
  const sliced = [pointAtDistance(points, fromDistance)];
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segmentLength = dist(a, b);
    const nextWalk = walked + segmentLength;
    if (nextWalk > fromDistance && nextWalk < toDistance) {
      sliced.push(clonePoint(b));
    }
    walked = nextWalk;
  }
  sliced.push(pointAtDistance(points, toDistance));
  return sliced;
}

export function formatNumber(value) {
  return Number(value).toFixed(4).replace(/\.?0+$/, "");
}
