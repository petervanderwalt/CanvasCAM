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
  transformOverlay = null,
}) {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  drawWorldGrid(ctx, rect, state, worldToScreen);

  drawOriginGuides(ctx, rect, state, worldToScreen, formatNumber);

  drawConstructionGuides(ctx, rect, state, worldToScreen);
  drawGuideSourceHover(ctx, rect, state, worldToScreen);
  drawCadSnapMarker(ctx, state, worldToScreen);
  drawTrimHover(ctx, state, worldToScreen);

  for (const loop of state.loops) {
    if (loop.sourceEntityIndexes?.length && loop.sourceEntityIndexes.every((index) => state.entities[index]?.__treeHidden)) {
      continue;
    }
    const isSelected = state.selectedLoopIds.has(loop.id);
    const isPreviewed = state.marqueePreviewLoopIds.has(loop.id) && !isSelected;
    const isHovered = state.hoveredLoopId === loop.id && !isSelected && !isPreviewed;
    const selectionAlpha = state.draftToolpath ? 0.06 : 0.18;
    const isClosed = loop.closed !== false;
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
    if (isClosed) {
      ctx.fill(loop.path2d);
    }
    ctx.stroke(loop.path2d);
    ctx.restore();
  }

  drawTrimEraser(ctx, state);

  if (state.booleanPreviewContours?.length) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 126, 74, 0.24)";
    ctx.strokeStyle = "#e8590c";
    ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    for (const contour of state.booleanPreviewContours) {
      if (!contour.length) {
        continue;
      }
      const first = worldToScreen(contour[0]);
      ctx.moveTo(first.x, first.y);
      for (const point of contour.slice(1)) {
        const screen = worldToScreen(point);
        ctx.lineTo(screen.x, screen.y);
      }
      ctx.closePath();
    }
    ctx.fill("evenodd");
    ctx.stroke();
    ctx.restore();
  }

  if (state.expandPreviewContours?.length) {
    ctx.save();
    ctx.fillStyle = "rgba(25, 135, 84, 0.22)";
    ctx.strokeStyle = "#198754";
    ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    for (const contour of state.expandPreviewContours) {
      if (!contour.length) {
        continue;
      }
      const first = worldToScreen(contour[0]);
      ctx.moveTo(first.x, first.y);
      for (const point of contour.slice(1)) {
        const screen = worldToScreen(point);
        ctx.lineTo(screen.x, screen.y);
      }
      ctx.closePath();
    }
    ctx.fill("evenodd");
    ctx.stroke();
    ctx.restore();
  }

  if (!navigationMode && !state.transformingGeometry) {
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

  if (transformOverlay) {
    drawTransformOverlay(ctx, transformOverlay);
  }

  if (state.cadDraft) {
    drawCadDraft(ctx, state.cadDraft, worldToScreen);
  }

  if (state.marquee?.active) {
    drawMarqueeRect(ctx, state.marquee.current, state.marquee.start);
  }
}

function drawConstructionGuides(ctx, rect, state, worldToScreen) {
  const guides = state.entities.filter((entity) => entity.type === "GUIDE");
  if (!guides.length) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = "rgba(0, 166, 190, 0.82)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([7, 6]);
  for (const guide of guides) {
    const a = worldToScreen(guide.start);
    const b = worldToScreen(guide.end);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) {
      continue;
    }
    const span = Math.max(rect.width, rect.height) * 2;
    ctx.beginPath();
    ctx.moveTo(a.x - (dx / length) * span, a.y - (dy / length) * span);
    ctx.lineTo(a.x + (dx / length) * span, a.y + (dy / length) * span);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGuideSourceHover(ctx, rect, state, worldToScreen) {
  const source = state.cadTool === "guide" && !state.cadDraft ? state.guideSourceHover : null;
  if (!source) {
    return;
  }
  const anchor = worldToScreen(source.point);
  const directionScreen = worldToScreen({
    x: source.point.x + source.direction.x,
    y: source.point.y + source.direction.y,
  });
  const dx = directionScreen.x - anchor.x;
  const dy = directionScreen.y - anchor.y;
  const length = Math.hypot(dx, dy) || 1;
  const span = Math.max(rect.width, rect.height) * 2;

  ctx.save();
  ctx.strokeStyle = "#e8590c";
  ctx.lineWidth = 2.4;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(anchor.x - (dx / length) * span, anchor.y - (dy / length) * span);
  ctx.lineTo(anchor.x + (dx / length) * span, anchor.y + (dy / length) * span);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#fffdf4";
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#9c3a0b";
  ctx.font = "700 11px Trebuchet MS, sans-serif";
  ctx.textBaseline = "bottom";
  ctx.fillText(`Guide from ${source.label}`, anchor.x + 8, anchor.y - 7);
  ctx.restore();
}

function drawCadSnapMarker(ctx, state, worldToScreen) {
  if (!state.cadTool || state.cadTool === "guide" || !state.cadSnapHover) {
    return;
  }
  const point = worldToScreen(state.cadSnapHover);
  ctx.save();
  ctx.fillStyle = "#fffdf4";
  ctx.strokeStyle = "#e8590c";
  ctx.lineWidth = 1.8;
  ctx.fillRect(point.x - 4, point.y - 4, 8, 8);
  ctx.strokeRect(point.x - 4, point.y - 4, 8, 8);
  ctx.restore();
}

function drawTrimHover(ctx, state, worldToScreen) {
  const candidate = state.cadTool === "trim" ? state.trimHover : null;
  const strokeCandidates = state.cadTool === "trim" && state.trimStroke
    ? [...state.trimStroke.candidates.values()]
    : [];
  if (!candidate && !strokeCandidates.length) {
    return;
  }
  for (const strokeCandidate of strokeCandidates) {
    drawTrimCandidate(ctx, strokeCandidate, worldToScreen, "#f97316", 3);
  }
  if (candidate) {
    drawTrimCandidate(ctx, candidate, worldToScreen, "#dc2626", 4, true);
  }
}

function drawTrimEraser(ctx, state) {
  if (state.cadTool !== "trim" || !state.trimPointer) {
    return;
  }
  const radius = Math.max(8, state.camera.zoom * 1.5);
  const size = radius * 2;
  ctx.save();
  ctx.fillStyle = "rgba(220, 38, 38, 0.10)";
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 3]);
  ctx.fillRect(state.trimPointer.x - radius, state.trimPointer.y - radius, size, size);
  ctx.strokeRect(state.trimPointer.x - radius, state.trimPointer.y - radius, size, size);
  ctx.restore();
}

function drawTrimCandidate(ctx, candidate, worldToScreen, color, lineWidth, drawEnds = false) {
  const start = worldToScreen(candidate.trimStart);
  const end = worldToScreen(candidate.trimEnd);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  if (candidate.kind === "arc") {
    const center = worldToScreen(candidate.center);
    const edge = worldToScreen({ x: candidate.center.x + candidate.radius, y: candidate.center.y });
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    const startAngle = -candidate.startAngle - (candidate.endAngle - candidate.startAngle) * candidate.startT;
    const endAngle = -candidate.startAngle - (candidate.endAngle - candidate.startAngle) * candidate.endT;
    ctx.arc(center.x, center.y, radius, startAngle, endAngle, true);
  } else {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  }
  ctx.stroke();
  if (!drawEnds) {
    ctx.restore();
    return;
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "#fffdf4";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  for (const point of [start, end]) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawCadDraft(ctx, draft, worldToScreen) {
  if (draft.tool === "guide" && draft.guide) {
    const guide = draft.guide;
    const anchor = worldToScreen(guide.anchor);
    const source = worldToScreen(guide.source);
    const directionPoint = worldToScreen({
      x: guide.anchor.x + guide.direction.x,
      y: guide.anchor.y + guide.direction.y,
    });
    const dx = directionPoint.x - anchor.x;
    const dy = directionPoint.y - anchor.y;
    const length = Math.hypot(dx, dy) || 1;
    const span = Math.max(ctx.canvas.width, ctx.canvas.height) * 2;

    ctx.save();
    ctx.strokeStyle = "rgba(0, 166, 190, 0.95)";
    ctx.lineWidth = 1.7;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(anchor.x - (dx / length) * span, anchor.y - (dy / length) * span);
    ctx.lineTo(anchor.x + (dx / length) * span, anchor.y + (dy / length) * span);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = "#e8590c";
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(anchor.x, anchor.y);
    ctx.stroke();
    ctx.fillStyle = "#fffdf4";
    ctx.strokeStyle = "#e8590c";
    ctx.lineWidth = 1.3;
    ctx.fillRect(source.x - 4, source.y - 4, 8, 8);
    ctx.strokeRect(source.x - 4, source.y - 4, 8, 8);

    const offset = Math.abs(guide.offset || 0);
    const suffix = guide.snapLabel ? ` · ${guide.snapLabel}` : "";
    ctx.font = "700 12px Trebuchet MS, sans-serif";
    ctx.textBaseline = "bottom";
    const label = `${Number(offset.toFixed(3))} mm${suffix}`;
    const labelX = (source.x + anchor.x) / 2 + 8;
    const labelY = (source.y + anchor.y) / 2 - 7;
    const width = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(255, 253, 244, 0.94)";
    ctx.fillRect(labelX - 4, labelY - 15, width + 8, 19);
    ctx.fillStyle = "#9c3a0b";
    ctx.fillText(label, labelX, labelY);
    ctx.restore();
    return;
  }
  const points = [...draft.points];
  if (draft.preview) {
    points.push(draft.preview);
  }
  if (points.length < 2) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = "#0d6efd";
  ctx.fillStyle = "rgba(13, 110, 253, 0.08)";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  if (draft.tool === "rectangle") {
    const [a, b] = points;
    const topLeft = worldToScreen({ x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) });
    const bottomRight = worldToScreen({ x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) });
    ctx.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    ctx.fill();
    ctx.stroke();
  } else if (draft.tool === "polygon") {
    const [center, edge] = points;
    const polygon = draft.polygon || {};
    const sides = Math.min(128, Math.max(3, Math.round(Number(polygon.sides) || 6)));
    const mode = polygon.mode === "circumscribed" ? "circumscribed" : "inscribed";
    const radius = Math.max(0.001, Number(polygon.radius) || Math.hypot(edge.x - center.x, edge.y - center.y));
    const angle = Number.isFinite(polygon.angle) ? polygon.angle : Math.atan2(edge.y - center.y, edge.x - center.x);
    const vertexRadius = mode === "circumscribed" ? radius / Math.cos(Math.PI / sides) : radius;
    const firstAngle = angle + (mode === "circumscribed" ? Math.PI / sides : 0);
    const vertices = Array.from({ length: sides }, (_, index) => {
      const vertexAngle = firstAngle + (Math.PI * 2 * index) / sides;
      return worldToScreen({
        x: center.x + Math.cos(vertexAngle) * vertexRadius,
        y: center.y + Math.sin(vertexAngle) * vertexRadius,
      });
    });
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (const vertex of vertices.slice(1)) {
      ctx.lineTo(vertex.x, vertex.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const centerScreen = worldToScreen(center);
    const radiusTarget = worldToScreen({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(centerScreen.x, centerScreen.y);
    ctx.lineTo(radiusTarget.x, radiusTarget.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fffdf4";
    ctx.beginPath();
    ctx.arc(radiusTarget.x, radiusTarget.y, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (draft.tool === "circle") {
    const [center, edge] = points;
    const c = worldToScreen(center);
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y) * Math.abs(worldToScreen({ x: center.x + 1, y: center.y }).x - c.x);
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (draft.tool === "arc") {
    const [center, start, end] = points;
    if (!end) {
      const c = worldToScreen(center);
      const edge = worldToScreen(start);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(edge.x, edge.y);
      ctx.stroke();
    } else {
      const c = worldToScreen(center);
      const startScreen = worldToScreen(start);
      const endScreen = worldToScreen(end);
      const radius = Math.hypot(startScreen.x - c.x, startScreen.y - c.y);
      const startAngle = Math.atan2(startScreen.y - c.y, startScreen.x - c.x);
      let endAngle = Math.atan2(endScreen.y - c.y, endScreen.x - c.x);
      if (endAngle <= startAngle) {
        endAngle += Math.PI * 2;
      }
      ctx.arc(c.x, c.y, radius, startAngle, endAngle, true);
      ctx.stroke();
    }
  } else if (draft.tool === "bezier") {
    const start = worldToScreen(points[0]);
    ctx.moveTo(start.x, start.y);
    if (points.length >= 4) {
      const c1 = worldToScreen(points[1]);
      const c2 = worldToScreen(points[2]);
      const end = worldToScreen(points[3]);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
    } else {
      for (const point of points.slice(1)) {
        const screen = worldToScreen(point);
        ctx.lineTo(screen.x, screen.y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const point of points) {
      const screen = worldToScreen(point);
      ctx.moveTo(screen.x - 3, screen.y);
      ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
    }
    ctx.stroke();
  } else if (draft.tool === "polyline") {
    const start = worldToScreen(points[0]);
    ctx.moveTo(start.x, start.y);
    for (const point of points.slice(1)) {
      const screen = worldToScreen(point);
      ctx.lineTo(screen.x, screen.y);
    }
    ctx.stroke();
  } else {
    const a = worldToScreen(points[0]);
    const b = worldToScreen(points[1]);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWorldGrid(ctx, rect, state, worldToScreen) {
  const zoom = Math.max(state.camera?.zoom || 1, 1e-6);
  const minX = (-rect.width / 2) / zoom - state.camera.panX;
  const maxX = (rect.width / 2) / zoom - state.camera.panX;
  const maxY = (rect.height / 2) / zoom - state.camera.panY;
  const minY = (-rect.height / 2) / zoom - state.camera.panY;

  const minorStep = Math.max(Number.parseFloat(state.gridSpacing) || 10, 0.1);
  const majorStep = minorStep * 5;

  ctx.save();
  ctx.fillStyle = "#fbfcfd";
  ctx.fillRect(0, 0, rect.width, rect.height);
  if (!state.gridVisible) {
    ctx.restore();
    return;
  }
  ctx.lineWidth = 1;

  if (state.gridStyle === "dots") {
    drawGridDots(ctx, rect, worldToScreen, minX, maxX, minY, maxY, minorStep, majorStep);
  } else {
    drawGridAxisSet(ctx, rect, worldToScreen, minX, maxX, minorStep, "x", "rgba(176, 186, 198, 0.22)");
    drawGridAxisSet(ctx, rect, worldToScreen, minY, maxY, minorStep, "y", "rgba(176, 186, 198, 0.22)");
    drawGridAxisSet(ctx, rect, worldToScreen, minX, maxX, majorStep, "x", "rgba(122, 138, 156, 0.46)");
    drawGridAxisSet(ctx, rect, worldToScreen, minY, maxY, majorStep, "y", "rgba(122, 138, 156, 0.46)");
  }

  ctx.restore();
}

function drawGridAxisSet(ctx, rect, worldToScreen, min, max, step, axis, strokeStyle) {
  if (!Number.isFinite(step) || step <= 0) {
    return;
  }
  const epsilon = step * 1e-6;
  const start = Math.floor(min / step) * step;
  if (Math.ceil((max - start) / step) > 1400) {
    return;
  }
  ctx.strokeStyle = strokeStyle;
  for (let value = start; value <= max + epsilon; value += step) {
    const snapped = Math.abs(value) < epsilon ? 0 : value;
    const screen = axis === "x"
      ? worldToScreen({ x: snapped, y: 0 }).x
      : worldToScreen({ x: 0, y: snapped }).y;
    if (axis === "x") {
      ctx.beginPath();
      ctx.moveTo(screen, 0);
      ctx.lineTo(screen, rect.height);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, screen);
      ctx.lineTo(rect.width, screen);
      ctx.stroke();
    }
  }
}

function drawGridDots(ctx, rect, worldToScreen, minX, maxX, minY, maxY, minorStep, majorStep) {
  const startX = Math.floor(minX / minorStep) * minorStep;
  const startY = Math.floor(minY / minorStep) * minorStep;
  const countX = Math.ceil((maxX - startX) / minorStep) + 1;
  const countY = Math.ceil((maxY - startY) / minorStep) + 1;
  const step = countX * countY > 12000 ? majorStep : minorStep;
  const epsilon = step * 1e-6;
  const majorEpsilon = majorStep * 1e-6;

  for (let x = Math.floor(minX / step) * step; x <= maxX + epsilon; x += step) {
    for (let y = Math.floor(minY / step) * step; y <= maxY + epsilon; y += step) {
      const isMajor = Math.abs((x / majorStep) - Math.round(x / majorStep)) < majorEpsilon
        && Math.abs((y / majorStep) - Math.round(y / majorStep)) < majorEpsilon;
      const screen = worldToScreen({ x, y });
      ctx.fillStyle = isMajor ? "rgba(122, 138, 156, 0.65)" : "rgba(176, 186, 198, 0.42)";
      const size = isMajor ? 2 : 1;
      ctx.fillRect(Math.round(screen.x) - size / 2, Math.round(screen.y) - size / 2, size, size);
    }
  }
}

export function drawRulers({
  topCtx,
  topCanvas,
  leftCtx,
  leftCanvas,
  state,
  worldToScreen,
  formatNumber,
}) {
  if (topCtx && topCanvas) {
    drawHorizontalRuler(topCtx, topCanvas, state, worldToScreen, formatNumber);
  }
  if (leftCtx && leftCanvas) {
    drawVerticalRuler(leftCtx, leftCanvas, state, worldToScreen, formatNumber);
  }
}

function drawHorizontalRuler(ctx, canvas, state, worldToScreen, formatNumber) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const zoom = Math.max(state.camera?.zoom || 1, 1e-6);
  const minX = (-rect.width / 2) / zoom - state.camera.panX;
  const maxX = (rect.width / 2) / zoom - state.camera.panX;
  const minorStep = 10;
  const majorStep = 50;

  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = "rgba(208, 216, 226, 0.95)";
  ctx.beginPath();
  ctx.moveTo(0, rect.height - 0.5);
  ctx.lineTo(rect.width, rect.height - 0.5);
  ctx.stroke();
  drawRulerTicks(ctx, rect, worldToScreen, minX, maxX, minorStep, majorStep, "x", formatNumber);
}

function drawVerticalRuler(ctx, canvas, state, worldToScreen, formatNumber) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const zoom = Math.max(state.camera?.zoom || 1, 1e-6);
  const maxY = (rect.height / 2) / zoom - state.camera.panY;
  const minY = (-rect.height / 2) / zoom - state.camera.panY;
  const minorStep = 10;
  const majorStep = 50;

  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = "rgba(208, 216, 226, 0.95)";
  ctx.beginPath();
  ctx.moveTo(rect.width - 0.5, 0);
  ctx.lineTo(rect.width - 0.5, rect.height);
  ctx.stroke();
  drawRulerTicks(ctx, rect, worldToScreen, minY, maxY, minorStep, majorStep, "y", formatNumber);
}

function drawRulerTicks(ctx, rect, worldToScreen, min, max, minorStep, majorStep, axis, formatNumber) {
  const epsilon = minorStep * 1e-6;
  const start = Math.floor(min / minorStep) * minorStep;
  ctx.font = "10px Segoe UI, sans-serif";
  ctx.fillStyle = "#7b8795";
  ctx.textBaseline = axis === "x" ? "top" : "middle";
  ctx.textAlign = axis === "x" ? "center" : "right";

  for (let value = start; value <= max + epsilon; value += minorStep) {
    const snapped = Math.abs(value) < epsilon ? 0 : value;
    const screen = axis === "x"
      ? worldToScreen({ x: snapped, y: 0 }).x
      : worldToScreen({ x: 0, y: snapped }).y;
    const isMajor = isNearMultiple(snapped, majorStep);
    const tickStart = axis === "x" ? rect.height : rect.width;
    const tickLength = isMajor ? 11 : 5;

    ctx.strokeStyle = isMajor ? "rgba(122, 138, 156, 0.8)" : "rgba(176, 186, 198, 0.75)";
    ctx.beginPath();
    if (axis === "x") {
      ctx.moveTo(screen + 0.5, tickStart);
      ctx.lineTo(screen + 0.5, tickStart - tickLength);
    } else {
      ctx.moveTo(tickStart, screen + 0.5);
      ctx.lineTo(tickStart - tickLength, screen + 0.5);
    }
    ctx.stroke();

    if (!isMajor) {
      continue;
    }
    const label = formatRulerValue(snapped, formatNumber);
    if (axis === "x") {
      ctx.fillText(label, screen, 2);
    } else {
      ctx.save();
      ctx.translate(rect.width - 13, screen);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }
}

function isNearMultiple(value, step) {
  if (!Number.isFinite(step) || step <= 0) {
    return false;
  }
  const remainder = Math.abs(value % step);
  const epsilon = step * 1e-4;
  return remainder < epsilon || Math.abs(remainder - step) < epsilon;
}

function formatRulerValue(value, formatNumber) {
  if (Math.abs(value) >= 100) {
    return String(Math.round(value));
  }
  return formatNumber(value);
}

function drawTransformOverlay(ctx, overlay) {
  const { polygon = [], handles = [], rotateHandles = [] } = overlay;
  ctx.save();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  if (polygon.length) {
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i += 1) {
      ctx.lineTo(polygon[i].x, polygon[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (overlay.mode === "scale") {
    for (const handle of handles) {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(handle.x - 5, handle.y - 5, 10, 10);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (overlay.mode === "rotate") {
    for (const handle of rotateHandles) {
      ctx.strokeStyle = "rgba(37, 99, 235, 0.45)";
      ctx.beginPath();
      ctx.moveTo(handle.anchor.x, handle.anchor.y);
      ctx.lineTo(handle.x, handle.y);
      ctx.stroke();
      ctx.fillStyle = "#eff6ff";
      ctx.strokeStyle = "#2563eb";
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawRotateGlyph(ctx, handle.x, handle.y);
    }
  }

  if (overlay.mode === "move" && overlay.moveSnapTarget) {
    const target = overlay.moveSnapTarget;
    ctx.strokeStyle = "#e8590c";
    ctx.fillStyle = "rgba(255, 253, 244, 0.92)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(target.x - 8, target.y);
    ctx.lineTo(target.x + 8, target.y);
    ctx.moveTo(target.x, target.y - 8);
    ctx.lineTo(target.x, target.y + 8);
    ctx.stroke();
  }

  if (overlay.moveReference) {
    const reference = overlay.moveReference;
    ctx.fillStyle = "#2563eb";
    ctx.strokeStyle = "#fffdf4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(reference.x, reference.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawRotateGlyph(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, 2.7, Math.PI * 0.15, Math.PI * 1.45);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 1.5, y - 3.6);
  ctx.lineTo(x + 4.2, y - 3.5);
  ctx.lineTo(x + 3.3, y - 1.1);
  ctx.stroke();
  ctx.restore();
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
  const originScreen = worldToScreen({ x: 0, y: 0 });
  const xVisible = originScreen.x >= 0 && originScreen.x <= rect.width;
  const yVisible = originScreen.y >= 0 && originScreen.y <= rect.height;

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;

  if (yVisible) {
    ctx.strokeStyle = "#dc3545";
    ctx.beginPath();
    ctx.moveTo(0, originScreen.y);
    ctx.lineTo(rect.width, originScreen.y);
    ctx.stroke();
  }

  if (xVisible) {
    ctx.strokeStyle = "#198754";
    ctx.beginPath();
    ctx.moveTo(originScreen.x, 0);
    ctx.lineTo(originScreen.x, rect.height);
    ctx.stroke();
  }

  if (xVisible && yVisible) {
    ctx.fillStyle = "#0d6efd";
    ctx.beginPath();
    ctx.arc(originScreen.x, originScreen.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("X0, Y0", originScreen.x - 8, originScreen.y + 8);
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

export function updateCanvasCursor({ canvas, state, screenPoint, findTabHit, findLoopHit, transformCursor = "" }) {
  if (state.cadTool) {
    if (state.cadTool === "trim") {
      canvas.style.cursor = "crosshair";
      return;
    }
    canvas.style.cursor = "crosshair";
    return;
  }
  if (state.geometryTransform) {
    canvas.style.cursor = transformCursor || "grabbing";
    return;
  }
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
  if (transformCursor) {
    canvas.style.cursor = transformCursor;
    return;
  }
  if (state.transformTool === "move") {
    canvas.style.cursor = "move";
    return;
  }
  if (state.transformTool === "scale") {
    canvas.style.cursor = "nwse-resize";
    return;
  }
  if (state.transformTool === "rotate") {
    canvas.style.cursor = "grab";
    return;
  }
  if (screenPoint && findLoopHit(screenPoint)) {
    canvas.style.cursor = "pointer";
    return;
  }
  canvas.style.cursor = "default";
}
