import {
  MARQUEE_DRAG_THRESHOLD,
  TAB_DELETE_HOLD_MS,
  TAB_DELETE_MOVE_THRESHOLD,
} from "./src/constants.js?v=20260730-vcarve12";
import { parseDxf as parseDxfFile } from "./src/dxf.js?v=20260730-vcarve12";
import { parseSvg as parseSvgFile } from "./src/svg.js?v=20260730-vcarve12";
import * as Paths from "./src/paths.js?v=20260730-vcarve12";
import * as CamOps from "./src/cam-ops.js?v=20260730-vcarve12";
import * as UiState from "./src/ui-state.js?v=20260730-vcarve12";
import * as CanvasView from "./src/canvas-view.js?v=20260730-vcarve12";
import * as CamWorkerClient from "./src/cam-worker-client.js?v=20260731-worker1";

(function () {

  const canvas = document.getElementById("drawingCanvas");
  const ctx = canvas.getContext("2d");
  const topRulerCanvas = document.getElementById("topRulerCanvas");
  const topRulerCtx = topRulerCanvas?.getContext("2d");
  const leftRulerCanvas = document.getElementById("leftRulerCanvas");
  const leftRulerCtx = leftRulerCanvas?.getContext("2d");
  let canvasResizeObserver = null;
  let drawFramePending = false;
  let loopPathsDirty = true;
  let navigationDetailTimerId = null;
  let workerProgressAnimationFrame = null;

  const ui = {
    projectTitle: document.getElementById("projectTitle"),
    loadSampleBtn: document.getElementById("loadSampleBtn"),
    browseVectorBtn: document.getElementById("browseVectorBtn"),
    openFileBtn: document.getElementById("openFileBtn"),
    fileInput: document.getElementById("fileInput"),
    zoomFitBtn: document.getElementById("zoomFitBtn"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    workerBadge: document.getElementById("workerBadge"),
    workerPercent: document.getElementById("workerPercent"),
    statusText: document.getElementById("statusText"),
    toastContainer: document.getElementById("toastContainer"),
    canvasWrap: document.getElementById("canvasWrap"),
    vectorActionGroup: document.getElementById("vectorActionGroup"),
    topRulerCanvas,
    leftRulerCanvas,
    canvasEmptyState: document.getElementById("canvasEmptyState"),
    originToggleButtons: Array.from(document.querySelectorAll(".origin-toggle-btn")),
    transformToolButtons: Array.from(document.querySelectorAll(".transform-tool-btn")),
    deleteVectorsBtn: document.getElementById("deleteVectorsBtn"),
    transformSidebarPanel: document.getElementById("transformSidebarPanel"),
    transformInspector: document.getElementById("transformInspector"),
    transformMoveGroup: document.getElementById("transformMoveGroup"),
    transformPositionXInput: document.getElementById("transformPositionXInput"),
    transformPositionYInput: document.getElementById("transformPositionYInput"),
    applyTransformMoveBtn: document.getElementById("applyTransformMoveBtn"),
    transformAngleGroup: document.getElementById("transformAngleGroup"),
    transformAngleInput: document.getElementById("transformAngleInput"),
    applyTransformAngleBtn: document.getElementById("applyTransformAngleBtn"),
    transformSizeGroup: document.getElementById("transformSizeGroup"),
    transformWidthInput: document.getElementById("transformWidthInput"),
    transformHeightInput: document.getElementById("transformHeightInput"),
    applyTransformSizeBtn: document.getElementById("applyTransformSizeBtn"),
    transformAspectLockBtn: document.getElementById("transformAspectLockBtn"),
    transformAspectLockIcon: document.getElementById("transformAspectLockIcon"),
    workflowSteps: Array.from(document.querySelectorAll(".workflow-step")),
    selectionCount: document.getElementById("selectionCount"),
    selectionHeading: document.getElementById("selectionHeading"),
    selectionEmpty: document.getElementById("selectionEmpty"),
    toolpathForm: document.getElementById("toolpathForm"),
    toolpathFormMode: document.getElementById("toolpathFormMode"),
    toggleSettingsBtn: document.getElementById("toggleSettingsBtn"),
    globalSettingsSection: document.getElementById("globalSettingsSection"),
    toolpathTypeInput: document.getElementById("toolpathTypeInput"),
    operationOptions: Array.from(document.querySelectorAll(".operation-option")),
    toolLibraryToggle: document.getElementById("toolLibraryToggle"),
    toolLibraryMenu: document.getElementById("toolLibraryMenu"),
    toolLibraryList: document.getElementById("toolLibraryList"),
    toolLibraryPreview: document.getElementById("toolLibraryPreview"),
    toolLibraryPreviewName: document.getElementById("toolLibraryPreviewName"),
    toolLibraryPreviewMeta: document.getElementById("toolLibraryPreviewMeta"),
    toolLibrarySummary: document.getElementById("toolLibrarySummary"),
    toolLibrarySummaryImage: document.getElementById("toolLibrarySummaryImage"),
    toolLibrarySummaryName: document.getElementById("toolLibrarySummaryName"),
    toolLibrarySummaryMeta: document.getElementById("toolLibrarySummaryMeta"),
    toolLibrarySummaryLink: document.getElementById("toolLibrarySummaryLink"),
    toolLibraryClearBtn: document.getElementById("toolLibraryClearBtn"),
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
    pointer: {
      x: 24,
      y: 24,
    },
    dragPan: null,
    bounds: null,
    importTranslation: { x: 0, y: 0 },
    editingToolpathId: null,
    draftToolpath: null,
    autoTabHeight: true,
    draftBuildToken: 0,
    showOrigin: true,
    dragImportActive: false,
    isNavigatingView: false,
    transformTool: null,
    geometryTransform: null,
    transformingGeometry: false,
    transformSizeLastEdited: "width",
    transformAspectLocked: true,
    selectionFrameAngles: new Map(),
    workerJobs: new Map(),
    toolLibrary: {
      tools: [],
      byId: new Map(),
      loaded: false,
    },
    selectedLibraryToolId: null,
    selectedLibraryToolMeta: null,
    history: {
      undo: [],
      redo: [],
      limit: 60,
    },
  };

  function deepClone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function updateDockStatus() {
    if (!state.loops.length) {
      ui.statusText.textContent = "Import a DXF or SVG to begin.";
      return;
    }
    if (!state.toolpaths.length) {
      ui.statusText.textContent = "Add a toolpath to enable export.";
      return;
    }
    const count = state.toolpaths.length;
    ui.statusText.textContent = `${count} toolpath${count === 1 ? "" : "s"} ready to export.`;
  }

  function showToast(message, variant = "danger", options = {}) {
    if (!message) {
      return;
    }
    const toast = document.createElement("div");
    const title = options.title || (variant === "warning" ? "Warning" : variant === "success" ? "Done" : "Error");
    toast.className = `toast align-items-center text-bg-${variant} border-0 show`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <strong class="me-2">${title}</strong>${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button>
      </div>
    `;
    const removeToast = () => {
      toast.classList.remove("show");
      window.setTimeout(() => {
        toast.remove();
      }, 180);
    };
    toast.querySelector(".btn-close")?.addEventListener("click", removeToast);
    ui.toastContainer.appendChild(toast);
    const duration = options.duration ?? 4200;
    window.setTimeout(removeToast, duration);
  }

  function setWorkflowStep(stepName, status) {
    const step = ui.workflowSteps.find((candidate) => candidate.dataset.step === stepName);
    if (!step) {
      return;
    }
    step.classList.toggle("is-active", status === "active");
    step.classList.toggle("is-complete", status === "complete");
  }

  function loopSignature(loop) {
    return (loop?.sourceEntityIndexes || [])
      .slice()
      .sort((a, b) => a - b)
      .join(",");
  }

  function selectedLoopSignatures() {
    return new Set(
      state.loops
        .filter((loop) => state.selectedLoopIds.has(loop.id))
        .map(loopSignature)
        .filter(Boolean)
    );
  }

  function selectedEntityKeyFromIndexes(indexes) {
    return indexes.slice().sort((a, b) => a - b).join(",");
  }

  function getSelectedEntityKey() {
    return selectedEntityKeyFromIndexes(getSelectedEntityIndexes());
  }

  function getSelectedEntityIndexes() {
    const indexes = new Set();
    for (const loop of state.loops) {
      if (!state.selectedLoopIds.has(loop.id)) {
        continue;
      }
      for (const index of loop.sourceEntityIndexes || []) {
        indexes.add(index);
      }
    }
    return Array.from(indexes).sort((a, b) => a - b);
  }

  function rebuildLoopsFromEntities(selectionSignatures = new Set()) {
    state.loops = buildLoops(state.entities);
    loopPathsDirty = true;
    state.bounds = mergeBounds(state.loops.map((loop) => loop.bounds));
    state.selectedLoopIds.clear();
    if (selectionSignatures.size) {
      for (const loop of state.loops) {
        if (selectionSignatures.has(loopSignature(loop))) {
          state.selectedLoopIds.add(loop.id);
        }
      }
    }
  }

  function extractToolpathConfig(toolpath) {
    return {
      operation: toolpath.operation,
      toolDiameter: toolpath.toolDiameter,
      toolRadius: toolpath.toolRadius,
      cutterAngle: toolpath.cutterAngle,
      overlapPercent: toolpath.overlapPercent,
      cutDepth: toolpath.cutDepth,
      passDepth: toolpath.passDepth,
      tabWidth: toolpath.tabWidth,
      tabHeight: toolpath.tabHeight,
      safeZ: toolpath.safeZ,
      feedRate: toolpath.feedRate,
      plungeRate: toolpath.plungeRate,
      spindle: toolpath.spindle,
      libraryToolId: toolpath.libraryToolId || null,
      libraryToolName: toolpath.libraryToolName || "",
      libraryToolVendor: toolpath.libraryToolVendor || "",
      libraryToolImage: toolpath.libraryToolImage || "",
      libraryToolUrl: toolpath.libraryToolUrl || "",
      libraryToolDescription: toolpath.libraryToolDescription || "",
    };
  }

  function snapshotToolpathsForRebuild() {
    return state.toolpaths.map((toolpath) => ({
      id: toolpath.id,
      label: toolpath.label,
      config: extractToolpathConfig(toolpath),
      sourceLoopSignatures: toolpath.sourceLoops.map(loopSignature).filter(Boolean),
      tabs: toolpath.tabs.map((tab) => ({ ...tab, point: tab.point ? clonePoint(tab.point) : null })),
    }));
  }

  function snapshotToolpathsForHistory() {
    return state.toolpaths.map((toolpath) => ({
      id: toolpath.id,
      label: toolpath.label,
      operation: toolpath.operation,
      operationLabel: toolpath.operationLabel,
      cardMeta: toolpath.cardMeta,
      toolDiameter: toolpath.toolDiameter,
      toolRadius: toolpath.toolRadius,
      cutterAngle: toolpath.cutterAngle,
      overlapPercent: toolpath.overlapPercent,
      cutDepth: toolpath.cutDepth,
      passDepth: toolpath.passDepth,
      passDepths: [...toolpath.passDepths],
      tabWidth: toolpath.tabWidth,
      tabHeight: toolpath.tabHeight,
      safeZ: toolpath.safeZ,
      feedRate: toolpath.feedRate,
      plungeRate: toolpath.plungeRate,
      spindle: toolpath.spindle,
      libraryToolId: toolpath.libraryToolId || null,
      libraryToolName: toolpath.libraryToolName || "",
      libraryToolVendor: toolpath.libraryToolVendor || "",
      libraryToolImage: toolpath.libraryToolImage || "",
      libraryToolUrl: toolpath.libraryToolUrl || "",
      libraryToolDescription: toolpath.libraryToolDescription || "",
      previewContours: deepClone(toolpath.previewContours || []),
      motionPaths: deepClone(toolpath.motionPaths || []),
      tabs: deepClone(toolpath.tabs || []),
      sourceLoopSignatures: toolpath.sourceLoops.map(loopSignature).filter(Boolean),
    }));
  }

  function restoreToolpathsFromHistory(toolpathSnapshots) {
    const loopMap = new Map(state.loops.map((loop) => [loopSignature(loop), loop]));
    return (toolpathSnapshots || []).map((snapshot) => ({
      ...deepClone(snapshot),
      sourceLoops: (snapshot.sourceLoopSignatures || [])
        .map((signature) => loopMap.get(signature))
        .filter(Boolean),
    }));
  }

  function captureHistorySnapshot() {
    return {
      fileName: state.fileName,
      entities: deepClone(state.entities),
      toolpaths: snapshotToolpathsForHistory(),
      selectedLoopSignatures: Array.from(selectedLoopSignatures()),
      activeToolpathId: state.activeToolpathId,
      editingToolpathId: state.editingToolpathId,
      selectionFrameAngles: Array.from(state.selectionFrameAngles.entries()),
      selectedLibraryToolId: state.selectedLibraryToolId,
      selectedLibraryToolMeta: deepClone(state.selectedLibraryToolMeta),
      autoTabHeight: state.autoTabHeight,
      toolpathFormValues: {
        operation: ui.toolpathTypeInput.value,
        toolDiameter: ui.toolDiameterInput.value,
        cutterAngle: ui.cutterAngleInput.value,
        overlapPercent: ui.overlapInput.value,
        cutDepth: ui.cutDepthInput.value,
        passDepth: ui.passDepthInput.value,
        tabWidth: ui.tabWidthInput.value,
        tabHeight: ui.tabHeightInput.value,
        safeZ: ui.safeZInput.value,
        feedRate: ui.feedRateInput.value,
        plungeRate: ui.plungeRateInput.value,
        spindle: ui.spindleInput.value,
      },
    };
  }

  function snapshotsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function pushHistorySnapshot(beforeSnapshot) {
    if (!beforeSnapshot) {
      return;
    }
    const afterSnapshot = captureHistorySnapshot();
    if (snapshotsEqual(beforeSnapshot, afterSnapshot)) {
      return;
    }
    state.history.undo.push(beforeSnapshot);
    if (state.history.undo.length > state.history.limit) {
      state.history.undo.shift();
    }
    state.history.redo = [];
  }

  function restoreHistorySnapshot(snapshot) {
    if (!snapshot) {
      return;
    }
    state.fileName = snapshot.fileName || "";
    state.entities = deepClone(snapshot.entities || []);
    state.selectionFrameAngles = new Map(snapshot.selectionFrameAngles || []);
    state.activeToolpathId = snapshot.activeToolpathId || null;
    state.editingToolpathId = snapshot.editingToolpathId || null;
    state.selectedLibraryToolId = snapshot.selectedLibraryToolId || null;
    state.selectedLibraryToolMeta = deepClone(snapshot.selectedLibraryToolMeta || null);
    state.autoTabHeight = snapshot.autoTabHeight !== false;
    state.addTabsMode = false;
    state.hoveredTabCandidate = null;
    state.hoveredTab = null;
    state.draggingTab = null;
    state.tabPress = null;
    state.hoveredLoopId = null;
    state.marquee = null;
    state.marqueePreviewLoopIds.clear();
    state.geometryTransform = null;
    state.transformingGeometry = false;
    state.transformTool = null;
    state.draftBuildToken += 1;
    clearDraftToolpath();
    rebuildLoopsFromEntities(new Set(snapshot.selectedLoopSignatures || []));
    state.toolpaths = restoreToolpathsFromHistory(snapshot.toolpaths);
    if (!state.toolpaths.some((toolpath) => toolpath.id === state.activeToolpathId)) {
      state.activeToolpathId = state.toolpaths[0]?.id || null;
    }
    if (!state.toolpaths.some((toolpath) => toolpath.id === state.editingToolpathId)) {
      state.editingToolpathId = null;
    }
    const formValues = snapshot.toolpathFormValues || {};
    ui.toolpathTypeInput.value = formValues.operation || ui.toolpathTypeInput.value;
    ui.toolDiameterInput.value = formValues.toolDiameter || ui.toolDiameterInput.value;
    ui.cutterAngleInput.value = formValues.cutterAngle || ui.cutterAngleInput.value;
    ui.overlapInput.value = formValues.overlapPercent || ui.overlapInput.value;
    ui.cutDepthInput.value = formValues.cutDepth || ui.cutDepthInput.value;
    ui.passDepthInput.value = formValues.passDepth || ui.passDepthInput.value;
    ui.tabWidthInput.value = formValues.tabWidth || ui.tabWidthInput.value;
    ui.tabHeightInput.value = formValues.tabHeight || ui.tabHeightInput.value;
    ui.safeZInput.value = formValues.safeZ || ui.safeZInput.value;
    ui.feedRateInput.value = formValues.feedRate || ui.feedRateInput.value;
    ui.plungeRateInput.value = formValues.plungeRate || ui.plungeRateInput.value;
    ui.spindleInput.value = formValues.spindle || ui.spindleInput.value;
    refreshOperationUi();
    refreshToolpathFieldVisibility();
    refreshToolLibraryUi();
    updateTransformToolUi();
    refreshWorkspaceUi();
    refreshSelectionUi();
    refreshToolpathUi();
    draw();
  }

  function undoHistory() {
    if (!state.history.undo.length) {
      return;
    }
    const current = captureHistorySnapshot();
    const snapshot = state.history.undo.pop();
    state.history.redo.push(current);
    restoreHistorySnapshot(snapshot);
  }

  function redoHistory() {
    if (!state.history.redo.length) {
      return;
    }
    const current = captureHistorySnapshot();
    const snapshot = state.history.redo.pop();
    state.history.undo.push(current);
    restoreHistorySnapshot(snapshot);
  }

  function normalizeRadians(angle) {
    let value = angle % (Math.PI * 2);
    if (value <= -Math.PI) {
      value += Math.PI * 2;
    } else if (value > Math.PI) {
      value -= Math.PI * 2;
    }
    return value;
  }

  function getSelectionPoints() {
    return state.loops
      .filter((loop) => state.selectedLoopIds.has(loop.id))
      .flatMap((loop) => loop.points || []);
  }

  function getSelectionFrame() {
    const selectedEntityKey = getSelectedEntityKey();
    const points = getSelectionPoints();
    if (points.length < 2) {
      return null;
    }
    let sumX = 0;
    let sumY = 0;
    for (const point of points) {
      sumX += point.x;
      sumY += point.y;
    }
    const center = { x: sumX / points.length, y: sumY / points.length };
    let covXX = 0;
    let covYY = 0;
    let covXY = 0;
    for (const point of points) {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      covXX += dx * dx;
      covYY += dy * dy;
      covXY += dx * dy;
    }
    const liveTransformAngle = state.transformingGeometry
      && state.geometryTransform?.selectedEntityKey === selectedEntityKey
      && Number.isFinite(state.geometryTransform?.resultAngle)
      ? state.geometryTransform.resultAngle
      : null;
    const angle = liveTransformAngle
      ?? state.selectionFrameAngles.get(selectedEntityKey)
      ?? 0;
    const axisX = { x: Math.cos(angle), y: Math.sin(angle) };
    const axisY = { x: -Math.sin(angle), y: Math.cos(angle) };
    let minU = Number.POSITIVE_INFINITY;
    let maxU = Number.NEGATIVE_INFINITY;
    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const u = dx * axisX.x + dy * axisX.y;
      const v = dx * axisY.x + dy * axisY.y;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const localCenter = { u: (minU + maxU) / 2, v: (minV + maxV) / 2 };
    const frameCenter = {
      x: center.x + axisX.x * localCenter.u + axisY.x * localCenter.v,
      y: center.y + axisX.y * localCenter.u + axisY.y * localCenter.v,
    };
    const toWorld = (u, v) => ({
      x: frameCenter.x + axisX.x * u + axisY.x * v,
      y: frameCenter.y + axisX.y * u + axisY.y * v,
    });
    const width = Math.max(0.0001, maxU - minU);
    const height = Math.max(0.0001, maxV - minV);
    const halfW = width / 2;
    const halfH = height / 2;
    const corners = {
      nw: toWorld(-halfW, halfH),
      ne: toWorld(halfW, halfH),
      se: toWorld(halfW, -halfH),
      sw: toWorld(-halfW, -halfH),
    };
    return {
      key: selectedEntityKey,
      center: frameCenter,
      angle,
      axisX,
      axisY,
      width,
      height,
      corners,
      toWorld,
      toLocal(point) {
        const dx = point.x - frameCenter.x;
        const dy = point.y - frameCenter.y;
        return {
          u: dx * axisX.x + dy * axisX.y,
          v: dx * axisY.x + dy * axisY.y,
        };
      },
    };
  }

  function getAxisAlignedSelectionFrame() {
    const selectedEntityIndexes = getSelectedEntityIndexes();
    if (!selectedEntityIndexes.length) {
      return null;
    }
    const bounds = boundsOfEntities(selectedEntityIndexes.map((index) => state.entities[index]).filter(Boolean));
    if (!bounds) {
      return null;
    }
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
    const width = Math.max(0.0001, bounds.maxX - bounds.minX);
    const height = Math.max(0.0001, bounds.maxY - bounds.minY);
    const halfW = width / 2;
    const halfH = height / 2;
    const toWorld = (u, v) => ({
      x: center.x + u,
      y: center.y + v,
    });
    return {
      key: getSelectedEntityKey(),
      center,
      angle: 0,
      axisX: { x: 1, y: 0 },
      axisY: { x: 0, y: 1 },
      width,
      height,
      corners: {
        nw: toWorld(-halfW, halfH),
        ne: toWorld(halfW, halfH),
        se: toWorld(halfW, -halfH),
        sw: toWorld(-halfW, -halfH),
      },
      toWorld,
      toLocal(point) {
        return {
          u: point.x - center.x,
          v: point.y - center.y,
        };
      },
    };
  }

  function buildSelectionTransformOverlay() {
    if (!state.selectedLoopIds.size || state.addTabsMode || !state.transformTool) {
      return null;
    }
    const frame = state.transformTool === "move"
      ? getAxisAlignedSelectionFrame()
      : getSelectionFrame();
    if (!frame) {
      return null;
    }
    const corners = {
      nw: worldToScreen(frame.corners.nw),
      ne: worldToScreen(frame.corners.ne),
      se: worldToScreen(frame.corners.se),
      sw: worldToScreen(frame.corners.sw),
    };
    const center = worldToScreen(frame.center);
    const polygon = [corners.nw, corners.ne, corners.se, corners.sw];
    const handles = [
      { key: "nw", ...corners.nw, world: frame.corners.nw },
      { key: "ne", ...corners.ne, world: frame.corners.ne },
      { key: "se", ...corners.se, world: frame.corners.se },
      { key: "sw", ...corners.sw, world: frame.corners.sw },
    ];
    const rotateHandles = handles.map((handle) => {
      const dx = handle.x - center.x;
      const dy = handle.y - center.y;
      const length = Math.hypot(dx, dy) || 1;
      const offset = 18;
      return {
        key: handle.key,
        anchor: { x: handle.x, y: handle.y },
        x: handle.x + (dx / length) * offset,
        y: handle.y + (dy / length) * offset,
      };
    });
    return {
      mode: state.transformTool,
      center,
      polygon,
      frame,
      width: frame.width,
      height: frame.height,
      angleDeg: normalizeRadians(frame.angle) * 180 / Math.PI,
      handles,
      rotateHandles,
    };
  }

  function findTransformHit(screenPoint) {
    const overlay = buildSelectionTransformOverlay();
    if (!overlay) {
      return null;
    }
    if (state.transformTool === "scale") {
      for (const handle of overlay.handles) {
        if (Math.hypot(screenPoint.x - handle.x, screenPoint.y - handle.y) <= 10) {
          const cursor = handle.key === "ne" || handle.key === "sw" ? "nesw-resize" : "nwse-resize";
          return { type: "scale", handle, cursor };
        }
      }
    }
    if (state.transformTool === "rotate") {
      for (const handle of overlay.rotateHandles) {
        if (Math.hypot(screenPoint.x - handle.x, screenPoint.y - handle.y) <= 10) {
          return { type: "rotate", handle, cursor: "grab" };
        }
      }
    }
    if (state.transformTool === "move") {
      const worldPoint = screenToWorld(screenPoint);
      const local = overlay.frame.toLocal(worldPoint);
      const withinRect = Math.abs(local.u) <= overlay.width / 2 && Math.abs(local.v) <= overlay.height / 2;
      if (withinRect || state.selectedLoopIds.has(findLoopHit(screenPoint)?.id)) {
        return { type: "move", cursor: "move" };
      }
    }
    return null;
  }

  function updateTransformToolUi() {
    if (!state.selectedLoopIds.size) {
      state.transformTool = null;
    }
    for (const button of ui.transformToolButtons) {
      const active = button.dataset.transformTool === state.transformTool;
      button.classList.toggle("is-active", active);
      button.classList.toggle("btn-primary", active);
      button.classList.toggle("btn-light", !active);
    }
    ui.vectorActionGroup.classList.toggle("d-none", state.selectedLoopIds.size === 0);
    refreshSidebarMode();
  }

  function refreshTransformInspector() {
    const overlay = buildSelectionTransformOverlay();
    const showInspector = Boolean(overlay) && !state.transformingGeometry;
    ui.transformSidebarPanel.classList.toggle("d-none", !showInspector);
    if (!showInspector) {
      return;
    }
    ui.transformMoveGroup.classList.toggle("d-none", state.transformTool !== "move");
    ui.transformAngleGroup.classList.toggle("d-none", state.transformTool !== "rotate");
    ui.transformSizeGroup.classList.toggle("d-none", state.transformTool !== "scale");
    ui.transformAspectLockBtn.classList.toggle("btn-primary", state.transformAspectLocked);
    ui.transformAspectLockBtn.classList.toggle("btn-outline-secondary", !state.transformAspectLocked);
    ui.transformAspectLockIcon.className = state.transformAspectLocked ? "fa-solid fa-link" : "fa-solid fa-link-slash";
    if (state.transformTool === "rotate") {
      ui.transformAngleInput.value = formatNumber(overlay.angleDeg);
    }
    if (state.transformTool === "move") {
      ui.transformPositionXInput.value = formatNumber(overlay.frame.center.x);
      ui.transformPositionYInput.value = formatNumber(overlay.frame.center.y);
    }
    if (state.transformTool === "scale") {
      ui.transformWidthInput.value = formatNumber(overlay.width);
      ui.transformHeightInput.value = formatNumber(overlay.height);
    }
  }

  function refreshSidebarMode() {
    const editing = getEditingToolpath();
    const count = state.selectedLoopIds.size;
    const showTransform = Boolean(state.transformTool) && count > 0;
    ui.selectionCount.textContent = String(count);
    ui.selectionHeading.textContent = showTransform
      ? {
        move: "Move Vectors",
        scale: "Resize Vectors",
        rotate: "Rotate Vectors",
      }[state.transformTool] || "Transform Vectors"
      : editing ? "Edit Toolpath" : "Assign Toolpaths";
    ui.selectionEmpty.classList.toggle("d-none", showTransform || count > 0 || Boolean(editing));
    ui.toolpathForm.classList.toggle("d-none", showTransform || (count === 0 && !editing));
    ui.transformSidebarPanel.classList.toggle("d-none", !showTransform);
    refreshTransformInspector();
  }

  async function deleteSelectedVectors() {
    const entityIndexes = getSelectedEntityIndexes();
    if (!entityIndexes.length) {
      return;
    }
    const label = entityIndexes.length === 1 ? "this segment" : `these ${entityIndexes.length} segments`;
    if (!window.confirm(`Delete ${label}?`)) {
      return;
    }
    const historyBefore = captureHistorySnapshot();
    state.transformTool = null;
    await deleteVectorsByEntityIndexes(entityIndexes);
    pushHistorySnapshot(historyBefore);
    updateTransformToolUi();
  }

  async function deleteVectorsByEntityIndexes(entityIndexes) {
    if (!entityIndexes?.length) {
      return;
    }
    const removed = new Set(entityIndexes);
    const snapshots = snapshotToolpathsForRebuild();
    state.entities = state.entities.filter((_, index) => !removed.has(index));
    state.selectionFrameAngles.clear();
    state.selectedLoopIds.clear();
    state.hoveredLoopId = null;
    state.activeToolpathId = null;
    clearToolpathEditing();
    clearDraftToolpath();
    rebuildLoopsFromEntities(new Set());

    const loopMap = new Map(state.loops.map((loop) => [loopSignature(loop), loop]));
    const rebuiltToolpaths = [];
    const impacted = snapshots.some((snapshot) => snapshot.sourceLoopSignatures.some((signature) => !loopMap.has(signature)));
    if (snapshots.length && impacted) {
      startWorkerJob("delete", {
        label: "Updating toolpaths",
        percent: 8,
        priority: 1,
      });
      try {
        for (let index = 0; index < snapshots.length; index += 1) {
          const snapshot = snapshots[index];
          const sourceLoops = snapshot.sourceLoopSignatures
            .map((signature) => loopMap.get(signature))
            .filter(Boolean);
          if (!sourceLoops.length) {
            continue;
          }
          updateWorkerJob("delete", {
            label: "Updating toolpaths",
            percent: 12 + Math.round((index / Math.max(1, snapshots.length)) * 80),
            priority: 1,
          });
          const rebuilt = await createToolpathFromLoopsAsync(sourceLoops, snapshot.config, {
            id: snapshot.id,
            label: snapshot.label,
          });
          rebuilt.sourceLoops = sourceLoops;
          rebuilt.tabs = normalizeTabsForToolpath(rebuilt, snapshot.tabs);
          rebuiltToolpaths.push(rebuilt);
        }
        state.toolpaths = rebuiltToolpaths;
        state.activeToolpathId = rebuiltToolpaths[0]?.id || null;
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to update toolpaths after deleting vectors.", "danger");
      } finally {
        finishWorkerJob("delete");
      }
    } else if (snapshots.length) {
      state.toolpaths = state.toolpaths.slice();
    }

    refreshWorkspaceUi();
    refreshToolpathUi();
    refreshSelectionUi();
    draw();
  }

  function captureSelectionTransformContext() {
    const selectedEntityIndexes = getSelectedEntityIndexes();
    if (!selectedEntityIndexes.length) {
      return null;
    }
    return {
      initialEntities: state.entities.slice(),
      selectedEntityIndexes,
      selectedEntityKey: selectedEntityKeyFromIndexes(selectedEntityIndexes),
      selectionSignatures: selectedLoopSignatures(),
      toolpathSnapshots: snapshotToolpathsForRebuild(),
      activeToolpathId: state.activeToolpathId,
    };
  }

  async function applySelectionTransformAndRebuild(matrix = null, context = null) {
    const transformContext = context || captureSelectionTransformContext();
    if (!transformContext) {
      return;
    }
    if (matrix) {
      applyMatrixToSelectedEntities(matrix, transformContext);
    }
    if (Number.isFinite(transformContext.resultAngle)) {
      state.selectionFrameAngles.set(transformContext.selectedEntityKey, normalizeRadians(transformContext.resultAngle));
    } else if (!state.selectionFrameAngles.has(transformContext.selectedEntityKey)) {
      const currentFrame = getSelectionFrame();
      if (currentFrame) {
        state.selectionFrameAngles.set(transformContext.selectedEntityKey, normalizeRadians(currentFrame.angle));
      }
    }
    const loopMap = new Map(state.loops.map((loop) => [loopSignature(loop), loop]));
    const snapshots = transformContext.toolpathSnapshots;
    if (snapshots.length) {
      startWorkerJob("transform", {
        label: "Updating toolpaths",
        percent: 6,
        priority: 1,
      });
      try {
        const rebuiltToolpaths = [];
        for (let index = 0; index < snapshots.length; index += 1) {
          const snapshot = snapshots[index];
          const sourceLoops = snapshot.sourceLoopSignatures
            .map((signature) => loopMap.get(signature))
            .filter(Boolean);
          if (!sourceLoops.length) {
            continue;
          }
          updateWorkerJob("transform", {
            label: "Updating toolpaths",
            percent: 10 + Math.round((index / Math.max(1, snapshots.length)) * 80),
            priority: 1,
          });
          const rebuilt = await createToolpathFromLoopsAsync(sourceLoops, snapshot.config, {
            id: snapshot.id,
            label: snapshot.label,
          });
          rebuilt.sourceLoops = sourceLoops;
          rebuilt.tabs = normalizeTabsForToolpath(rebuilt, snapshot.tabs);
          rebuiltToolpaths.push(rebuilt);
        }
        state.toolpaths = rebuiltToolpaths;
        state.activeToolpathId = rebuiltToolpaths.some((toolpath) => toolpath.id === transformContext.activeToolpathId)
          ? transformContext.activeToolpathId
          : rebuiltToolpaths[0]?.id || null;
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to update toolpaths after transform.", "danger");
      } finally {
        finishWorkerJob("transform");
      }
    }
    refreshWorkspaceUi();
    refreshToolpathUi();
    refreshSelectionUi();
    refreshTransformInspector();
    draw();
  }

  function getToolLibraryImageUrl(tool) {
    if (tool?.libraryToolImage) {
      return tool.libraryToolImage;
    }
    if (typeof tool?.image === "string" && /^library\/tools\//.test(tool.image)) {
      return tool.image;
    }
    if (!tool?.vendor || !tool?.image) {
      return "";
    }
    return `library/tools/${tool.vendor}/${tool.image}`;
  }

  function buildToolLibraryDescription(tool) {
    const segments = [];
    if (tool.toolType) {
      segments.push(tool.toolType.replace("-", " "));
    }
    if (Number.isFinite(tool.cuttingDiameterMm)) {
      segments.push(`${formatNumber(tool.cuttingDiameterMm)}mm cut`);
    }
    if (Number.isFinite(tool.shankDiameterMm)) {
      segments.push(`${formatNumber(tool.shankDiameterMm)}mm shank`);
    }
    if (Number.isFinite(tool.flutes)) {
      segments.push(`${tool.flutes}F`);
    }
    if (tool.fluteType) {
      segments.push(tool.fluteType);
    }
    if (Number.isFinite(tool.fluteAngleDeg) && tool.fluteAngleDeg > 0 && tool.toolType === "v-bit") {
      segments.push(`${formatNumber(tool.fluteAngleDeg)}deg`);
    }
    return segments.join(" - ");
  }

  function getSelectedLibraryTool() {
    return state.toolLibrary.byId.get(state.selectedLibraryToolId) || state.selectedLibraryToolMeta;
  }

  function buildToolLibraryMetaLine(tool) {
    const vendor = tool?.vendorDisplayName || tool?.vendor || "";
    const description = buildToolLibraryDescription(tool);
    if (vendor && description) {
      return `${vendor} - ${description}`;
    }
    return vendor || description || "";
  }

  function toolSupportsOperation(tool, operation) {
    if (!tool) {
      return false;
    }
    if (Array.isArray(tool.operationHints) && tool.operationHints.length) {
      return tool.operationHints.includes(operation);
    }
    if (operation === "vcarve") {
      return tool.toolType === "v-bit";
    }
    return true;
  }

  function getToolLibraryToolsForOperation(operation) {
    return state.toolLibrary.tools.filter((tool) => toolSupportsOperation(tool, operation));
  }

  function closeToolLibraryMenu() {
    ui.toolLibraryMenu.classList.add("d-none");
    ui.toolLibraryToggle.setAttribute("aria-expanded", "false");
  }

  function openToolLibraryMenu() {
    if (!state.toolLibrary.loaded) {
      return;
    }
    ui.toolLibraryMenu.classList.remove("d-none");
    ui.toolLibraryToggle.setAttribute("aria-expanded", "true");
  }

  function renderToolLibraryPreview() {
    const tool = getSelectedLibraryTool();
    const imageUrl = getToolLibraryImageUrl(tool);
    ui.toolLibraryPreview.classList.toggle("empty", !tool);
    ui.toolLibraryClearBtn.classList.toggle("d-none", !tool);
    if (!tool) {
      ui.toolLibraryPreview.innerHTML = `
        <div class="tool-library-preview-thumb">
          <i class="fa-solid fa-toolbox"></i>
        </div>
        <div class="tool-library-preview-copy">
          <div class="tool-library-preview-name">Choose tool from library</div>
          <div class="tool-library-preview-meta"></div>
        </div>
      `;
      ui.toolLibrarySummary.classList.add("d-none");
      return;
    }
    ui.toolLibraryPreview.innerHTML = `
      <img class="tool-library-preview-thumb" src="${imageUrl}" alt="${tool.name}">
      <div class="tool-library-preview-copy">
        <div class="tool-library-preview-name">${tool.name}</div>
        <div class="tool-library-preview-meta">${buildToolLibraryMetaLine(tool)}</div>
      </div>
    `;
    ui.toolLibrarySummary.classList.remove("d-none");
    ui.toolLibrarySummaryImage.src = imageUrl;
    ui.toolLibrarySummaryImage.alt = tool.name;
    ui.toolLibrarySummaryName.textContent = tool.name;
    ui.toolLibrarySummaryMeta.textContent = buildToolLibraryMetaLine(tool);
    ui.toolLibrarySummaryLink.href = tool.storeUrl || tool.purchaseUrl || tool.productUrl || "#";
  }

  function renderToolLibraryMenu() {
    if (!state.toolLibrary.loaded) {
      ui.toolLibraryList.innerHTML = `<div class="tool-library-empty">Loading tool library...</div>`;
      return;
    }
    const operation = ui.toolpathTypeInput.value;
    const tools = getToolLibraryToolsForOperation(operation);
    if (!tools.length) {
      ui.toolLibraryList.innerHTML = `<div class="tool-library-empty">No library tools match this operation yet.</div>`;
      return;
    }
    const groups = new Map();
    for (const tool of tools) {
      const key = tool.vendorDisplayName || tool.vendor || "Tools";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(tool);
    }
    ui.toolLibraryList.innerHTML = "";
    for (const [groupName, groupTools] of groups.entries()) {
      groupTools.sort((a, b) => a.name.localeCompare(b.name));
      const group = document.createElement("div");
      group.className = "tool-library-group";
      const title = document.createElement("div");
      title.className = "tool-library-group-title";
      title.textContent = groupName;
      group.appendChild(title);
      for (const tool of groupTools) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `tool-library-option ${tool.id === state.selectedLibraryToolId ? "is-selected" : ""}`;
        button.innerHTML = `
          <img class="tool-library-option-image" src="${getToolLibraryImageUrl(tool)}" alt="${tool.name}">
          <div class="tool-library-option-copy">
            <div class="tool-library-option-name">${tool.name}</div>
            <div class="tool-library-option-meta">${buildToolLibraryDescription(tool)}</div>
            <div class="tool-library-option-desc">${tool.tip || tool.toolTypeLabel || tool.material || ""}</div>
          </div>
        `;
        button.addEventListener("click", async () => {
          selectLibraryTool(tool.id, { applyDefaults: true });
          closeToolLibraryMenu();
          await rebuildDraftToolpath();
          refreshToolpathUi();
          draw();
        });
        group.appendChild(button);
      }
      ui.toolLibraryList.appendChild(group);
    }
  }

  function refreshToolLibraryUi() {
    renderToolLibraryPreview();
    renderToolLibraryMenu();
  }

  function syncToolInputsFromLibraryTool(tool) {
    if (!tool) {
      return;
    }
    if (Number.isFinite(tool.cuttingDiameterMm)) {
      ui.toolDiameterInput.value = formatNumber(tool.cuttingDiameterMm);
    }
    if (Number.isFinite(tool.fluteAngleDeg) && tool.fluteAngleDeg > 0) {
      ui.cutterAngleInput.value = formatNumber(tool.fluteAngleDeg);
    }
  }

  function selectLibraryTool(toolId, options = {}) {
    const tool = state.toolLibrary.byId.get(toolId) || null;
    state.selectedLibraryToolId = tool?.id || null;
    state.selectedLibraryToolMeta = tool
      ? {
        ...tool,
        image: tool.image,
      }
      : null;
    if (tool && options.applyDefaults !== false) {
      syncToolInputsFromLibraryTool(tool);
    }
    refreshToolLibraryUi();
  }

  function clearSelectedLibraryTool() {
    state.selectedLibraryToolId = null;
    state.selectedLibraryToolMeta = null;
    refreshToolLibraryUi();
  }

  function ensureSelectedToolMatchesOperation() {
    const tool = getSelectedLibraryTool();
    if (tool && !toolSupportsOperation(tool, ui.toolpathTypeInput.value)) {
      clearSelectedLibraryTool();
    }
  }

  async function loadToolLibraries() {
    const sources = [
      { url: "library/tools/sienci/tools.json", vendor: "sienci" },
      { url: "library/tools/ooznest/tools.json", vendor: "ooznest" },
    ];
    const tools = [];
    for (const source of sources) {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Failed to load ${source.vendor} tool library.`);
      }
      const payload = await response.json();
      const sourceTools = Array.isArray(payload) ? payload : payload.tools || [];
      tools.push(...sourceTools);
    }
    state.toolLibrary.tools = tools;
    state.toolLibrary.byId = new Map(tools.map((tool) => [tool.id, tool]));
    state.toolLibrary.loaded = true;
    if (state.selectedLibraryToolId && state.toolLibrary.byId.has(state.selectedLibraryToolId)) {
      state.selectedLibraryToolMeta = state.toolLibrary.byId.get(state.selectedLibraryToolId);
    }
    refreshToolLibraryUi();
  }

  function refreshWorkspaceUi() {
    const hasGeometry = state.loops.length > 0;
    const hasToolpaths = state.toolpaths.length > 0;
    const hasDraft = Boolean(state.draftToolpath);
    const hasSelection = state.selectedLoopIds.size > 0;
    const isEditing = Boolean(state.editingToolpathId);
    if (!hasSelection && state.transformTool) {
      state.transformTool = null;
    }

    ui.projectTitle.textContent = state.fileName || "Untitled Project";
    updateDockStatus();
    ui.canvasEmptyState.classList.toggle("d-none", hasGeometry);
    ui.canvasWrap.classList.toggle("is-drop-target", state.dragImportActive);
    ui.vectorActionGroup.classList.toggle("d-none", !hasSelection);

    for (const button of ui.originToggleButtons) {
      button.classList.toggle("is-active", state.showOrigin);
      if (button.classList.contains("canvas-tool-btn")) {
        button.classList.toggle("btn-primary", state.showOrigin);
        button.classList.toggle("btn-light", !state.showOrigin);
      }
    }

    setWorkflowStep("import", hasGeometry ? "complete" : "active");
    if (!hasGeometry) {
      setWorkflowStep("toolpath", "");
      setWorkflowStep("export", "");
      return;
    }
    setWorkflowStep("toolpath", hasToolpaths ? "complete" : "active");
    setWorkflowStep("export", hasToolpaths ? "active" : "");
    if (hasDraft || hasSelection || isEditing) {
      setWorkflowStep("toolpath", "active");
    }
  }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    resizeAuxCanvas(ui.topRulerCanvas, topRulerCtx, ratio);
    resizeAuxCanvas(ui.leftRulerCanvas, leftRulerCtx, ratio);
    loopPathsDirty = true;
    draw();
  }

  function resizeAuxCanvas(targetCanvas, targetCtx, ratio) {
    if (!targetCanvas || !targetCtx) {
      return;
    }
    const rect = targetCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    targetCanvas.width = Math.round(rect.width * ratio);
    targetCanvas.height = Math.round(rect.height * ratio);
    targetCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function requestDraw() {
    if (drawFramePending) {
      return;
    }
    drawFramePending = true;
    window.requestAnimationFrame(() => {
      drawFramePending = false;
      draw();
    });
  }

  function renderWorkerBadge() {
    const jobs = Array.from(state.workerJobs.values());
    const job = jobs.sort((a, b) => b.priority - a.priority)[0] || null;
    ui.workerBadge.classList.toggle("d-none", !job);
    if (!job) {
      ui.workerBadge.title = "";
      return;
    }
    ui.workerBadge.style.left = `${Math.max(8, state.pointer.x + 12)}px`;
    ui.workerBadge.style.top = `${Math.max(8, state.pointer.y + 12)}px`;
    const percent = Math.max(0, Math.min(100, Math.round(job.percent || 0)));
    ui.workerPercent.textContent = `${percent}%`;
    ui.workerBadge.title = job.label || "Worker busy";
  }

  function isSyntheticProgressJob(job) {
    return Boolean(job?.syntheticProgress && job.percent < job.syntheticProgress.targetPercent);
  }

  function ensureWorkerProgressAnimation() {
    if (workerProgressAnimationFrame) {
      return;
    }
    const tick = () => {
      let hasAnimatedJobs = false;
      for (const job of state.workerJobs.values()) {
        if (!isSyntheticProgressJob(job)) {
          continue;
        }
        const next = Math.min(
          job.syntheticProgress.targetPercent,
          (job.percent || 0) + job.syntheticProgress.step
        );
        if (next !== job.percent) {
          job.percent = next;
        }
        if (job.percent < job.syntheticProgress.targetPercent) {
          hasAnimatedJobs = true;
        }
      }
      renderWorkerBadge();
      if (hasAnimatedJobs) {
        workerProgressAnimationFrame = window.setTimeout(tick, 180);
      } else {
        workerProgressAnimationFrame = null;
      }
    };
    workerProgressAnimationFrame = window.setTimeout(tick, 180);
  }

  function maybeEnableSyntheticProgress(job) {
    if (!job || job.syntheticProgress || job.percent == null) {
      return;
    }
    if (job.label === "Calculating V-Carve" && job.percent >= 72 && job.percent < 100) {
      job.syntheticProgress = {
        targetPercent: 96,
        step: 1,
      };
      ensureWorkerProgressAnimation();
    }
  }

  function startWorkerJob(key, { label, percent = 0, priority = 1 }) {
    const job = { label, percent, priority };
    maybeEnableSyntheticProgress(job);
    state.workerJobs.set(key, job);
    renderWorkerBadge();
  }

  function updateWorkerJob(key, { label, percent, priority }) {
    const existing = state.workerJobs.get(key) || { priority: 1 };
    const job = {
      label: label ?? existing.label,
      percent: percent ?? existing.percent ?? 0,
      priority: priority ?? existing.priority,
      syntheticProgress: existing.syntheticProgress,
    };
    if (job.label !== existing.label || percent != null) {
      job.syntheticProgress = undefined;
    }
    maybeEnableSyntheticProgress(job);
    state.workerJobs.set(key, job);
    renderWorkerBadge();
  }

  function finishWorkerJob(key) {
    state.workerJobs.delete(key);
    renderWorkerBadge();
  }

  function beginViewNavigation() {
    state.isNavigatingView = true;
    if (navigationDetailTimerId) {
      window.clearTimeout(navigationDetailTimerId);
    }
    navigationDetailTimerId = window.setTimeout(() => {
      navigationDetailTimerId = null;
      state.isNavigatingView = false;
      requestDraw();
    }, 120);
  }

  function endViewNavigation() {
    if (navigationDetailTimerId) {
      window.clearTimeout(navigationDetailTimerId);
      navigationDetailTimerId = null;
    }
    if (!state.isNavigatingView) {
      return;
    }
    state.isNavigatingView = false;
    requestDraw();
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

  function matrixForTranslation(dx, dy) {
    return createMatrix(1, 0, 0, 1, dx, dy);
  }

  function matrixForRotation(angleRad, cx, cy) {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return multiplyMatrices(
      multiplyMatrices(createMatrix(1, 0, 0, 1, cx, cy), createMatrix(cos, sin, -sin, cos, 0, 0)),
      createMatrix(1, 0, 0, 1, -cx, -cy)
    );
  }

  function matrixForUniformScale(scale, ox, oy) {
    return multiplyMatrices(
      multiplyMatrices(createMatrix(1, 0, 0, 1, ox, oy), createMatrix(scale, 0, 0, scale, 0, 0)),
      createMatrix(1, 0, 0, 1, -ox, -oy)
    );
  }

  function matrixForFrameScale(scaleX, scaleY, frame) {
    const angle = frame.angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotate = createMatrix(cos, sin, -sin, cos, 0, 0);
    const unrotate = createMatrix(cos, -sin, sin, cos, 0, 0);
    return multiplyMatrices(
      multiplyMatrices(
        multiplyMatrices(
          multiplyMatrices(createMatrix(1, 0, 0, 1, frame.center.x, frame.center.y), rotate),
          createMatrix(scaleX, 0, 0, scaleY, 0, 0)
        ),
        unrotate
      ),
      createMatrix(1, 0, 0, 1, -frame.center.x, -frame.center.y)
    );
  }

  function selectionContainsCurvedEntities() {
    const selectedIndexes = new Set(getSelectedEntityIndexes());
    return state.entities.some((entity, index) => selectedIndexes.has(index) && (entity.type === "ARC" || entity.type === "CIRCLE"));
  }

  function applyMatrixToSelectedEntities(matrix, transformState) {
    const selectedSet = new Set(transformState.selectedEntityIndexes);
    state.entities = transformState.initialEntities.map((entity, index) => (
      selectedSet.has(index) ? transformEntity(entity, matrix) : entity
    ));
    rebuildLoopsFromEntities(transformState.selectionSignatures);
  }

  function beginGeometryTransform(kind, screenPoint, hit = null) {
    const captured = captureSelectionTransformContext();
    if (!captured) {
      return false;
    }
    const overlay = buildSelectionTransformOverlay();
    if (!overlay) {
      return false;
    }
    clearTabPressState();
    state.addTabsMode = false;
    state.hoveredLoopId = null;
    state.marqueePreviewLoopIds.clear();
    clearToolpathEditing();
    clearDraftToolpath();
    const worldPoint = screenToWorld(screenPoint);
    state.geometryTransform = {
      kind,
      hit,
      ...captured,
      frameAtStart: overlay.frame,
      center: overlay.frame.center,
      startFrameAngle: overlay.frame.angle,
      startWorld: worldPoint,
      startAngle: Math.atan2(worldPoint.y - overlay.frame.center.y, worldPoint.x - overlay.frame.center.x),
      changed: false,
    };
    if (kind === "scale" && hit?.handle) {
      const handleWorld = hit.handle.world;
      state.geometryTransform.handleWorld = handleWorld;
      const oppositeKey = { nw: "se", ne: "sw", se: "nw", sw: "ne" }[hit.handle.key];
      state.geometryTransform.anchor = overlay.frame.corners[oppositeKey];
      state.geometryTransform.initialDistance = Math.hypot(
        handleWorld.x - state.geometryTransform.anchor.x,
        handleWorld.y - state.geometryTransform.anchor.y
      ) || 1;
    }
    state.transformingGeometry = true;
    refreshToolpathUi();
    refreshWorkspaceUi();
    refreshTransformInspector();
    requestDraw();
    return true;
  }

  function updateGeometryTransform(screenPoint) {
    const transformState = state.geometryTransform;
    if (!transformState) {
      return;
    }
    const worldPoint = screenToWorld(screenPoint);
    let matrix = createMatrix();
    if (transformState.kind === "move") {
      transformState.resultAngle = transformState.startFrameAngle;
      matrix = matrixForTranslation(
        worldPoint.x - transformState.startWorld.x,
        worldPoint.y - transformState.startWorld.y
      );
    } else if (transformState.kind === "rotate") {
      const angle = Math.atan2(worldPoint.y - transformState.center.y, worldPoint.x - transformState.center.x);
      const delta = angle - transformState.startAngle;
      transformState.resultAngle = normalizeRadians(transformState.startFrameAngle + delta);
      matrix = matrixForRotation(delta, transformState.center.x, transformState.center.y);
      if (state.transformTool === "rotate") {
        ui.transformAngleInput.value = formatNumber((transformState.resultAngle * 180) / Math.PI);
      }
    } else if (transformState.kind === "scale") {
      const currentDistance = Math.hypot(
        worldPoint.x - transformState.anchor.x,
        worldPoint.y - transformState.anchor.y
      );
      const scale = Math.max(0.02, currentDistance / transformState.initialDistance);
      transformState.resultAngle = transformState.startFrameAngle;
      matrix = matrixForUniformScale(scale, transformState.anchor.x, transformState.anchor.y);
      if (state.transformTool === "scale") {
        ui.transformWidthInput.value = formatNumber(transformState.frameAtStart.width * scale);
        ui.transformHeightInput.value = formatNumber(transformState.frameAtStart.height * scale);
      }
    }
    transformState.changed = true;
    applyMatrixToSelectedEntities(matrix, transformState);
    if (state.transformTool === "move") {
      ui.transformPositionXInput.value = formatNumber(transformState.frameAtStart.center.x + (worldPoint.x - transformState.startWorld.x));
      ui.transformPositionYInput.value = formatNumber(transformState.frameAtStart.center.y + (worldPoint.y - transformState.startWorld.y));
    }
    updateCanvasCursor(screenPoint);
    requestDraw();
  }

  async function finalizeGeometryTransform() {
    const transformState = state.geometryTransform;
    if (!transformState) {
      return;
    }
    state.geometryTransform = null;
    state.transformingGeometry = false;
    if (!transformState.changed) {
      state.transformTool = null;
      refreshWorkspaceUi();
      refreshToolpathUi();
      refreshSelectionUi();
      refreshTransformInspector();
      draw();
      return;
    }
    const historyBefore = captureHistorySnapshot();
    await applySelectionTransformAndRebuild(null, transformState);
    pushHistorySnapshot(historyBefore);
    state.transformTool = null;
    updateTransformToolUi();
  }

  function cancelGeometryTransform() {
    const transformState = state.geometryTransform;
    if (!transformState) {
      return;
    }
    state.entities = transformState.initialEntities.slice();
    rebuildLoopsFromEntities(transformState.selectionSignatures);
    state.geometryTransform = null;
    state.transformingGeometry = false;
    state.transformTool = null;
    refreshWorkspaceUi();
    refreshToolpathUi();
    refreshSelectionUi();
    refreshTransformInspector();
    draw();
  }

  function adjustZoom(zoomFactor) {
    const rect = canvas.getBoundingClientRect();
    const center = { x: rect.width / 2, y: rect.height / 2 };
    const before = screenToWorld(center);
    state.camera.zoom = Math.max(0.01, Math.min(500, state.camera.zoom * zoomFactor));
    const after = screenToWorld(center);
    state.camera.panX += after.x - before.x;
    state.camera.panY += after.y - before.y;
    loopPathsDirty = true;
    beginViewNavigation();
    requestDraw();
  }

  function openFilePicker() {
    ui.fileInput.click();
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

  function transformEntity(...args) {
    return Paths.transformEntity(...args);
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
    return Paths.createLoopPath2D(
      segments,
      worldToScreen,
      state.camera.zoom,
      segments?.[0]?.source?.closed ?? true
    );
  }

  function rebuildLoopPaths() {
    for (const loop of state.loops) {
      loop.path2d = Paths.createLoopPath2D(loop.segments, worldToScreen, state.camera.zoom, loop.closed !== false);
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
    refreshToolLibraryUi();
    updateTransformToolUi();
    refreshSidebarMode();
    refreshWorkspaceUi();
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
    refreshWorkspaceUi();
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
      finishWorkerJob("draft");
      return;
    }
    const editing = getEditingToolpath();
    const config = readToolpathConfigFromForm();
    startWorkerJob("draft", {
      label: config.operation === "vcarve" ? "Calculating V-Carve" : "Calculating toolpath",
      percent: 4,
      priority: 1,
    });

    try {
      const draftOptions = editing
        ? { id: editing.id, label: editing.label }
        : {};
      const draft = await createToolpathFromLoopsAsync(sourceLoops, config, {
        ...draftOptions,
        onProgress(progress) {
          if (buildToken !== state.draftBuildToken) {
            return;
          }
          updateWorkerJob("draft", {
            label: progress.label || "Calculating toolpath",
            percent: progress.percent ?? 0,
            priority: 1,
          });
        },
      });
      if (buildToken !== state.draftBuildToken) {
        return;
      }
      draft.sourceLoops = draft.sourceLoops.map((loop) => (
        state.loops.find((candidate) => candidate.id === loop.id) || loop
      ));
      const existingTabs = state.draftToolpath?.tabs || editing?.tabs || [];
      draft.tabs = normalizeTabsForToolpath(draft, existingTabs);
      state.draftToolpath = draft;
      refreshToolpathUi();
      refreshWorkspaceUi();
      requestDraw();
    } catch (error) {
      if (buildToken !== state.draftBuildToken) {
        return;
      }
      state.draftToolpath = null;
      if (error instanceof Error) {
        showToast(error.message, "danger");
      }
      refreshToolpathUi();
      refreshWorkspaceUi();
      requestDraw();
    } finally {
      if (buildToken === state.draftBuildToken) {
        finishWorkerJob("draft");
      }
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
    const tabWidth = Math.min(50, Math.max(3, Number.parseFloat(ui.tabWidthInput.value) || 9));
    const selectedTool = getSelectedLibraryTool();
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
      libraryToolId: selectedTool?.id || null,
      libraryToolName: selectedTool?.name || "",
      libraryToolVendor: selectedTool?.vendorDisplayName || selectedTool?.vendor || "",
      libraryToolImage: getToolLibraryImageUrl(selectedTool),
      libraryToolUrl: selectedTool?.storeUrl || selectedTool?.purchaseUrl || selectedTool?.productUrl || "",
      libraryToolDescription: selectedTool ? buildToolLibraryDescription(selectedTool) : "",
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
    ui.tabWidthInput.value = formatNumber(Math.min(50, Math.max(3, toolpath.tabWidth)));
    ui.tabHeightInput.value = toolpath.tabHeight;
    ui.safeZInput.value = toolpath.safeZ;
    ui.feedRateInput.value = toolpath.feedRate;
    ui.plungeRateInput.value = toolpath.plungeRate;
    ui.spindleInput.value = toolpath.spindle;
    state.selectedLibraryToolId = toolpath.libraryToolId || null;
    state.selectedLibraryToolMeta = toolpath.libraryToolId
      ? state.toolLibrary.byId.get(toolpath.libraryToolId) || {
        id: toolpath.libraryToolId,
        name: toolpath.libraryToolName,
        vendorDisplayName: toolpath.libraryToolVendor,
        libraryToolImage: toolpath.libraryToolImage,
        image: toolpath.libraryToolImage?.replace(/^library\/tools\/[^/]+\//, ""),
        storeUrl: toolpath.libraryToolUrl,
        productUrl: toolpath.libraryToolUrl,
        purchaseUrl: toolpath.libraryToolUrl,
        operationHints: [],
      }
      : null;
    refreshOperationUi();
    refreshToolpathFieldVisibility();
    refreshToolLibraryUi();
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
    const historyBefore = captureHistorySnapshot();
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
    refreshWorkspaceUi();
    draw();
    pushHistorySnapshot(historyBefore);
  }

  function draw() {
    if (loopPathsDirty) {
      rebuildLoopPaths();
      loopPathsDirty = false;
    }
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
      transformOverlay: buildSelectionTransformOverlay(),
      navigationMode: state.isNavigatingView,
    });
    CanvasView.drawRulers({
      topCtx: topRulerCtx,
      topCanvas: ui.topRulerCanvas,
      leftCtx: leftRulerCtx,
      leftCanvas: ui.leftRulerCanvas,
      state,
      worldToScreen,
      formatNumber,
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
    if (config.operation !== "vcarve") {
      return CamWorkerClient.createToolpathInWorker(selectedLoops, config, options);
    }
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
    const historyBefore = captureHistorySnapshot();
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
    refreshWorkspaceUi();
    pushHistorySnapshot(historyBefore);
  }

  function loadImportedEntities(entities, name, sourceLabel) {
    const historyBefore = state.entities.length || state.toolpaths.length ? captureHistorySnapshot() : null;
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
    state.dragImportActive = false;
    state.geometryTransform = null;
    state.transformingGeometry = false;
    clearToolpathEditing();
    clearDraftToolpath();
    state.bounds = mergeBounds(state.loops.map((loop) => loop.bounds));
    fitCameraToBounds(state.bounds);
    loopPathsDirty = true;
    refreshSelectionUi();
    refreshToolpathUi();
    refreshWorkspaceUi();
    draw();
    pushHistorySnapshot(historyBefore);
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

  async function loadVectorFile(file) {
    if (!file) {
      return;
    }
    const text = await file.text();
    if (/\.svg$/i.test(file.name) || /^\s*<svg[\s>]/i.test(text)) {
      loadSvgText(text, file.name);
      return;
    }
    loadDxfText(text, file.name);
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
      showToast("Bundled sample could not be fetched directly. Use Browse Vector Files if you opened the app from the filesystem.", "warning");
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
      const loop = state.loops[i];
      if (loop.closed !== false) {
        if (ctx.isPointInPath(loop.path2d, point.x, point.y)) {
          return loop;
        }
        continue;
      }
      ctx.save();
      ctx.lineWidth = 8;
      const hit = ctx.isPointInStroke(loop.path2d, point.x, point.y);
      ctx.restore();
      if (hit) {
        return loop;
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
    const historyBefore = captureHistorySnapshot();
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
    pushHistorySnapshot(historyBefore);
  }

  function canMoveTabs() {
    return !state.editingToolpathId && !state.draftToolpath;
  }

  function distanceToScreenPolyline(point, points) {
    if (!points?.length) {
      return Number.POSITIVE_INFINITY;
    }
    if (points.length === 1) {
      return Math.hypot(points[0].x - point.x, points[0].y - point.y);
    }
    let best = Number.POSITIVE_INFINITY;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const lengthSq = abx * abx + aby * aby;
      if (lengthSq === 0) {
        best = Math.min(best, Math.hypot(a.x - point.x, a.y - point.y));
        continue;
      }
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq));
      const closestX = a.x + abx * t;
      const closestY = a.y + aby * t;
      best = Math.min(best, Math.hypot(closestX - point.x, closestY - point.y));
    }
    return best;
  }

  function findTabHit(screenPoint) {
    if (!canMoveTabs()) {
      return null;
    }
    for (const toolpath of getTabEligibleToolpaths()) {
      for (let index = 0; index < toolpath.tabs.length; index += 1) {
        const tab = toolpath.tabs[index];
        const contour = toolpath.previewContours[tab.contourIndex];
        if (!contour) {
          continue;
        }
        const tabWidth = Math.max(toolpath.tabWidth, getMinimumTabWidth(toolpath.toolDiameter));
        const tabSpan = getTabCenterlineSpan(tabWidth, toolpath.toolDiameter);
        const marker = buildTabMarker(contour, tab.along, tabSpan);
        const visibleRadius = (toolpath.toolDiameter * state.camera.zoom) / 2;
        const hitPadding = Math.max(4, state.camera.zoom * 0.15);
        if (distanceToScreenPolyline(screenPoint, marker.spine) <= visibleRadius + hitPadding) {
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
    const historyBefore = captureHistorySnapshot();
    toolpath.tabs.splice(index, 1);
    clearTabPressState();
    state.draggingTab = null;
    refreshToolpathUi();
    draw();
    pushHistorySnapshot(historyBefore);
  }

  function updateCanvasCursor(screenPoint = null) {
    const transformHit = screenPoint ? findTransformHit(screenPoint) : null;
    CanvasView.updateCanvasCursor({
      canvas,
      state,
      screenPoint,
      findTabHit,
      findLoopHit,
      transformCursor: transformHit?.cursor || "",
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
    return CamWorkerClient.buildGcodeInWorker({
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

  function isTypingTarget(target) {
    return target instanceof HTMLElement
      && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
  }

  ui.loadSampleBtn.addEventListener("click", loadBundledSample);
  ui.browseVectorBtn.addEventListener("click", openFilePicker);
  ui.openFileBtn.addEventListener("click", openFilePicker);
  ui.toggleSettingsBtn.addEventListener("click", () => {
    ui.globalSettingsSection.classList.toggle("d-none");
  });
  ui.zoomInBtn.addEventListener("click", () => {
    adjustZoom(1.2);
  });
  ui.zoomOutBtn.addEventListener("click", () => {
    adjustZoom(1 / 1.2);
  });
  ui.originToggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.showOrigin = !state.showOrigin;
      refreshWorkspaceUi();
      draw();
    });
  });
  ui.transformToolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const requestedTool = button.dataset.transformTool || null;
      state.transformTool = state.transformTool === requestedTool ? null : requestedTool;
      updateTransformToolUi();
      updateCanvasCursor();
      draw();
    });
  });
  ui.deleteVectorsBtn.addEventListener("click", () => {
    deleteSelectedVectors();
  });
  for (const option of ui.operationOptions) {
    option.addEventListener("click", () => {
      ui.toolpathTypeInput.value = option.dataset.operation;
      ensureSelectedToolMatchesOperation();
      refreshOperationUi();
      refreshToolpathFieldVisibility();
      refreshToolLibraryUi();
      rebuildDraftToolpath();
      refreshToolpathUi();
      draw();
    });
  }
  ui.toolLibraryToggle.addEventListener("click", () => {
    if (ui.toolLibraryMenu.classList.contains("d-none")) {
      openToolLibraryMenu();
    } else {
      closeToolLibraryMenu();
    }
  });
  ui.toolLibraryClearBtn.addEventListener("click", async () => {
    clearSelectedLibraryTool();
    closeToolLibraryMenu();
    await rebuildDraftToolpath();
    refreshToolpathUi();
    draw();
  });
  document.addEventListener("click", (event) => {
    if (ui.toolLibraryMenu.classList.contains("d-none")) {
      return;
    }
    if (ui.toolLibraryMenu.contains(event.target) || ui.toolLibraryToggle.contains(event.target)) {
      return;
    }
    closeToolLibraryMenu();
  });
  ui.transformAspectLockBtn.addEventListener("click", () => {
    state.transformAspectLocked = !state.transformAspectLocked;
    refreshTransformInspector();
  });
  ui.applyTransformMoveBtn.addEventListener("click", async () => {
    const overlay = buildSelectionTransformOverlay();
    if (!overlay) {
      return;
    }
    const targetX = Number.parseFloat(ui.transformPositionXInput.value);
    const targetY = Number.parseFloat(ui.transformPositionYInput.value);
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      return;
    }
    const context = captureSelectionTransformContext();
    if (!context) {
      return;
    }
    context.resultAngle = overlay.frame.angle;
    await applySelectionTransformAndRebuild(
      matrixForTranslation(targetX - overlay.frame.center.x, targetY - overlay.frame.center.y),
      context
    );
    state.transformTool = null;
    updateTransformToolUi();
  });
  ui.transformWidthInput.addEventListener("input", () => {
    state.transformSizeLastEdited = "width";
    if (!state.transformAspectLocked || state.transformTool !== "scale") {
      return;
    }
    const overlay = buildSelectionTransformOverlay();
    if (!overlay) {
      return;
    }
    const width = Number.parseFloat(ui.transformWidthInput.value);
    if (!Number.isFinite(width) || overlay.width <= 0) {
      return;
    }
    ui.transformHeightInput.value = formatNumber((width / overlay.width) * overlay.height);
  });
  ui.transformHeightInput.addEventListener("input", () => {
    state.transformSizeLastEdited = "height";
    if (!state.transformAspectLocked || state.transformTool !== "scale") {
      return;
    }
    const overlay = buildSelectionTransformOverlay();
    if (!overlay) {
      return;
    }
    const height = Number.parseFloat(ui.transformHeightInput.value);
    if (!Number.isFinite(height) || overlay.height <= 0) {
      return;
    }
    ui.transformWidthInput.value = formatNumber((height / overlay.height) * overlay.width);
  });
  ui.applyTransformAngleBtn.addEventListener("click", async () => {
    const overlay = buildSelectionTransformOverlay();
    if (!overlay) {
      return;
    }
    const targetAngleDeg = Number.parseFloat(ui.transformAngleInput.value);
    if (!Number.isFinite(targetAngleDeg)) {
      return;
    }
    const deltaRad = ((targetAngleDeg - overlay.angleDeg) * Math.PI) / 180;
    const context = captureSelectionTransformContext();
    if (!context) {
      return;
    }
    context.resultAngle = normalizeRadians((targetAngleDeg * Math.PI) / 180);
    await applySelectionTransformAndRebuild(
      matrixForRotation(deltaRad, overlay.frame.center.x, overlay.frame.center.y),
      context
    );
    state.transformTool = null;
    updateTransformToolUi();
  });
  ui.applyTransformSizeBtn.addEventListener("click", async () => {
    const overlay = buildSelectionTransformOverlay();
    if (!overlay) {
      return;
    }
    const targetWidth = Number.parseFloat(ui.transformWidthInput.value);
    const targetHeight = Number.parseFloat(ui.transformHeightInput.value);
    if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
      return;
    }
    let scaleX = targetWidth / overlay.width;
    let scaleY = targetHeight / overlay.height;
    if (state.transformAspectLocked) {
      const lockedScale = state.transformSizeLastEdited === "height" ? scaleY : scaleX;
      scaleX = lockedScale;
      scaleY = lockedScale;
    } else if (selectionContainsCurvedEntities()) {
      showToast("Non-uniform resize is not supported for circles or arcs. Re-enable aspect lock for this selection.", "warning");
      return;
    }
    const context = captureSelectionTransformContext();
    if (!context) {
      return;
    }
    context.resultAngle = overlay.frame.angle;
    await applySelectionTransformAndRebuild(
      matrixForFrameScale(scaleX, scaleY, overlay.frame),
      context
    );
    state.transformTool = null;
    updateTransformToolUi();
  });
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
    loopPathsDirty = true;
    requestDraw();
  });
  ui.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    await loadVectorFile(file);
    ui.fileInput.value = "";
  });
  ui.toolpathForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await rebuildDraftToolpath();
    commitDraftToolpath();
    refreshSelectionUi();
    refreshToolpathUi();
    refreshWorkspaceUi();
    draw();
  });
  ui.cancelEditBtn.addEventListener("click", () => {
    clearToolpathEditing();
    clearDraftToolpath();
    state.addTabsMode = false;
    refreshSelectionUi();
    refreshToolpathUi();
    refreshWorkspaceUi();
    draw();
  });
  ui.addTabsBtn.addEventListener("click", () => {
    if (state.editingToolpathId || state.draftToolpath || !getTabEligibleToolpaths().length) {
      state.addTabsMode = false;
      refreshToolpathUi();
      refreshWorkspaceUi();
      draw();
      return;
    }
    state.addTabsMode = !state.addTabsMode;
    refreshToolpathUi();
    refreshWorkspaceUi();
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
    const historyBefore = captureHistorySnapshot();
    active.tabs = [];
    refreshToolpathUi();
    draw();
    pushHistorySnapshot(historyBefore);
  });
  ui.generateGcodeBtn.addEventListener("click", async () => {
    startWorkerJob("gcode", {
      label: "Preparing G-code",
      percent: 2,
      priority: 2,
    });
    try {
      const gcode = await CamWorkerClient.buildGcodeInWorker({
        toolpaths: getRenderableToolpaths(),
        fileName: state.fileName,
        forcePolylineArcs: ui.forcePolylineArcsInput.checked,
        onProgress(progress) {
          updateWorkerJob("gcode", {
            label: progress.label || "Preparing G-code",
            percent: progress.percent ?? 0,
            priority: 2,
          });
        },
      });
      const fileName = (state.fileName || "job").replace(/\.dxf$/i, "");
      downloadTextFile(`${fileName}.nc`, gcode);
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message, "danger");
      }
    } finally {
      finishWorkerJob("gcode");
    }
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const before = screenToWorld({ x: event.offsetX, y: event.offsetY });
    const zoomFactor = Math.max(0.7, Math.min(1.4, Math.exp(-event.deltaY * 0.0025)));
    state.camera.zoom = Math.max(0.01, Math.min(500, state.camera.zoom * zoomFactor));
    const after = screenToWorld({ x: event.offsetX, y: event.offsetY });
    state.camera.panX += after.x - before.x;
    state.camera.panY += after.y - before.y;
    loopPathsDirty = true;
    beginViewNavigation();
    requestDraw();
  }, { passive: false });

  ["dragenter", "dragover"].forEach((eventName) => {
    ui.canvasWrap.addEventListener(eventName, (event) => {
      event.preventDefault();
      state.dragImportActive = true;
      refreshWorkspaceUi();
    });
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    ui.canvasWrap.addEventListener(eventName, (event) => {
      if (event.relatedTarget && ui.canvasWrap.contains(event.relatedTarget)) {
        return;
      }
      event.preventDefault();
      state.dragImportActive = false;
      refreshWorkspaceUi();
    });
  });

  ui.canvasWrap.addEventListener("drop", async (event) => {
    event.preventDefault();
    state.dragImportActive = false;
    refreshWorkspaceUi();
    const file = event.dataTransfer?.files?.[0];
    await loadVectorFile(file);
  });

  canvas.addEventListener("mousedown", (event) => {
    const point = { x: event.offsetX, y: event.offsetY };
    const transformHit = findTransformHit(point);
    if (event.button === 0 && transformHit && beginGeometryTransform(transformHit.type, point, transformHit)) {
      updateCanvasCursor(point);
      return;
    }
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
    if (event.button === 0 && !state.transformTool) {
      state.marquee = {
        start: point,
        current: point,
        active: false,
        append: event.ctrlKey || event.metaKey,
      };
    }
  });

  window.addEventListener("mousemove", (event) => {
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    if (state.workerJobs.size) {
      renderWorkerBadge();
    }
  });
  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const typing = isTypingTarget(event.target);
      if (!typing && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoHistory();
        } else {
          undoHistory();
        }
        return;
      }
      if (!typing && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoHistory();
        return;
      }
    }
    if (event.key === "Escape" && state.geometryTransform) {
      event.preventDefault();
      cancelGeometryTransform();
      state.transformTool = null;
      updateTransformToolUi();
      return;
    }
    if (event.key === "Delete" && state.selectedLoopIds.size > 0) {
      const typing = isTypingTarget(event.target);
      if (!typing) {
        event.preventDefault();
        deleteSelectedVectors();
      }
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
        historyBefore: captureHistorySnapshot(),
        changed: false,
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
        state.draggingTab.changed = true;
        updateCanvasCursor(point);
        requestDraw();
      }
      return;
    }
    if (state.geometryTransform) {
      updateGeometryTransform(point);
      return;
    }
    if (state.dragPan) {
      const rect = canvas.getBoundingClientRect();
      const dx = (event.clientX - state.dragPan.x) / state.camera.zoom;
      const dy = (event.clientY - state.dragPan.y) / state.camera.zoom;
      state.camera.panX = state.dragPan.panX + dx;
      state.camera.panY = state.dragPan.panY - dy;
      loopPathsDirty = true;
      beginViewNavigation();
      updateCanvasCursor(point);
      requestDraw();
      return;
    }
    if (state.marquee) {
      state.marquee.current = point;
      const dragDistance = Math.hypot(point.x - state.marquee.start.x, point.y - state.marquee.start.y);
      if (dragDistance >= MARQUEE_DRAG_THRESHOLD) {
        state.marquee.active = true;
        state.marqueePreviewLoopIds = !state.transformTool
          ? loopIdsInMarquee(state.marquee.start, point)
          : new Set();
      } else {
        state.marqueePreviewLoopIds.clear();
      }
      updateCanvasCursor(point);
      requestDraw();
      return;
    }
    state.hoveredTab = findTabHit(point);
    state.hoveredLoopId = state.addTabsMode || Boolean(state.transformTool)
      ? null
      : findLoopHit(point)?.id || null;
    updateHoveredTabCandidate(point);
    updateCanvasCursor(point);
    requestDraw();
  });

  canvas.addEventListener("mouseup", async (event) => {
    const point = { x: event.offsetX, y: event.offsetY };
    if (state.geometryTransform) {
      finalizeGeometryTransform();
      updateCanvasCursor();
      return;
    }
    if (state.dragPan) {
      endViewNavigation();
    }
    if (state.marquee) {
      const { start, current, active, append } = state.marquee;
      state.marquee = null;
      state.marqueePreviewLoopIds.clear();
      if (!state.transformTool) {
        if (active) {
          pickLoopsInMarquee(start, current, append);
        } else {
          pickLoopAtScreenPoint(current, append);
        }
      }
      return;
    }
    clearTabPressState();
    state.dragPan = null;
    if (state.draggingTab?.changed) {
      pushHistorySnapshot(state.draggingTab.historyBefore);
    }
    state.draggingTab = null;
    state.hoveredTab = null;
    updateCanvasCursor();
    draw();
  });

  canvas.addEventListener("mouseleave", () => {
    if (state.geometryTransform) {
      finalizeGeometryTransform();
    }
    if (state.dragPan) {
      endViewNavigation();
    }
    clearTabPressState();
    state.hoveredTab = null;
    state.hoveredTabCandidate = null;
    state.hoveredLoopId = null;
    state.dragPan = null;
    if (state.draggingTab?.changed) {
      pushHistorySnapshot(state.draggingTab.historyBefore);
    }
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

  refreshWorkspaceUi();
  refreshSelectionUi();
  refreshToolpathUi();
  refreshToolLibraryUi();
  updateTransformToolUi();
  syncAutoTabHeight();
  loadToolLibraries().catch((error) => {
    showToast(error instanceof Error ? error.message : "Failed to load tool library.", "danger");
    ui.toolLibraryList.innerHTML = `<div class="tool-library-empty">Failed to load tool library.</div>`;
  });
  window.addEventListener("resize", resizeCanvas);
  if ("ResizeObserver" in window) {
    canvasResizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    canvasResizeObserver.observe(canvas);
    if (ui.canvasWrap) {
      canvasResizeObserver.observe(ui.canvasWrap);
    }
  }
  resizeCanvas();
})();

