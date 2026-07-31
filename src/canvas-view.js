export function drawScene({
  ctx,
  canvas,
  state,
  worldToScreen,
  formatNumber,
  getRenderableToolpaths,
  strokePolyline,
  drawTabs,
  drawTabMarker,
  navigationMode = false,
}) {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const gridColor = "#dbeafe";
  ctx.save();
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  const spacing = 50;
  for (let x = rect.width % spacing; x < rect.width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rect.height);
    ctx.stroke();
  }
  for (let y = rect.height % spacing; y < rect.height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rect.width, y);
    ctx.stroke();
  }
  ctx.restore();

  drawOriginGuides(ctx, rect, state, worldToScreen, formatNumber);

  for (const loop of state.loops) {
    const isSelected = state.selectedLoopIds.has(loop.id);
    const isPreviewed = state.marqueePreviewLoopIds.has(loop.id) && !isSelected;
    const isHovered = state.hoveredLoopId === loop.id && !isSelected && !isPreviewed;
    const selectionAlpha = state.draftToolpath ? 0.06 : 0.18;
    ctx.save();
    ctx.fillStyle = isSelected
      ? `rgba(13, 110, 253, ${selectionAlpha})`
      : isHovered
        ? "rgba(13, 110, 253, 0.14)"
        : isPreviewed
          ? "rgba(13, 110, 253, 0.10)"
          : "rgba(108, 117, 125, 0.06)";
    ctx.strokeStyle = isSelected
      ? "#0d6efd"
      : isHovered
        ? "#3b82f6"
        : isPreviewed
          ? "#60a5fa"
          : "#495057";
    ctx.lineWidth = isSelected ? 2.2 : isHovered ? 1.9 : isPreviewed ? 1.8 : 1.2;
    ctx.fill(loop.path2d);
    ctx.stroke(loop.path2d);
    ctx.restore();
  }

  if (!navigationMode) {
    for (const toolpath of getRenderableToolpaths()) {
      const active = state.draftToolpath
        ? toolpath === state.draftToolpath
        : toolpath.id === state.activeToolpathId;
      const hoveredForTabs = state.addTabsMode
        && state.hoveredTabCandidate?.toolpathId === toolpath.id;
      ctx.save();
      ctx.strokeStyle = active ? "#dc3545" : hoveredForTabs ? "#0ea5e9" : "#198754";
      ctx.lineWidth = active ? 2.2 : hoveredForTabs ? 2 : 1.6;
      ctx.setLineDash([8, 6]);
      for (const contour of toolpath.previewContours) {
        strokePolyline(ctx, contour, worldToScreen);
      }
      ctx.restore();
      drawTabs(toolpath, { active, hoveredForTabs });
    }
  }

  if (!navigationMode && state.addTabsMode && state.hoveredTabCandidate) {
    const candidate = state.hoveredTabCandidate;
    drawTabMarker(candidate, candidate.toolDiameter, { alpha: 0.85 });
  }

  if (state.marquee?.active) {
    drawMarqueeRect(ctx, state.marquee.current, state.marquee.start);
  }
}

export function drawMarqueeRect(ctx, current, start) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  ctx.save();
  ctx.fillStyle = "rgba(13, 110, 253, 0.12)";
  ctx.strokeStyle = "#0d6efd";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.fillRect(left, top, width, height);
  ctx.strokeRect(left, top, width, height);
  ctx.restore();
}

export function drawOriginGuides(ctx, rect, state, worldToScreen, formatNumber) {
  const showOrigin = state.showOrigin !== false;
  if (!showOrigin) {
    return;
  }
  const originScreen = worldToScreen({ x: 0, y: 0 });
  const xVisible = originScreen.x >= 0 && originScreen.x <= rect.width;
  const yVisible = originScreen.y >= 0 && originScreen.y <= rect.height;

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;

  if (showOrigin && yVisible) {
    ctx.strokeStyle = "#dc3545";
    ctx.beginPath();
    ctx.moveTo(0, originScreen.y);
    ctx.lineTo(rect.width, originScreen.y);
    ctx.stroke();
  }

  if (showOrigin && xVisible) {
    ctx.strokeStyle = "#198754";
    ctx.beginPath();
    ctx.moveTo(originScreen.x, 0);
    ctx.lineTo(originScreen.x, rect.height);
    ctx.stroke();
  }

  if (showOrigin && xVisible && yVisible) {
    ctx.fillStyle = "#0d6efd";
    ctx.beginPath();
    ctx.arc(originScreen.x, originScreen.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px sans-serif";
    ctx.fillText("X0, Y0", originScreen.x + 8, originScreen.y - 8);
  }

  ctx.restore();
}

export function strokePolyline(ctx, points, worldToScreen) {
  if (!points || points.length < 2) {
    return;
  }
  ctx.beginPath();
  const first = worldToScreen(points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const point = worldToScreen(points[i]);
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

export function drawTabMarker(ctx, marker, toolDiameter, zoom, options = {}) {
  const radius = (toolDiameter * zoom) / 2;
  const fill = options.fill || "#6ee7b7";
  const stroke = options.stroke || "#198754";
  const outline = Math.max(1, zoom * 0.08) + (options.hovered ? 1.25 : 0);

  const spine = marker.spine?.length >= 2 ? marker.spine : [marker.a, marker.b];
  drawConcaveTabBody(ctx, spine, radius, fill, stroke, outline, options);
}

export function drawCapsule(ctx, start, end, nx, ny, radius) {
  ctx.beginPath();
  ctx.moveTo(start.x + nx * radius, start.y + ny * radius);
  ctx.lineTo(end.x + nx * radius, end.y + ny * radius);
  ctx.arc(end.x, end.y, radius, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
  ctx.lineTo(start.x - nx * radius, start.y - ny * radius);
  ctx.arc(start.x, start.y, radius, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function strokeMarkerSpine(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function drawConcaveTabBody(ctx, spine, radius, fill, stroke, outline, options) {
  const rect = ctx.canvas.getBoundingClientRect();
  const scratch = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(Math.max(1, Math.ceil(rect.width)), Math.max(1, Math.ceil(rect.height)))
    : document.createElement("canvas");

  if (!(scratch instanceof OffscreenCanvas)) {
    scratch.width = Math.max(1, Math.ceil(rect.width));
    scratch.height = Math.max(1, Math.ceil(rect.height));
  }

  const sctx = scratch.getContext("2d");
  sctx.save();
  sctx.globalAlpha = options.alpha ?? 1;
  sctx.lineCap = "round";
  sctx.lineJoin = "round";

  // First paint a stroked body that follows the toolpath segment exactly.
  sctx.strokeStyle = stroke;
  sctx.lineWidth = radius * 2 + outline * 2;
  strokeMarkerSpine(sctx, spine);

  sctx.strokeStyle = fill;
  sctx.lineWidth = radius * 2;
  strokeMarkerSpine(sctx, spine);

  // Carve inward cutter scallops at each end so the marker reads as remaining stock, not a pill.
  sctx.globalCompositeOperation = "destination-out";
  fillCircle(sctx, spine[0], radius + outline + 1);
  fillCircle(sctx, spine[spine.length - 1], radius + outline + 1);

  sctx.globalCompositeOperation = "source-over";
  sctx.strokeStyle = stroke;
  sctx.lineWidth = outline * 2;
  strokeConcaveArc(sctx, spine[0], spine[1], radius);
  strokeConcaveArc(sctx, spine[spine.length - 1], spine[spine.length - 2], radius);
  sctx.restore();

  ctx.save();
  if (options.hovered) {
    ctx.shadowColor = "rgba(6, 95, 70, 0.28)";
    ctx.shadowBlur = 10;
  }
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}

function fillCircle(ctx, center, radius) {
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function strokeConcaveArc(ctx, anchor, nextPoint, radius) {
  const dx = nextPoint.x - anchor.x;
  const dy = nextPoint.y - anchor.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;

  const topAngle = Math.atan2(ny, nx);
  const bottomAngle = Math.atan2(-ny, -nx);
  const inwardAngle = Math.atan2(uy, ux);
  const useCounterClockwise = angleLiesOnCounterClockwiseSweep(topAngle, bottomAngle, inwardAngle);

  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, radius, topAngle, bottomAngle, useCounterClockwise);
  ctx.stroke();
}

function normalizeAngle(angle) {
  const tau = Math.PI * 2;
  let normalized = angle % tau;
  if (normalized < 0) {
    normalized += tau;
  }
  return normalized;
}

function angleLiesOnCounterClockwiseSweep(start, end, target) {
  const tau = Math.PI * 2;
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(end);
  const normalizedTarget = normalizeAngle(target);
  const ccwSpan = (normalizedStart - normalizedEnd + tau) % tau;
  const ccwTarget = (normalizedStart - normalizedTarget + tau) % tau;
  return ccwTarget <= ccwSpan;
}

export function updateCanvasCursor({ canvas, state, screenPoint, findTabHit, findLoopHit }) {
  if (state.draggingTab || state.dragPan) {
    canvas.style.cursor = "grabbing";
    return;
  }
  if (state.marquee?.active) {
    canvas.style.cursor = "crosshair";
    return;
  }
  if (screenPoint && findTabHit(screenPoint)) {
    canvas.style.cursor = "move";
    return;
  }
  if (state.addTabsMode) {
    canvas.style.cursor = "copy";
    return;
  }
  if (screenPoint && findLoopHit(screenPoint)) {
    canvas.style.cursor = "pointer";
    return;
  }
  canvas.style.cursor = "default";
}
