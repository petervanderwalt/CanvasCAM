import {
  MARQUEE_DRAG_THRESHOLD,
  TAB_DELETE_HOLD_MS,
  TAB_DELETE_MOVE_THRESHOLD,
} from "./src/constants.js?v=20260730-vcarve11";
import { parseDxf as parseDxfFile } from "./src/dxf.js?v=20260730-vcarve11";
import { parseSvg as parseSvgFile } from "./src/svg.js?v=20260730-vcarve11";
import * as Paths from "./src/paths.js?v=20260730-vcarve11";
import * as CamOps from "./src/cam-ops.js?v=20260730-vcarve11";
import * as UiState from "./src/ui-state.js?v=20260730-vcarve11";
import * as CanvasView from "./src/canvas-view.js?v=20260730-vcarve11";

(function () {

  const canvas = document.getElementById("drawingCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    loadSampleBtn: document.getElementById("loadSampleBtn"),
    fileInput: document.getElementById("fileInput"),
    zoomFitBtn: document.getElementById("zoomFitBtn"),
    statusText: document.getElementById("statusText"),
    selectionCount: document.getElementById("selectionCount"),
    selectionHeading: document.getElementById("selectionHeading"),
    selectionEmpty: document.getElementById("selectionEmpty"),
    toolpathForm: document.getElementById("toolpathForm"),
    toolpathFormMode: document.getElementById("toolpathFormMode"),
    toggleSettingsBtn: document.getElementById("toggleSettingsBtn"),
    globalSettingsSection: document.getElementById("globalSettingsSection"),
    toolpathTypeInput: document.getElementById("toolpathTypeInput"),
    operationOptions: Array.from(document.querySelectorAll(".operation-option")),
    toolDiameterField: document.getElementById("toolDiameterField"),
    toolDiameterInput: document.getElementById("toolDiameterInput"),
    cutterAngleField: document.getElementById("cutterAngleField"),
    cutterAngleInput: document.getElementById("cutterAngleInput"),
    overlapInput: document.getElementById("overlapInput"),
    overlapField: document.getElementById("overlapField"),
    cutDepthField: document.getElementById("cutDepthField"),
    cutDepthInput: document.getElementById("cutDepthInput"),
    passDepthInput: document.getElementById("passDepthInput"),
    tabWidthField: document.getElementById("tabWidthField"),
    tabWidthInput: document.getElementById("tabWidthInput"),
    tabHeightField: document.getElementById("tabHeightField"),
    tabHeightInput: document.getElementById("tabHeightInput"),
    toolpathSubmitBtn: document.getElementById("toolpathSubmitBtn"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    safeZInput: document.getElementById("safeZInput"),
    feedRateInput: document.getElementById("feedRateInput"),
    plungeRateInput: document.getElementById("plungeRateInput"),
    spindleInput: document.getElementById("spindleInput"),
    forcePolylineArcsInput: document.getElementById("forcePolylineArcsInput"),
    toolpathCount: document.getElementById("toolpathCount"),
    toolpathList: document.getElementById("toolpathList"),
    addTabsBtn: document.getElementById("addTabsBtn"),
    removeTabsBtn: document.getElementById("removeTabsBtn"),
    generateGcodeBtn: document.getElementById("generateGcodeBtn"),
    tabModeHint: document.getElementById("tabModeHint"),
  };

  const state = {
    fileName: "",
    entities: [],
    loops: [],
    selectedLoopIds: new Set(),
    hoveredLoopId: null,
    toolpaths: [],
    activeToolpathId: null,
    addTabsMode: false,
    hoveredTabCandidate: null,
    hoveredTab: null,
    draggingTab: null,
    tabPress: null,
    marquee: null,
    marqueePreviewLoopIds: new Set(),
    camera: {
      zoom: 1,
      panX: 0,
      panY: 0,
    },
    dragPan: null,
    bounds: null,
    importTranslation: { x: 0, y: 0 },
    editingToolpathId: null,
    draftToolpath: null,
    autoTabHeight: true,
    draftBuildToken: 0,
  };

  function setStatus(message) {
    ui.statusText.textContent = message;
  }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function worldToScreen(point) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.width / 2 + (point.x + state.camera.panX) * state.camera.zoom,
      y: rect.height / 2 - (point.y + state.camera.panY) * state.camera.zoom,
    };
  }

  function screenToWorld(point) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (point.x - rect.width / 2) / state.camera.zoom - state.camera.panX,
      y: -(point.y - rect.height / 2) / state.camera.zoom - state.camera.panY,
    };
  }

  function fitCameraToBounds(bounds) {
    if (!bounds) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(bounds.maxX - bounds.minX, 1);
    const height = Math.max(bounds.maxY - bounds.minY, 1);
    const padding = 40;
    const zoom = Math.min((rect.width - padding) / width, (rect.height - padding) / height);
    state.camera.zoom = Math.max(0.05, zoom);
    state.camera.panX = -((bounds.minX + bounds.maxX) / 2);
    state.camera.panY = -((bounds.minY + bounds.maxY) / 2);
  }

  function translatePoint(point, dx, dy) {
    return {
      x: point.x + dx,
      y: point.y + dy,
    };
  }

  function createMatrix(...args) {
    return Paths.createMatrix(...args);
  }

  function multiplyMatrices(...args) {
    return Paths.multiplyMatrices(...args);
  }

  function applyMatrixToPoint(...args) {
    return Paths.applyMatrixToPoint(...args);
  }

  function parseSvgTransform(...args) {
    return Paths.parseSvgTransform(...args);
  }

  function parseSvgCoordinateList(...args) {
    return Paths.parseSvgCoordinateList(...args);
  }

  function parseSvgPoints(...args) {
    return Paths.parseSvgPoints(...args);
  }

  function sampleEllipsePoints(...args) {
    return Paths.sampleEllipsePoints(...args);
  }

  function translateEntity(...args) {
    return Paths.translateEntity(...args);
  }

  function parseDxf(text) {
    return parseDxfFile(text);
  }

  function parseSvg(text) {
    return parseSvgFile(text);
  }

  function normalizeAngleDeg(...args) {
    return Paths.normalizeAngleDeg(...args);
  }

  function clonePoint(...args) {
    return Paths.clonePoint(...args);
  }

  function dist(...args) {
    return Paths.dist(...args);
  }

  function clamp(...args) {
    return Paths.clamp(...args);
  }

  function pointKey(...args) {
    return Paths.pointKey(...args);
  }

  function entityToSegment(...args) {
    return Paths.entityToSegment(...args);
  }

  function polylineSegmentFromPoints(...args) {
    return Paths.polylineSegmentFromPoints(...args);
  }

  function buildLoops(...args) {
    return Paths.buildLoops(...args);
  }

  function createLoopPath2D(segments) {
    return Paths.createLoopPath2D(segments, worldToScreen, state.camera.zoom);
  }

  function rebuildLoopPaths() {
    for (const loop of state.loops) {
      loop.path2d = createLoopPath2D(loop.segments);
    }
  }

  function refreshSelectionUi() {
    UiState.refreshSelectionUi({
      state,
      ui,
      editing: getEditingToolpath(),
      refreshOperationUiFn: UiState.refreshOperationUi,
      refreshToolpathFieldVisibilityFn: UiState.refreshToolpathFieldVisibility,
      rebuildDraftToolpath,
    });
  }

  function refreshToolpathUi() {
    UiState.refreshToolpathUi({
      state,
      ui,
      renderableToolpaths: getRenderableToolpaths(),
      activeToolpath: getInteractiveToolpath(),
      tabEligibleToolpathCount: getTabEligibleToolpaths().length,
      onEditToolpath: (toolpath) => {
        loadToolpathIntoForm(toolpath);
        state.activeToolpathId = toolpath.id;
        state.addTabsMode = false;
        refreshSelectionUi();
        refreshToolpathUi();
        draw();
      },
      onDeleteToolpath: (toolpath) => deleteToolpathById(toolpath.id),
      onActivateToolpath: (toolpath) => {
        if (state.activeToolpathId === toolpath.id && !state.editingToolpathId && !state.addTabsMode) {
          return;
        }
        state.activeToolpathId = toolpath.id;
        state.addTabsMode = false;
        refreshToolpathUi();
        refreshSelectionUi();
        draw();
      },
    });
  }

  function getActiveToolpath() {
    return state.toolpaths.find((toolpath) => toolpath.id === state.activeToolpathId) || null;
  }

  function getEditingToolpath() {
    return state.toolpaths.find((toolpath) => toolpath.id === state.editingToolpathId) || null;
  }

  function getDraftSourceLoops() {
    const editing = getEditingToolpath();
    if (editing) {
      return editing.sourceLoops;
    }
    return loopsFromSelection();
  }

  function getInteractiveToolpath() {
    return state.draftToolpath || getActiveToolpath();
  }

  function getRenderableToolpaths() {
    if (!state.draftToolpath) {
      return state.toolpaths;
    }
    if (!state.editingToolpathId) {
      return [...state.toolpaths, state.draftToolpath];
    }
    return state.toolpaths.map((toolpath) => (
      toolpath.id === state.editingToolpathId ? state.draftToolpath : toolpath
    ));
  }

  function getTabEligibleToolpaths() {
    return state.toolpaths.filter((toolpath) => operationUsesTabs(toolpath));
  }

  function normalizeTabsForToolpath(toolpath, tabs) {
    if (!tabs?.length) {
      return [];
    }
    const normalized = [];
    for (const tab of tabs) {
      const contour = toolpath.previewContours[tab.contourIndex];
      if (!contour?.length) {
        continue;
      }
      const total = polylineLength(contour);
      const along = clamp(tab.along, 0, total);
      normalized.push({
        contourIndex: tab.contourIndex,
        along,
        point: pointAtDistance(contour, along),
      });
    }
    return normalized;
  }

  async function rebuildDraftToolpath() {
    const buildToken = ++state.draftBuildToken;
    const sourceLoops = getDraftSourceLoops();
    if (!sourceLoops.length || ui.toolpathForm.classList.contains("d-none")) {
      if (buildToken === state.draftBuildToken) {
        state.draftToolpath = null;
        if (state.addTabsMode) {
          state.hoveredTabCandidate = null;
        }
      }
      return;
    }
    const editing = getEditingToolpath();
    const config = readToolpathConfigFromForm();

    try {
      if (config.operation === "vcarve" && !isVCarveEngineReady()) {
        setStatus("V-Carve engine is loading...");
      }
      const draft = await createToolpathFromLoopsAsync(sourceLoops, config, {
        id: editing?.id || "draft-toolpath",
        label: editing?.label,
      });
      if (buildToken !== state.draftBuildToken) {
        return;
      }
      const existingTabs = state.draftToolpath?.tabs || editing?.tabs || [];
      draft.tabs = normalizeTabsForToolpath(draft, existingTabs);
      state.draftToolpath = draft;
      if (config.operation === "vcarve") {
        setStatus("V-Carve engine ready.");
      }
      refreshToolpathUi();
      draw();
    } catch (error) {
      if (buildToken !== state.draftBuildToken) {
        return;
      }
      state.draftToolpath = null;
      if (error instanceof Error) {
        setStatus(error.message);
      }
      refreshToolpathUi();
      draw();
    }
  }

  function clearDraftToolpath() {
    state.draftToolpath = null;
    state.hoveredTabCandidate = null;
  }

  function getDefaultTabHeight(cutDepth) {
    return Math.max(0.1, cutDepth / 2);
  }

  function syncAutoTabHeight() {
    if (!state.autoTabHeight) {
      return;
    }
    const cutDepth = Number.parseFloat(ui.cutDepthInput.value) || 18;
    ui.tabHeightInput.value = formatNumber(getDefaultTabHeight(cutDepth));
  }

  function readToolpathConfigFromForm() {
    const toolDiameter = Number.parseFloat(ui.toolDiameterInput.value) || 6;
    const minimumTabWidth = getMinimumTabWidth(toolDiameter);
    const tabWidth = Math.max(Number.parseFloat(ui.tabWidthInput.value) || minimumTabWidth, minimumTabWidth);
    ui.tabWidthInput.value = formatNumber(tabWidth);
    return {
      operation: ui.toolpathTypeInput.value,
      toolDiameter,
      toolRadius: toolDiameter / 2,
      cutterAngle: Number.parseFloat(ui.cutterAngleInput.value) || 90,
      overlapPercent: Number.parseFloat(ui.overlapInput.value) || 40,
      cutDepth: Number.parseFloat(ui.cutDepthInput.value) || 18,
      passDepth: Number.parseFloat(ui.passDepthInput.value) || 3,
      tabWidth,
      tabHeight: Number.parseFloat(ui.tabHeightInput.value) || 1.5,
      safeZ: Number.parseFloat(ui.safeZInput.value) || 6,
      feedRate: Number.parseFloat(ui.feedRateInput.value) || 1800,
      plungeRate: Number.parseFloat(ui.plungeRateInput.value) || 600,
      spindle: Number.parseFloat(ui.spindleInput.value) || 18000,
    };
  }

  function setFormFromToolpath(toolpath) {
    state.autoTabHeight = false;
    ui.toolpathTypeInput.value = toolpath.operation;
    ui.toolDiameterInput.value = toolpath.toolDiameter;
    ui.cutterAngleInput.value = toolpath.cutterAngle || 90;
    ui.overlapInput.value = toolpath.overlapPercent;
    ui.cutDepthInput.value = toolpath.cutDepth;
    ui.passDepthInput.value = toolpath.passDepth;
    ui.tabWidthInput.value = formatNumber(Math.max(toolpath.tabWidth, getMinimumTabWidth(toolpath.toolDiameter)));
    ui.tabHeightInput.value = toolpath.tabHeight;
    ui.safeZInput.value = toolpath.safeZ;
    ui.feedRateInput.value = toolpath.feedRate;
    ui.plungeRateInput.value = toolpath.plungeRate;
    ui.spindleInput.value = toolpath.spindle;
    refreshOperationUi();
    refreshToolpathFieldVisibility();
  }

  function loadToolpathIntoForm(toolpath) {
    state.editingToolpathId = toolpath.id;
    state.selectedLoopIds.clear();
    setFormFromToolpath(toolpath);
    rebuildDraftToolpath();
  }

  function clearToolpathEditing() {
    state.editingToolpathId = null;
    state.autoTabHeight = true;
  }

  function refreshOperationUi() {
    UiState.refreshOperationUi(ui);
  }

  function refreshToolpathFieldVisibility() {
    UiState.refreshToolpathFieldVisibility(ui);
  }

  function deleteToolpathById(toolpathId) {
    state.toolpaths = state.toolpaths.filter((toolpath) => toolpath.id !== toolpathId);
    if (state.editingToolpathId === toolpathId) {
      clearToolpathEditing();
    }
    if (state.activeToolpathId === toolpathId) {
      state.activeToolpathId = state.toolpaths[0]?.id || null;
    }
    state.addTabsMode = false;
    clearDraftToolpath();
    refreshSelectionUi();
    refreshToolpathUi();
    draw();
  }

  function draw() {
    CanvasView.drawScene({
      ctx,
      canvas,
      state,
      worldToScreen,
      formatNumber,
      getRenderableToolpaths,
      strokePolyline: CanvasView.strokePolyline,
      drawTabs,
      drawTabMarker: (marker, toolDiameter, options = {}) => CanvasView.drawTabMarker(
        ctx,
        marker,
        toolDiameter,
        state.camera.zoom,
        options
      ),
    });
  }

  function drawMarqueeRect(current, start) {
    CanvasView.drawMarqueeRect(ctx, current, start);
  }

  function drawOriginGuides(rect) {
    CanvasView.drawOriginGuides(ctx, rect, state, worldToScreen, formatNumber);
  }

  function strokePolyline(points) {
    CanvasView.strokePolyline(ctx, points, worldToScreen);
  }

  function drawTabs(toolpath, options = {}) {
    const tabWidth = Math.max(toolpath.tabWidth, getMinimumTabWidth(toolpath.toolDiameter));
    const tabSpan = getTabCenterlineSpan(tabWidth, toolpath.toolDiameter);
    for (let index = 0; index < toolpath.tabs.length; index += 1) {
      const tab = toolpath.tabs[index];
      const contour = toolpath.previewContours[tab.contourIndex];
      if (!contour) {
        continue;
      }
      const marker = buildTabMarker(contour, tab.along, tabSpan);
      const isHovered = state.hoveredTab?.toolpath?.id === toolpath.id && state.hoveredTab.index === index;
      drawTabMarker(marker, toolpath.toolDiameter, {
        alpha: isHovered ? 1 : options.active ? 1 : 0.82,
        fill: isHovered ? "#34d399" : options.active ? "#20c997" : "#6ee7b7",
        stroke: isHovered ? "#065f46" : options.active ? "#198754" : "#2f855a",
        hovered: isHovered,
      });
    }
  }

  function drawTabMarker(marker, toolDiameter, options = {}) {
    CanvasView.drawTabMarker(ctx, marker, toolDiameter, state.camera.zoom, options);
  }

  function drawCapsule(start, end, nx, ny, radius) {
    CanvasView.drawCapsule(ctx, start, end, nx, ny, radius);
  }

  function drawPolylineIntoPath(path, points, transform) {
    if (!points.length) {
      return;
    }
    const start = transform(points[0]);
    path.moveTo(start.x, start.y);
    for (let i = 1; i < points.length; i += 1) {
      const point = transform(points[i]);
      path.lineTo(point.x, point.y);
    }
  }

  function boundsOfPoints(...args) {
    return Paths.boundsOfPoints(...args);
  }

  function mergeBounds(...args) {
    return Paths.mergeBounds(...args);
  }

  function boundsOfEntities(...args) {
    return Paths.boundsOfEntities(...args);
  }

  function polygonArea(...args) {
    return Paths.polygonArea(...args);
  }

  function closePoints(...args) {
    return Paths.closePoints(...args);
  }

  function loopsFromSelection() {
    return state.loops.filter((loop) => state.selectedLoopIds.has(loop.id));
  }

  function createToolpathFromLoops(selectedLoops, config, options = {}) {
    return CamOps.createToolpathFromLoops(selectedLoops, config, {
      ...options,
      loopIndexResolver: (loop) => state.loops.findIndex((candidate) => candidate.id === loop.id),
    });
  }

  function createToolpathFromLoopsAsync(selectedLoops, config, options = {}) {
    return CamOps.createToolpathFromLoopsAsync(selectedLoops, config, {
      ...options,
      loopIndexResolver: (loop) => state.loops.findIndex((candidate) => candidate.id === loop.id),
    });
  }

  function createToolpathFromSelection(config) {
    return createToolpathFromLoops(loopsFromSelection(), config);
  }

  function commitDraftToolpath() {
    if (!state.draftToolpath) {
      return;
    }
    const editing = getEditingToolpath();
    if (editing) {
      const index = state.toolpaths.findIndex((toolpath) => toolpath.id === editing.id);
      if (index >= 0) {
        state.toolpaths[index] = state.draftToolpath;
      }
      state.activeToolpathId = state.draftToolpath.id;
      clearToolpathEditing();
    } else {
      if (operationUsesTabs(state.draftToolpath) && state.draftToolpath.tabs.length === 0) {
        populateDefaultTabs(state.draftToolpath);
      }
      state.toolpaths.push(state.draftToolpath);
      state.activeToolpathId = state.draftToolpath.id;
      state.selectedLoopIds.clear();
    }
    state.addTabsMode = false;
    clearDraftToolpath();
  }

  function loadImportedEntities(entities, name, sourceLabel) {
    state.fileName = name;
    const rawBounds = boundsOfEntities(entities);
    const shiftX = rawBounds ? -rawBounds.minX : 0;
    const shiftY = rawBounds ? (sourceLabel === "SVG" ? rawBounds.maxY : -rawBounds.minY) : 0;

    state.importTranslation = { x: shiftX, y: shiftY };
    state.entities = entities.map((entity) => {
      const translated = translateEntity(entity, shiftX, sourceLabel === "SVG" ? 0 : shiftY);
      if (sourceLabel !== "SVG") {
        return translated;
      }
      return mirrorEntityY(translated, rawBounds.maxY);
    });
    state.loops = buildLoops(state.entities);
    state.selectedLoopIds.clear();
    state.toolpaths = [];
    state.activeToolpathId = null;
    state.addTabsMode = false;
    clearToolpathEditing();
    clearDraftToolpath();
    state.bounds = mergeBounds(state.loops.map((loop) => loop.bounds));
    fitCameraToBounds(state.bounds);
    rebuildLoopPaths();
    refreshSelectionUi();
    refreshToolpathUi();
    setStatus(
      `Loaded ${name}: ${state.entities.length} entities from ${sourceLabel}, ${state.loops.length} closed vectors.`
    );
    draw();
  }

  function mirrorEntityY(entity, maxY) {
    return Paths.mirrorEntityY(entity, maxY);
  }

  function loadDxfText(text, name) {
    loadImportedEntities(parseDxf(text), name, "DXF");
  }

  function loadSvgText(text, name) {
    loadImportedEntities(parseSvg(text), name, "SVG");
  }

  async function loadBundledSample() {
    try {
      const response = await fetch("./Hockey%20Sticks%20Cut%201.dxf");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      loadDxfText(text, "Hockey Sticks Cut 1.dxf");
    } catch (error) {
      setStatus("Bundled sample could not be fetched directly. Use Load DXF File if you opened the app from the filesystem.");
    }
  }

  function pickLoopAtScreenPoint(point, append) {
    clearToolpathEditing();
    rebuildLoopPaths();
    const hit = findLoopHit(point);
    if (!append) {
      state.selectedLoopIds.clear();
    }
    if (hit) {
      if (append && state.selectedLoopIds.has(hit.id)) {
        state.selectedLoopIds.delete(hit.id);
      } else {
        state.selectedLoopIds.add(hit.id);
      }
    }
    refreshSelectionUi();
    refreshToolpathUi();
    draw();
  }

  function findLoopHit(point) {
    for (let i = state.loops.length - 1; i >= 0; i -= 1) {
      if (ctx.isPointInPath(state.loops[i].path2d, point.x, point.y)) {
        return state.loops[i];
      }
    }
    return null;
  }

  function normalizeScreenRect(a, b) {
    return {
      left: Math.min(a.x, b.x),
      right: Math.max(a.x, b.x),
      top: Math.min(a.y, b.y),
      bottom: Math.max(a.y, b.y),
    };
  }

  function screenRectToWorldRect(rect) {
    const topLeft = screenToWorld({ x: rect.left, y: rect.top });
    const bottomRight = screenToWorld({ x: rect.right, y: rect.bottom });
    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxY: Math.max(topLeft.y, bottomRight.y),
    };
  }

  function boundsIntersect(a, b) {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
  }

  function loopIdsInMarquee(startPoint, endPoint) {
    const screenRect = normalizeScreenRect(startPoint, endPoint);
    const worldRect = screenRectToWorldRect(screenRect);
    const loopIds = new Set();
    for (const loop of state.loops) {
      if (boundsIntersect(loop.bounds, worldRect)) {
        loopIds.add(loop.id);
      }
    }
    return loopIds;
  }

  function pickLoopsInMarquee(startPoint, endPoint, append) {
    clearToolpathEditing();
    const loopIds = loopIdsInMarquee(startPoint, endPoint);
    if (!append) {
      state.selectedLoopIds.clear();
    }
    for (const loopId of loopIds) {
      state.selectedLoopIds.add(loopId);
    }
    state.marqueePreviewLoopIds.clear();
    refreshSelectionUi();
    refreshToolpathUi();
    draw();
  }

  function nearestPointOnPolyline(...args) {
    return CamOps.nearestPointOnPolyline(...args);
  }

  function buildTabMarker(contour, alongDistance, width) {
    return CamOps.buildTabMarker(contour, alongDistance, width, worldToScreen);
  }

  function getMinimumTabWidth(...args) {
    return CamOps.getMinimumTabWidth(...args);
  }

  function getTabCenterlineSpan(...args) {
    return CamOps.getTabCenterlineSpan(...args);
  }

  function pointAtDistance(...args) {
    return Paths.pointAtDistance(...args);
  }

  function polylineLength(...args) {
    return Paths.polylineLength(...args);
  }

  function updateHoveredTabCandidate(screenPoint) {
    if (!state.addTabsMode) {
      state.hoveredTabCandidate = null;
      return;
    }
    const worldPoint = screenToWorld(screenPoint);
    let best = null;
    for (const toolpath of getTabEligibleToolpaths()) {
      for (let contourIndex = 0; contourIndex < toolpath.previewContours.length; contourIndex += 1) {
        const contour = toolpath.previewContours[contourIndex];
        const nearest = nearestPointOnPolyline(contour, worldPoint);
        if (!nearest) {
          continue;
        }
        const pixelDistance = nearest.distance * state.camera.zoom;
        if (pixelDistance > 14) {
          continue;
        }
        if (!best || pixelDistance < best.pixelDistance) {
          best = {
            toolpath,
            contourIndex,
            along: nearest.along,
            point: nearest.point,
            pixelDistance,
          };
        }
      }
    }
    if (!best) {
      state.hoveredTabCandidate = null;
      return;
    }
    const contour = best.toolpath.previewContours[best.contourIndex];
    const marker = buildTabMarker(
      contour,
      best.along,
      getTabCenterlineSpan(
        Math.max(best.toolpath.tabWidth, getMinimumTabWidth(best.toolpath.toolDiameter)),
        best.toolpath.toolDiameter
      )
    );
    state.hoveredTabCandidate = {
      toolpathId: best.toolpath.id,
      contourIndex: best.contourIndex,
      along: best.along,
      point: best.point,
      a: marker.a,
      b: marker.b,
      center: marker.center,
      spine: marker.spine,
      toolDiameter: best.toolpath.toolDiameter,
    };
  }

  function addTabAtHoveredCandidate() {
    if (!state.hoveredTabCandidate) {
      return;
    }
    const toolpath = state.toolpaths.find((candidate) => candidate.id === state.hoveredTabCandidate.toolpathId);
    if (!toolpath) {
      return;
    }
    toolpath.tabs.push({
      contourIndex: state.hoveredTabCandidate.contourIndex,
      along: state.hoveredTabCandidate.along,
      point: clonePoint(state.hoveredTabCandidate.point),
    });
    state.activeToolpathId = toolpath.id;
    state.addTabsMode = false;
    state.hoveredTabCandidate = null;
    refreshToolpathUi();
    draw();
  }

  function canMoveTabs() {
    return !state.editingToolpathId && !state.draftToolpath;
  }

  function findTabHit(screenPoint) {
    if (!canMoveTabs()) {
      return null;
    }
    for (const toolpath of getTabEligibleToolpaths()) {
      for (let index = 0; index < toolpath.tabs.length; index += 1) {
        const tab = toolpath.tabs[index];
        const p = worldToScreen(tab.point);
        if (Math.hypot(p.x - screenPoint.x, p.y - screenPoint.y) <= 8) {
          return { toolpath, index };
        }
      }
    }
    return null;
  }

  function populateDefaultTabs(toolpath) {
    if (!toolpath || !toolpath.previewContours.length || !operationUsesTabs(toolpath)) {
      return;
    }
    toolpath.tabs = [];

    if (toolpath.previewContours.length === 1) {
      const contour = toolpath.previewContours[0];
      const bounds = boundsOfPoints(contour);
      const targets = [
        { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY },
        { x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2 },
        { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY },
        { x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2 },
      ];
      for (const target of targets) {
        const nearest = nearestPointOnPolyline(contour, target);
        if (nearest) {
          toolpath.tabs.push({
            contourIndex: 0,
            along: nearest.along,
            point: nearest.point,
          });
        }
      }
    } else {
      for (let contourIndex = 0; contourIndex < toolpath.previewContours.length; contourIndex += 1) {
        const contour = toolpath.previewContours[contourIndex];
        const total = polylineLength(contour);
        if (total <= 0) {
          continue;
        }
        for (const fraction of [0.25, 0.75]) {
          const along = total * fraction;
          toolpath.tabs.push({
            contourIndex,
            along,
            point: pointAtDistance(contour, along),
          });
        }
      }
    }
  }

  function clearTabPressState() {
    if (state.tabPress?.timerId) {
      window.clearTimeout(state.tabPress.timerId);
    }
    state.tabPress = null;
  }

  function deleteTab(toolpath, index) {
    if (!toolpath?.tabs[index]) {
      return;
    }
    toolpath.tabs.splice(index, 1);
    clearTabPressState();
    state.draggingTab = null;
    refreshToolpathUi();
    draw();
  }

  function updateCanvasCursor(screenPoint = null) {
    CanvasView.updateCanvasCursor({
      canvas,
      state,
      screenPoint,
      findTabHit,
      findLoopHit,
    });
  }

  function operationUsesTabs(...args) {
    return CamOps.operationUsesTabs(...args);
  }

  function isVCarveEngineReady(...args) {
    return CamOps.isVCarveEngineReady(...args);
  }

  function tabTopDepth(...args) {
    return CamOps.tabTopDepth(...args);
  }

  function buildGcode() {
    return CamOps.buildGcode({
      toolpaths: getRenderableToolpaths(),
      fileName: state.fileName,
      forcePolylineArcs: ui.forcePolylineArcsInput.checked,
    });
  }

  function formatNumber(...args) {
    return CamOps.formatNumber(...args);
  }

  function downloadTextFile(name, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  ui.loadSampleBtn.addEventListener("click", loadBundledSample);
  ui.toggleSettingsBtn.addEventListener("click", () => {
    ui.globalSettingsSection.classList.toggle("d-none");
  });
  for (const option of ui.operationOptions) {
    option.addEventListener("click", () => {
      ui.toolpathTypeInput.value = option.dataset.operation;
      refreshOperationUi();
      refreshToolpathFieldVisibility();
      rebuildDraftToolpath();
      refreshToolpathUi();
      draw();
    });
  }
  [
    ui.toolDiameterInput,
    ui.cutterAngleInput,
    ui.overlapInput,
    ui.passDepthInput,
    ui.tabWidthInput,
    ui.safeZInput,
    ui.feedRateInput,
    ui.plungeRateInput,
    ui.spindleInput,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      rebuildDraftToolpath();
      refreshToolpathUi();
      draw();
    });
  });
  ui.cutDepthInput.addEventListener("input", () => {
    syncAutoTabHeight();
    rebuildDraftToolpath();
    refreshToolpathUi();
    draw();
  });
  ui.tabHeightInput.addEventListener("input", () => {
    const cutDepth = Number.parseFloat(ui.cutDepthInput.value) || 18;
    const current = Number.parseFloat(ui.tabHeightInput.value) || getDefaultTabHeight(cutDepth);
    state.autoTabHeight = Math.abs(current - getDefaultTabHeight(cutDepth)) < 0.0001;
    rebuildDraftToolpath();
    refreshToolpathUi();
    draw();
  });
  ui.zoomFitBtn.addEventListener("click", () => {
    fitCameraToBounds(state.bounds);
    rebuildLoopPaths();
    draw();
  });
  ui.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    if (/\.svg$/i.test(file.name) || /^\s*<svg[\s>]/i.test(text)) {
      loadSvgText(text, file.name);
      return;
    }
    loadDxfText(text, file.name);
  });
  ui.toolpathForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await rebuildDraftToolpath();
    commitDraftToolpath();
    refreshSelectionUi();
    refreshToolpathUi();
    draw();
  });
  ui.cancelEditBtn.addEventListener("click", () => {
    clearToolpathEditing();
    clearDraftToolpath();
    state.addTabsMode = false;
    refreshSelectionUi();
    refreshToolpathUi();
    draw();
  });
  ui.addTabsBtn.addEventListener("click", () => {
    if (state.editingToolpathId || state.draftToolpath || !getTabEligibleToolpaths().length) {
      state.addTabsMode = false;
      refreshToolpathUi();
      draw();
      return;
    }
    state.addTabsMode = !state.addTabsMode;
    refreshToolpathUi();
    draw();
  });
  ui.removeTabsBtn.addEventListener("click", () => {
    const active = getActiveToolpath();
    if (!active || !operationUsesTabs(active)) {
      return;
    }
    if (!window.confirm(`Clear all tabs from ${active.label}?`)) {
      return;
    }
    active.tabs = [];
    refreshToolpathUi();
    draw();
  });
  ui.generateGcodeBtn.addEventListener("click", () => {
    const gcode = buildGcode();
    const fileName = (state.fileName || "job").replace(/\.dxf$/i, "");
    downloadTextFile(`${fileName}.nc`, gcode);
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const before = screenToWorld({ x: event.offsetX, y: event.offsetY });
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    state.camera.zoom = Math.max(0.01, Math.min(500, state.camera.zoom * zoomFactor));
    const after = screenToWorld({ x: event.offsetX, y: event.offsetY });
    state.camera.panX += after.x - before.x;
    state.camera.panY += after.y - before.y;
    rebuildLoopPaths();
    draw();
  }, { passive: false });

  canvas.addEventListener("mousedown", (event) => {
    const point = { x: event.offsetX, y: event.offsetY };
    const tabHit = findTabHit(point);
    if (tabHit) {
      if (event.button === 2) {
        clearTabPressState();
        deleteTab(tabHit.toolpath, tabHit.index);
        state.hoveredTab = null;
        updateCanvasCursor(point);
        return;
      }
      clearTabPressState();
      state.tabPress = {
        toolpath: tabHit.toolpath,
        index: tabHit.index,
        startPoint: point,
        timerId: window.setTimeout(() => {
          const press = state.tabPress;
          if (!press) {
            return;
          }
          deleteTab(press.toolpath, press.index);
        }, TAB_DELETE_HOLD_MS),
      };
      updateCanvasCursor(point);
      return;
    }
    if (event.button === 1 || event.button === 2 || event.shiftKey) {
      state.dragPan = {
        x: event.clientX,
        y: event.clientY,
        panX: state.camera.panX,
        panY: state.camera.panY,
      };
      updateCanvasCursor(point);
      return;
    }
    if (state.addTabsMode) {
      updateHoveredTabCandidate(point);
      addTabAtHoveredCandidate();
      return;
    }
    if (event.button === 0) {
      state.marquee = {
        start: point,
        current: point,
        active: false,
        append: event.ctrlKey || event.metaKey,
      };
    }
  });

  canvas.addEventListener("mousemove", (event) => {
    const point = { x: event.offsetX, y: event.offsetY };
    if (state.tabPress) {
      const moveDistance = Math.hypot(point.x - state.tabPress.startPoint.x, point.y - state.tabPress.startPoint.y);
      if (moveDistance >= TAB_DELETE_MOVE_THRESHOLD) {
        const press = state.tabPress;
        clearTabPressState();
        state.draggingTab = {
          toolpath: press.toolpath,
          index: press.index,
        };
      } else {
        updateCanvasCursor(point);
        return;
      }
    }
    if (state.draggingTab) {
      state.hoveredTab = state.draggingTab;
      const active = state.draggingTab.toolpath;
      const world = screenToWorld(point);
      const contour = active.previewContours[active.tabs[state.draggingTab.index].contourIndex];
      const nearest = nearestPointOnPolyline(contour, world);
      if (nearest) {
        active.tabs[state.draggingTab.index].along = nearest.along;
        active.tabs[state.draggingTab.index].point = nearest.point;
        updateCanvasCursor(point);
        draw();
      }
      return;
    }
    if (state.dragPan) {
      const rect = canvas.getBoundingClientRect();
      const dx = (event.clientX - state.dragPan.x) / state.camera.zoom;
      const dy = (event.clientY - state.dragPan.y) / state.camera.zoom;
      state.camera.panX = state.dragPan.panX + dx;
      state.camera.panY = state.dragPan.panY - dy;
      rebuildLoopPaths();
      updateCanvasCursor(point);
      draw();
      return;
    }
    if (state.marquee) {
      state.marquee.current = point;
      const dragDistance = Math.hypot(point.x - state.marquee.start.x, point.y - state.marquee.start.y);
      if (dragDistance >= MARQUEE_DRAG_THRESHOLD) {
        state.marquee.active = true;
        state.marqueePreviewLoopIds = loopIdsInMarquee(state.marquee.start, point);
      } else {
        state.marqueePreviewLoopIds.clear();
      }
      updateCanvasCursor(point);
      draw();
      return;
    }
    state.hoveredTab = findTabHit(point);
    state.hoveredLoopId = state.addTabsMode ? null : findLoopHit(point)?.id || null;
    updateHoveredTabCandidate(point);
    updateCanvasCursor(point);
    draw();
  });

  canvas.addEventListener("mouseup", () => {
    if (state.marquee) {
      const { start, current, active, append } = state.marquee;
      state.marquee = null;
      state.marqueePreviewLoopIds.clear();
      if (active) {
        pickLoopsInMarquee(start, current, append);
      } else {
        pickLoopAtScreenPoint(current, append);
      }
      return;
    }
    clearTabPressState();
    state.dragPan = null;
    state.draggingTab = null;
    state.hoveredTab = null;
    updateCanvasCursor();
    draw();
  });

  canvas.addEventListener("mouseleave", () => {
    clearTabPressState();
    state.hoveredTab = null;
    state.hoveredTabCandidate = null;
    state.hoveredLoopId = null;
    state.dragPan = null;
    state.draggingTab = null;
    state.marquee = null;
    state.marqueePreviewLoopIds.clear();
    updateCanvasCursor();
    draw();
  });

  canvas.addEventListener("contextmenu", (event) => {
    const point = { x: event.offsetX, y: event.offsetY };
    const tabHit = findTabHit(point);
    if (tabHit) {
      clearTabPressState();
      deleteTab(tabHit.toolpath, tabHit.index);
      state.hoveredTab = null;
      updateCanvasCursor(point);
    }
    event.preventDefault();
  });

  window.__camCanvasDebug = {
    state,
    ui,
    loadDxfText,
    loadSvgText,
    rebuildDraftToolpath,
    buildGcode,
    commitDraftToolpath,
    refreshSelectionUi,
    refreshToolpathUi,
    draw,
    getRenderableToolpaths,
    getActiveToolpath,
    getEditingToolpath,
    getInteractiveToolpath,
    isVCarveEngineReady,
    async loadBundledSample() {
      await loadBundledSample();
      return this.snapshot();
    },
    selectLoopsByIndex(indexes) {
      state.selectedLoopIds.clear();
      for (const index of indexes) {
        const loop = state.loops[index];
        if (loop) {
          state.selectedLoopIds.add(loop.id);
        }
      }
      refreshSelectionUi();
      refreshToolpathUi();
      draw();
      return this.snapshot();
    },
    setOperation(operation) {
      ui.toolpathTypeInput.value = operation;
      refreshOperationUi();
      refreshToolpathFieldVisibility();
      return operation;
    },
    setFormValues(values) {
      const mapping = {
        toolDiameter: ui.toolDiameterInput,
        cutterAngle: ui.cutterAngleInput,
        overlapPercent: ui.overlapInput,
        cutDepth: ui.cutDepthInput,
        passDepth: ui.passDepthInput,
        tabWidth: ui.tabWidthInput,
        tabHeight: ui.tabHeightInput,
        safeZ: ui.safeZInput,
        feedRate: ui.feedRateInput,
        plungeRate: ui.plungeRateInput,
        spindle: ui.spindleInput,
      };
      for (const [key, value] of Object.entries(values || {})) {
        const input = mapping[key];
        if (input) {
          input.value = value;
        }
      }
      return this.snapshot();
    },
    async buildDraft() {
      await rebuildDraftToolpath();
      refreshToolpathUi();
      draw();
      return this.snapshot();
    },
    applyDraft() {
      commitDraftToolpath();
      refreshSelectionUi();
      refreshToolpathUi();
      draw();
      return this.snapshot();
    },
    snapshot() {
      return {
        status: ui.statusText.textContent,
        loops: state.loops.length,
        selected: Array.from(state.selectedLoopIds),
        draft: state.draftToolpath
          ? {
            operation: state.draftToolpath.operation,
            previewContours: state.draftToolpath.previewContours.length,
            motionPaths: state.draftToolpath.motionPaths.length,
            firstMotionPathPoints: state.draftToolpath.motionPaths[0]?.points?.length || 0,
            cardMeta: state.draftToolpath.cardMeta,
          }
          : null,
        toolpaths: state.toolpaths.map((toolpath) => ({
          id: toolpath.id,
          label: toolpath.label,
          operation: toolpath.operation,
          previewContours: toolpath.previewContours.length,
          motionPaths: toolpath.motionPaths.length,
        })),
      };
    },
  };

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
})();

