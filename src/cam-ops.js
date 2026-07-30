import { CLIPPER_SCALE } from "./constants.js";
import {
  closePoints,
  polygonArea,
  clonePoint,
  pointAtDistance,
  polylineLength,
  boundsOfPoints,
  dist,
} from "./paths.js";

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

export function createToolpathFromLoops(selectedLoops, config, options = {}) {
  const previewContours = [];
  const sourceLoops = [];
  const compositeSelection = compositePocketSeedPaths(selectedLoops);

  for (const loop of selectedLoops) {
    if (config.operation === "engrave") {
      previewContours.push(loop.points.map(clonePoint));
    }
    sourceLoops.push(loop);
  }

  if (config.operation === "profile-outside") {
    previewContours.push(...offsetCompositePolygons(compositeSelection, config.toolRadius));
  } else if (config.operation === "profile-inside") {
    previewContours.push(...offsetCompositePolygons(compositeSelection, -config.toolRadius));
  }

  if (config.operation === "pocket") {
    const stepOver = config.toolDiameter * (1 - config.overlapPercent / 100);
    const first = offsetCompositePolygons(compositeSelection, -config.toolRadius);
    previewContours.push(...first);
    let current = first;
    while (current.length) {
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
    pocket: "Pocket",
  }[config.operation];

  const label = options.label || `${operationLabel} (${selectedLoops.length} vector${selectedLoops.length === 1 ? "" : "s"})`;

  return {
    id: options.id || crypto.randomUUID(),
    label,
    operation: config.operation,
    operationLabel,
    toolDiameter: config.toolDiameter,
    toolRadius: config.toolRadius,
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
    previewContours,
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

export function tabTopDepth(toolpath) {
  return -Math.max(0, toolpath.cutDepth - toolpath.tabHeight);
}

export function buildGcode({ toolpaths, fileName, forcePolylineArcs }) {
  const lines = [
    "(CAM Canvas GRBL output)",
    `(${fileName || "untitled.dxf"})`,
    "G21",
    "G90",
    "G17",
  ];

  for (const toolpath of toolpaths) {
    const safeZ = toolpath.safeZ;
    const feed = toolpath.feedRate;
    const plunge = toolpath.plungeRate;
    const spindle = toolpath.spindle;
    lines.push(`(${toolpath.operationLabel} - ${toolpath.label})`);
    lines.push(`G0 Z${formatNumber(safeZ)}`);
    lines.push(`M3 S${Math.round(spindle)}`);
    for (const depth of toolpath.passDepths) {
      for (let contourIndex = 0; contourIndex < toolpath.previewContours.length; contourIndex += 1) {
        const contour = toolpath.previewContours[contourIndex];
        if (!contour.length) {
          continue;
        }

        const start = contour[0];
        lines.push(`G0 Z${formatNumber(safeZ)}`);
        lines.push(`G0 X${formatNumber(start.x)} Y${formatNumber(start.y)}`);

        const tabsForContour = operationUsesTabs(toolpath)
          ? toolpath.tabs.filter((tab) => tab.contourIndex === contourIndex).sort((a, b) => a.along - b.along)
          : [];

        const fixedTabDepth = tabTopDepth(toolpath);
        const passUsesTabs = tabsForContour.length > 0 && depth < fixedTabDepth;

        if (!passUsesTabs) {
          lines.push(`G1 Z${formatNumber(depth)} F${formatNumber(plunge)}`);
          emitContourMoves(lines, contour, depth, feed, plunge, forcePolylineArcs);
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
          segments.push({
            from: tabStart,
            to: tabEnd,
            depth: fixedTabDepth,
          });
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
      }
    }
    lines.push(`G0 Z${formatNumber(safeZ)}`);
    lines.push("M5");
  }
  lines.push("M30");
  return lines.join("\n");
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
