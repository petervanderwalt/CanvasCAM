import {
  MARQUEE_DRAG_THRESHOLD,
  TAB_DELETE_HOLD_MS,
  TAB_DELETE_MOVE_THRESHOLD,
} from "./src/constants.js?v=20260810-marquee1";
import { parseDxf as parseDxfFile } from "./src/dxf.js?v=20260730-vcarve12";
import { parseSvg as parseSvgFile } from "./src/svg.js?v=20260810-potrace-subpaths1";
import * as Paths from "./src/paths.js?v=20260810-text1";
import * as CamOps from "./src/cam-ops.js?v=20260810-boolean1";
import * as UiState from "./src/ui-state.js?v=20260730-vcarve12";
import * as CanvasView from "./src/canvas-view.js?v=20260810-grid-snap1";
import * as CamWorkerClient from "./src/cam-worker-client.js?v=20260731-worker1";
import * as CadFont from "./src/cad-font.js?v=20260810-text-height1";
import * as Potrace from "./vendor/potrace-js/index.js?v=20260810-potrace-js1";

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
  let myEndmillsModalInstance = null;
  let bitmapTraceModalInstance = null;
  let booleanModalInstance = null;
  let workspaceSettingsModalInstance = null;
  let gridSettingsModalInstance = null;
  let workspaceSettingsOriginal = null;

  const ui = {
    loadSampleBtn: document.getElementById("loadSampleBtn"),
    browseVectorBtn: document.getElementById("browseVectorBtn"),
    newEmptyCanvasBtn: document.getElementById("newEmptyCanvasBtn"),
    newCanvasBtn: document.getElementById("newCanvasBtn"),
    openFileBtn: document.getElementById("openFileBtn"),
    ribbonTabs: Array.from(document.querySelectorAll(".ribbon-tab")),
    ribbonPanels: Array.from(document.querySelectorAll(".ribbon-panel")),
    fileInput: document.getElementById("fileInput"),
    zoomFitBtn: document.getElementById("zoomFitBtn"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    undoBtn: document.getElementById("undoBtn"),
    redoBtn: document.getElementById("redoBtn"),
    workerBadge: document.getElementById("workerBadge"),
    workerPercent: document.getElementById("workerPercent"),
    statusText: document.getElementById("statusText"),
    toastContainer: document.getElementById("toastContainer"),
    canvasWrap: document.getElementById("canvasWrap"),
    vectorActionGroup: document.getElementById("vectorActionGroup"),
    cadActionGroup: document.getElementById("cadActionGroup"),
    selectModeBtn: document.getElementById("selectModeBtn"),
    cadEditModeBtn: document.getElementById("cadEditModeBtn"),
    cadToolButtons: Array.from(document.querySelectorAll(".cad-tool-btn")),
    cadSnapBtn: document.getElementById("cadSnapBtn"),
    gridSettingsModal: document.getElementById("gridSettingsModal"),
    gridVisibleInput: document.getElementById("gridVisibleInput"),
    gridStyleInputs: Array.from(document.querySelectorAll("input[name='gridStyle']")),
    snapEnabledInput: document.getElementById("snapEnabledInput"),
    gridSpacingInput: document.getElementById("gridSpacingInput"),
    applyGridSettingsBtn: document.getElementById("applyGridSettingsBtn"),
    clearGuidesBtn: document.getElementById("clearGuidesBtn"),
    cadInspector: document.getElementById("cadInspector"),
    cadInspectorTitle: document.getElementById("cadInspectorTitle"),
    cadInspectorCloseBtn: document.getElementById("cadInspectorCloseBtn"),
    cadInspectorXInput: document.getElementById("cadInspectorXInput"),
    cadInspectorYInput: document.getElementById("cadInspectorYInput"),
    cadInspectorWidthInput: document.getElementById("cadInspectorWidthInput"),
    cadInspectorHeightInput: document.getElementById("cadInspectorHeightInput"),
    cadInspectorAngleInput: document.getElementById("cadInspectorAngleInput"),
    cadInspectorRadiusField: document.getElementById("cadInspectorRadiusField"),
    cadInspectorRadiusInput: document.getElementById("cadInspectorRadiusInput"),
    applyCadInspectorBtn: document.getElementById("applyCadInspectorBtn"),
    cadTextPanel: document.getElementById("cadTextPanel"),
    cadTextInput: document.getElementById("cadTextInput"),
    cadTextFontSelect: document.getElementById("cadTextFontSelect"),
    cadTextHeightInput: document.getElementById("cadTextHeightInput"),
    cadTextAddBtn: document.getElementById("cadTextAddBtn"),
    cadTextCancelBtn: document.getElementById("cadTextCancelBtn"),
    topRulerCanvas,
    leftRulerCanvas,
    canvasEmptyState: document.getElementById("canvasEmptyState"),
    emptyStateDropNote: document.getElementById("emptyStateDropNote"),
    transformToolButtons: Array.from(document.querySelectorAll(".transform-tool-btn")),
    deleteVectorsBtn: document.getElementById("deleteVectorsBtn"),
    duplicateVectorsBtn: document.getElementById("duplicateVectorsBtn"),
    booleanVectorsBtn: document.getElementById("booleanVectorsBtn"),
    booleanModal: document.getElementById("booleanModal"),
    booleanModalSummary: document.getElementById("booleanModalSummary"),
    booleanOperationInputs: Array.from(document.querySelectorAll("input[name='booleanOperation']")),
    applyBooleanBtn: document.getElementById("applyBooleanBtn"),
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
    selectionCount: document.getElementById("selectionCount"),
    selectionHeading: document.getElementById("selectionHeading"),
    selectionEmpty: document.getElementById("selectionEmpty"),
    toolpathForm: document.getElementById("toolpathForm"),
    toolpathFormMode: document.getElementById("toolpathFormMode"),
    toggleSettingsBtn: document.getElementById("toggleSettingsBtn"),
    workspaceSettingsModal: document.getElementById("workspaceSettingsModal"),
    applyWorkspaceSettingsBtn: document.getElementById("applyWorkspaceSettingsBtn"),
    toolpathTypeInput: document.getElementById("toolpathTypeInput"),
    myEndmillSelect: document.getElementById("myEndmillSelect"),
    myEndmillSummary: document.getElementById("myEndmillSummary"),
    editMyEndmillsBtn: document.getElementById("editMyEndmillsBtn"),
    myEndmillsModal: document.getElementById("myEndmillsModal"),
    myEndmillsSlots: document.getElementById("myEndmillsSlots"),
    myEndmillsValidationHint: document.getElementById("myEndmillsValidationHint"),
    saveMyEndmillsBtn: document.getElementById("saveMyEndmillsBtn"),
    bitmapTraceModal: document.getElementById("bitmapTraceModal"),
    bitmapTraceFileName: document.getElementById("bitmapTraceFileName"),
    traceThresholdInput: document.getElementById("traceThresholdInput"),
    traceThresholdValue: document.getElementById("traceThresholdValue"),
    traceSpeckleInput: document.getElementById("traceSpeckleInput"),
    traceCornerInput: document.getElementById("traceCornerInput"),
    traceCornerValue: document.getElementById("traceCornerValue"),
    traceOptimizeInput: document.getElementById("traceOptimizeInput"),
    traceInvertInput: document.getElementById("traceInvertInput"),
    tracePreview: document.getElementById("tracePreview"),
    tracePreviewStatus: document.getElementById("tracePreviewStatus"),
    traceBitmapBtn: document.getElementById("traceBitmapBtn"),
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
    toolNumberInput: document.getElementById("toolNumberInput"),
    toolDiameterField: document.getElementById("toolDiameterField"),
    toolDiameterInput: document.getElementById("toolDiameterInput"),
    cutterAngleField: document.getElementById("cutterAngleField"),
    cutterAngleInput: document.getElementById("cutterAngleInput"),
    overlapInput: document.getElementById("overlapInput"),
    overlapField: document.getElementById("overlapField"),
    cutDepthField: document.getElementById("cutDepthField"),
    cutDepthInput: document.getElementById("cutDepthInput"),
    passDepthInput: document.getElementById("passDepthInput"),
    jobSettingsSection: document.getElementById("jobSettingsSection"),
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
    emptyCanvasStarted: false,
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
    lastToolingWarning: "",
    draftBuildToken: 0,
    dragImportActive: false,
    isNavigatingView: false,
    transformTool: null,
    cadEditMode: false,
    cadTool: null,
    cadDraft: null,
    cadTextPlacement: null,
    cadSnapEnabled: true,
    gridVisible: true,
    gridStyle: "lines",
    gridSpacing: 10,
    cadInspectorDismissed: false,
    pendingBitmapFile: null,
    traceSourceImageData: null,
    tracePreviewTimer: null,
    tracePreviewToken: 0,
    tracePreviewSvg: "",
    booleanPreviewContours: null,
    booleanOperation: "union",
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
    myEndmills: {
      slots: [],
      selectedSlot: null,
    },
    history: {
      undo: [],
      redo: [],
      limit: 60,
    },
  };

  const MY_ENDMILLS_STORAGE_KEY = "camcanvas.myEndmills.v1";

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
    const icon = variant === "warning"
      ? "fa-solid fa-triangle-exclamation"
      : variant === "success"
        ? "fa-solid fa-check"
        : "fa-solid fa-xmark";
    toast.className = `toast toast-funky is-${variant} show`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");
    toast.innerHTML = `
      <div class="toast-inner">
        <div class="toast-icon" aria-hidden="true">
          <i class="${icon}"></i>
        </div>
        <div class="toast-copy">
          <strong class="toast-title">${title}</strong>
          <div class="toast-message">${message}</div>
        </div>
        <button type="button" class="toast-close" aria-label="Close"></button>
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
    for (const guide of state.entities.filter((entity) => entity.type === "GUIDE")) {
      const guideHit = nearestPointOnInfiniteLine(world, guide.start, guide.end);
      const screen = worldToScreen(guideHit);
      const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
      if (distance <= snapRadius && (!closest || distance < closest.distance)) {
        closest = { point: guideHit, distance };
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
      toolNumber: toolpath.toolNumber,
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
      toolNumber: toolpath.toolNumber,
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
      selectedMyEndmillSlot: state.myEndmills.selectedSlot,
      autoTabHeight: state.autoTabHeight,
      toolpathFormValues: {
        operation: ui.toolpathTypeInput.value,
        toolNumber: ui.toolNumberInput.value,
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
    refreshHistoryButtons();
  }

  function refreshHistoryButtons() {
    ui.undoBtn.disabled = state.history.undo.length === 0;
    ui.redoBtn.disabled = state.history.redo.length === 0;
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
    state.myEndmills.selectedSlot = snapshot.selectedMyEndmillSlot || null;
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
    ui.toolNumberInput.value = formValues.toolNumber || ui.toolNumberInput.value;
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
    syncSelectedMyEndmillForOperation({ preserve: true });
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
    refreshHistoryButtons();
  }

  function redoHistory() {
    if (!state.history.redo.length) {
      return;
    }
    const current = captureHistorySnapshot();
    const snapshot = state.history.redo.pop();
    state.history.undo.push(current);
    restoreHistorySnapshot(snapshot);
    refreshHistoryButtons();
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
    const hasSelection = state.selectedLoopIds.size > 0;
    if (!state.selectedLoopIds.size) {
      state.transformTool = null;
    }
    for (const button of ui.transformToolButtons) {
      const active = button.dataset.transformTool === state.transformTool;
      button.disabled = !hasSelection;
      button.classList.toggle("is-active", active);
    }
    ui.vectorActionGroup.classList.remove("d-none");
    ui.duplicateVectorsBtn.disabled = !hasSelection;
    ui.deleteVectorsBtn.disabled = !hasSelection;
    const booleanEligible = loopsFromSelection().filter((loop) => loop.closed !== false && loop.points?.length >= 4).length >= 2;
    ui.booleanVectorsBtn.disabled = !booleanEligible;
    updateSelectModeUi();
    refreshSidebarMode();
  }

  function updateSelectModeUi() {
    const active = !state.cadEditMode && !state.cadTool && !state.transformTool && !state.geometryTransform;
    ui.selectModeBtn.classList.toggle("is-active", active);
    ui.selectModeBtn.setAttribute("aria-pressed", String(active));
    ui.cadEditModeBtn.classList.toggle("is-active", state.cadEditMode);
    ui.cadEditModeBtn.setAttribute("aria-pressed", String(state.cadEditMode));
  }

  function setRibbonTab(tabName) {
    for (const tab of ui.ribbonTabs) {
      const active = tab.dataset.ribbonTab === tabName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    }
    for (const panel of ui.ribbonPanels) {
      panel.classList.toggle("is-active", panel.dataset.ribbonPanel === tabName);
    }
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
    const editingCad = state.cadEditMode;
    const showTransform = Boolean(state.transformTool) && count > 0;
    ui.selectionCount.textContent = String(count);
    ui.selectionHeading.textContent = showTransform
      ? {
        move: "Move Vectors",
        scale: "Resize Vectors",
        rotate: "Rotate Vectors",
      }[state.transformTool] || "Transform Vectors"
      : editingCad ? "Edit CAD Shape" : editing ? "Edit Toolpath" : "Assign Toolpaths";
    ui.selectionEmpty.classList.toggle("d-none", editingCad || showTransform || count > 0 || Boolean(editing));
    ui.toolpathForm.classList.toggle("d-none", editingCad || showTransform || (count === 0 && !editing));
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

  function duplicateSelectedVectors() {
    const indexes = getSelectedEntityIndexes();
    if (!indexes.length) {
      return;
    }
    const historyBefore = captureHistorySnapshot();
    const offset = state.cadSnapEnabled ? getGridSpacing() : 5;
    const startIndex = state.entities.length;
    const copies = indexes.map((index) => translateEntity(deepClone(state.entities[index]), offset, offset));
    state.entities.push(...copies);
    rebuildLoopsFromEntities(new Set());
    state.selectedLoopIds.clear();
    const copiedIndexes = new Set(copies.map((_, index) => startIndex + index));
    for (const loop of state.loops) {
      if (loop.sourceEntityIndexes?.some((index) => copiedIndexes.has(index))) {
        state.selectedLoopIds.add(loop.id);
      }
    }
    pushHistorySnapshot(historyBefore);
    refreshSelectionUi();
    refreshToolpathUi();
    refreshWorkspaceUi();
    requestDraw();
  }

  function getBooleanEligibleLoops() {
    return loopsFromSelection().filter((loop) => loop.closed !== false && loop.points?.length >= 4);
  }

  function getBooleanModalInstance() {
    if (!ui.booleanModal) {
      return null;
    }
    if (!booleanModalInstance) {
      if (window.bootstrap?.Modal) {
        booleanModalInstance = window.bootstrap.Modal.getOrCreateInstance(ui.booleanModal, { backdrop: "static" });
      } else {
        booleanModalInstance = {
          show() {
            ui.booleanModal.classList.add("show");
            ui.booleanModal.style.display = "block";
            ui.booleanModal.removeAttribute("aria-hidden");
            document.body.classList.add("modal-open");
          },
          hide() {
            ui.booleanModal.classList.remove("show");
            ui.booleanModal.style.display = "none";
            ui.booleanModal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("modal-open");
          },
        };
      }
    }
    return booleanModalInstance;
  }

  function getWorkspaceSettingsModalInstance() {
    if (!ui.workspaceSettingsModal) {
      return null;
    }
    if (!workspaceSettingsModalInstance) {
      if (window.bootstrap?.Modal) {
        workspaceSettingsModalInstance = window.bootstrap.Modal.getOrCreateInstance(ui.workspaceSettingsModal, {
          backdrop: "static",
        });
      } else {
        workspaceSettingsModalInstance = {
          show() {
            ui.workspaceSettingsModal.classList.add("show");
            ui.workspaceSettingsModal.style.display = "block";
            ui.workspaceSettingsModal.removeAttribute("aria-hidden");
            ui.workspaceSettingsModal.setAttribute("aria-modal", "true");
            document.body.classList.add("modal-open");
          },
          hide() {
            ui.workspaceSettingsModal.classList.remove("show");
            ui.workspaceSettingsModal.style.display = "none";
            ui.workspaceSettingsModal.setAttribute("aria-hidden", "true");
            ui.workspaceSettingsModal.removeAttribute("aria-modal");
            document.body.classList.remove("modal-open");
          },
        };
      }
    }
    return workspaceSettingsModalInstance;
  }

  function getGridSettingsModalInstance() {
    if (!ui.gridSettingsModal) {
      return null;
    }
    if (!gridSettingsModalInstance) {
      if (window.bootstrap?.Modal) {
        gridSettingsModalInstance = window.bootstrap.Modal.getOrCreateInstance(ui.gridSettingsModal, {
          backdrop: "static",
        });
      } else {
        gridSettingsModalInstance = {
          show() {
            ui.gridSettingsModal.classList.add("show");
            ui.gridSettingsModal.style.display = "block";
            ui.gridSettingsModal.removeAttribute("aria-hidden");
            ui.gridSettingsModal.setAttribute("aria-modal", "true");
            document.body.classList.add("modal-open");
          },
          hide() {
            ui.gridSettingsModal.classList.remove("show");
            ui.gridSettingsModal.style.display = "none";
            ui.gridSettingsModal.setAttribute("aria-hidden", "true");
            ui.gridSettingsModal.removeAttribute("aria-modal");
            document.body.classList.remove("modal-open");
          },
        };
      }
    }
    return gridSettingsModalInstance;
  }

  function getGridSpacing() {
    const spacing = Number.parseFloat(state.gridSpacing);
    return Number.isFinite(spacing) && spacing >= 0.1 ? spacing : 10;
  }

  function updateCadSnapUi() {
    const spacing = getGridSpacing();
    ui.cadSnapBtn.setAttribute("aria-pressed", String(state.cadSnapEnabled));
    ui.cadSnapBtn.title = state.cadSnapEnabled
      ? `Snap to ${formatNumber(spacing)}mm grid, endpoints, corners, and centers`
      : "Snapping is off";
  }

  function openGridSettings() {
    ui.gridVisibleInput.checked = state.gridVisible;
    ui.snapEnabledInput.checked = state.cadSnapEnabled;
    ui.gridSpacingInput.value = formatNumber(getGridSpacing());
    for (const input of ui.gridStyleInputs) {
      input.checked = input.value === state.gridStyle;
    }
    getGridSettingsModalInstance()?.show();
  }

  function applyGridSettings() {
    const spacing = Number.parseFloat(ui.gridSpacingInput.value);
    if (!Number.isFinite(spacing) || spacing < 0.1) {
      showToast("Enter a snap spacing of at least 0.1 mm.", "warning");
      ui.gridSpacingInput.focus();
      return;
    }
    state.gridVisible = ui.gridVisibleInput.checked;
    state.cadSnapEnabled = ui.snapEnabledInput.checked;
    state.gridStyle = ui.gridStyleInputs.find((input) => input.checked)?.value === "dots" ? "dots" : "lines";
    state.gridSpacing = spacing;
    updateCadSnapUi();
    requestDraw();
    getGridSettingsModalInstance()?.hide();
  }

  function restoreWorkspaceSettings() {
    if (!workspaceSettingsOriginal) {
      return;
    }
    ui.safeZInput.value = workspaceSettingsOriginal.safeZ;
    ui.forcePolylineArcsInput.checked = workspaceSettingsOriginal.forcePolylineArcs;
    workspaceSettingsOriginal = null;
    rebuildDraftToolpath();
    refreshToolpathUi();
    requestDraw();
  }

  function refreshBooleanPreview() {
    const loops = getBooleanEligibleLoops();
    const preview = CamOps.booleanPolygons(loops, state.booleanOperation);
    state.booleanPreviewContours = preview;
    ui.applyBooleanBtn.disabled = preview.length === 0;
    requestDraw();
  }

  function openBooleanDialog() {
    const loops = getBooleanEligibleLoops();
    if (loops.length < 2) {
      showToast("Select at least two closed vectors to combine.", "warning");
      return;
    }
    state.booleanOperation = "union";
    ui.booleanModalSummary.textContent = `${loops.length} closed vectors selected`;
    for (const input of ui.booleanOperationInputs) {
      input.checked = input.value === state.booleanOperation;
      input.closest(".boolean-operation-option")?.classList.toggle("is-active", input.checked);
    }
    refreshBooleanPreview();
    getBooleanModalInstance()?.show();
  }

  async function applyBooleanOperation() {
    const selectedLoops = getBooleanEligibleLoops();
    const result = state.booleanPreviewContours || [];
    if (selectedLoops.length < 2 || !result.length) {
      showToast("This Boolean operation has no resulting geometry.", "warning");
      return;
    }

    const historyBefore = captureHistorySnapshot();
    const selectedIndexes = new Set(getSelectedEntityIndexes());
    const selectedSignatures = selectedLoopSignatures();
    const snapshots = snapshotToolpathsForRebuild();
    const resultEntities = result.map((points) => ({
      type: "LWPOLYLINE",
      closed: true,
      vertices: points.slice(0, -1).map((point) => ({ x: point.x, y: point.y, bulge: 0 })),
      __booleanResult: true,
    }));
    state.entities = state.entities.filter((_, index) => !selectedIndexes.has(index));
    const insertedStart = state.entities.length;
    state.entities.push(...resultEntities);
    state.selectionFrameAngles.clear();
    clearToolpathEditing();
    clearDraftToolpath();
    state.activeToolpathId = null;
    rebuildLoopsFromEntities(new Set());

    const resultIndexes = new Set(resultEntities.map((_, index) => insertedStart + index));
    const resultLoops = state.loops.filter((loop) => loop.sourceEntityIndexes?.some((index) => resultIndexes.has(index)));
    state.selectedLoopIds = new Set(resultLoops.map((loop) => loop.id));
    const loopMap = new Map(state.loops.map((loop) => [loopSignature(loop), loop]));
    const rebuiltToolpaths = [];
    let discardedToolpaths = 0;

    if (snapshots.length) {
      startWorkerJob("boolean", { label: "Updating toolpaths", percent: 8, priority: 1 });
      try {
        for (let index = 0; index < snapshots.length; index += 1) {
          const snapshot = snapshots[index];
          const sourceSignatures = snapshot.sourceLoopSignatures || [];
          const affected = sourceSignatures.some((signature) => selectedSignatures.has(signature));
          const fullyAffected = affected && sourceSignatures.every((signature) => selectedSignatures.has(signature));
          if (affected && !fullyAffected) {
            discardedToolpaths += 1;
            continue;
          }
          const sourceLoops = fullyAffected
            ? resultLoops
            : sourceSignatures.map((signature) => loopMap.get(signature)).filter(Boolean);
          if (!sourceLoops.length) {
            discardedToolpaths += 1;
            continue;
          }
          updateWorkerJob("boolean", { label: "Updating toolpaths", percent: 12 + Math.round((index / Math.max(1, snapshots.length)) * 80), priority: 1 });
          const rebuilt = await createToolpathFromLoopsAsync(sourceLoops, snapshot.config, { id: snapshot.id, label: snapshot.label });
          rebuilt.sourceLoops = sourceLoops;
          rebuilt.tabs = normalizeTabsForToolpath(rebuilt, snapshot.tabs);
          rebuiltToolpaths.push(rebuilt);
        }
        state.toolpaths = rebuiltToolpaths;
      } catch (error) {
        state.toolpaths = [];
        discardedToolpaths = snapshots.length;
        showToast(error instanceof Error ? error.message : "Failed to rebuild toolpaths after Boolean operation.", "danger");
      } finally {
        finishWorkerJob("boolean");
      }
    }

    state.booleanPreviewContours = null;
    getBooleanModalInstance()?.hide();
    pushHistorySnapshot(historyBefore);
    refreshSelectionUi();
    refreshToolpathUi();
    refreshWorkspaceUi();
    draw();
    const label = state.booleanOperation === "xor" ? "XOR" : state.booleanOperation[0].toUpperCase() + state.booleanOperation.slice(1);
    showToast(`${label} created ${resultLoops.length} vector${resultLoops.length === 1 ? "" : "s"}.${discardedToolpaths ? ` ${discardedToolpaths} mixed toolpath${discardedToolpaths === 1 ? " was" : "s were"} removed.` : ""}`, "success");
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

  function normalizeLibraryToolType(rawTool = {}) {
    const raw = String(rawTool.toolType || rawTool.toolTypeLabel || rawTool.tip || "").trim().toLowerCase();
    if (!raw) {
      return "flat";
    }
    if (raw === "v-bit" || raw.includes("v-bit") || raw.includes("v bit") || raw.includes("engraving vbit") || raw.includes("vee")) {
      return "v-bit";
    }
    if (raw === "ball" || raw === "ballnose" || raw.includes("ball nose") || raw.includes("ballnose") || raw.includes("ball end")) {
      return "ball";
    }
    if (raw === "flat" || raw.includes("square end") || raw.includes("flat")) {
      return "flat";
    }
    return "other";
  }

  function normalizeLibraryTool(tool = {}) {
    return {
      ...tool,
      vendor: tool.vendor || "",
      vendorDisplayName: tool.vendorDisplayName || tool.vendor || "",
      toolType: normalizeLibraryToolType(tool),
      cuttingDiameterMm: Number.isFinite(Number(tool.cuttingDiameterMm)) ? Number(tool.cuttingDiameterMm) : null,
      fluteAngleDeg: Number.isFinite(Number(tool.fluteAngleDeg)) ? Number(tool.fluteAngleDeg) : null,
      shankDiameterMm: Number.isFinite(Number(tool.shankDiameterMm)) ? Number(tool.shankDiameterMm) : null,
      flutes: Number.isFinite(Number(tool.flutes)) ? Number(tool.flutes) : null,
    };
  }

  function getSelectedLibraryTool() {
    return state.toolLibrary.byId.get(state.selectedLibraryToolId) || state.selectedLibraryToolMeta;
  }

  function createEmptyMyEndmillSlot(slotNumber) {
    return {
      slot: slotNumber,
      name: "",
      toolType: "flat",
      libraryToolId: null,
      vendor: "",
      vendorDisplayName: "",
      description: "",
      image: "",
      storeUrl: "",
      operationHints: [],
      cuttingDiameterMm: null,
      fluteAngleDeg: null,
      spindle: null,
      feedRate: null,
      plungeRate: null,
      passDepthMm: null,
    };
  }

  function normalizeMyEndmillSlot(slot, slotNumber) {
    const base = createEmptyMyEndmillSlot(slotNumber);
    const merged = { ...base, ...(slot || {}), slot: slotNumber };
    const optionalNumber = (value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : null;
    };
    return {
      ...merged,
      name: typeof merged.name === "string" ? merged.name.trim() : "",
      toolType: merged.toolType || "flat",
      libraryToolId: merged.libraryToolId || null,
      vendor: merged.vendor || "",
      vendorDisplayName: merged.vendorDisplayName || "",
      description: merged.description || "",
      image: merged.image || "",
      storeUrl: merged.storeUrl || "",
      operationHints: Array.isArray(merged.operationHints) ? merged.operationHints.filter(Boolean) : [],
      cuttingDiameterMm: optionalNumber(merged.cuttingDiameterMm),
      fluteAngleDeg: optionalNumber(merged.fluteAngleDeg),
      spindle: optionalNumber(merged.spindle),
      feedRate: optionalNumber(merged.feedRate),
      plungeRate: optionalNumber(merged.plungeRate),
      passDepthMm: optionalNumber(merged.passDepthMm),
    };
  }

  function loadMyEndmillsFromStorage() {
    let parsed = null;
    try {
      parsed = JSON.parse(window.localStorage.getItem(MY_ENDMILLS_STORAGE_KEY) || "null");
    } catch {
      parsed = null;
    }
    const rawSlots = Array.isArray(parsed?.slots) ? parsed.slots : [];
    state.myEndmills.slots = Array.from({ length: 12 }, (_, index) => normalizeMyEndmillSlot(rawSlots[index], index + 1));
  }

  function saveMyEndmillsToStorage() {
    window.localStorage.setItem(MY_ENDMILLS_STORAGE_KEY, JSON.stringify({
      slots: state.myEndmills.slots,
    }));
  }

  function getMyEndmillSlot(slotNumber) {
    return state.myEndmills.slots.find((slot) => slot.slot === Number(slotNumber)) || null;
  }

  function isConfiguredMyEndmillSlot(slot) {
    return Boolean(slot && slot.name && Number.isFinite(slot.cuttingDiameterMm) && Number.isFinite(slot.feedRate) && Number.isFinite(slot.plungeRate) && Number.isFinite(slot.spindle) && Number.isFinite(slot.passDepthMm));
  }

  function getConfiguredMyEndmillSlots() {
    return state.myEndmills.slots.filter((slot) => isConfiguredMyEndmillSlot(slot));
  }

  function warnOnce(key, message) {
    if (state.lastToolingWarning === key) {
      return;
    }
    state.lastToolingWarning = key;
    showToast(message, "warning");
  }

  function validateToolSlotForOperation(slot, operation, options = {}) {
    if (!slot || !isConfiguredMyEndmillSlot(slot)) {
      return false;
    }
    if ((operation === "vcarve" || operation === "chamfer") && slot.toolType !== "v-bit") {
      if (options.notify !== false) {
        const operationLabel = operation === "chamfer" ? "Chamfer" : "V-Carve";
        warnOnce(`operation:${operation}:slot:${slot.slot}:type:${slot.toolType || "unknown"}`, `${operationLabel} requires a V-bit. Select a V-bit from your tool rack.`);
      }
      return false;
    }
    if (state.lastToolingWarning.startsWith("operation:")) {
      state.lastToolingWarning = "";
    }
    return true;
  }

  function getMyEndmillSlotOperationHints(slot) {
    if (Array.isArray(slot?.operationHints) && slot.operationHints.length) {
      return slot.operationHints;
    }
    if (slot?.toolType === "v-bit") {
      return ["vcarve", "chamfer"];
    }
    if (slot?.toolType === "ball") {
      return ["profile-outside", "profile-inside", "pocket", "engrave"];
    }
    return ["profile-outside", "profile-inside", "pocket", "engrave"];
  }

  function myEndmillSlotSupportsOperation(slot, operation) {
    if (!isConfiguredMyEndmillSlot(slot)) {
      return false;
    }
    const hints = getMyEndmillSlotOperationHints(slot);
    return hints.includes(operation);
  }

  function getConfiguredMyEndmillSlotsForOperation(operation) {
    return state.myEndmills.slots.filter((slot) => myEndmillSlotSupportsOperation(slot, operation));
  }

  function modalRowFieldValue(row, selector) {
    return row.querySelector(selector)?.value?.trim() || "";
  }

  function modalRowHasAnyData(row) {
    const libraryToolId = modalRowFieldValue(row, ".slot-library-tool");
    const name = modalRowFieldValue(row, ".slot-name");
    const diameter = Number.parseFloat(modalRowFieldValue(row, ".slot-diameter"));
    const angle = Number.parseFloat(modalRowFieldValue(row, ".slot-angle"));
    const rpm = Number.parseFloat(modalRowFieldValue(row, ".slot-rpm"));
    const feed = Number.parseFloat(modalRowFieldValue(row, ".slot-feed"));
    const plunge = Number.parseFloat(modalRowFieldValue(row, ".slot-plunge"));
    const passDepth = Number.parseFloat(modalRowFieldValue(row, ".slot-pass-depth"));
    const hasNonZeroNumericValue = [diameter, angle, rpm, feed, plunge, passDepth]
      .some((value) => Number.isFinite(value) && value !== 0);
    return Boolean(
      libraryToolId ||
      name ||
      hasNonZeroNumericValue
    );
  }

  function validateMyEndmillModalRow(row) {
    const toolType = modalRowFieldValue(row, ".slot-tool-type") || "flat";
    const requiredFields = [
      [".slot-name", "Tool name"],
      [".slot-diameter", "Diameter"],
      [".slot-rpm", "Spindle RPM"],
      [".slot-feed", "Feed Rate"],
      [".slot-plunge", "Plunge Rate"],
      [".slot-pass-depth", "Pass Depth"],
    ];
    if (toolType === "v-bit") {
      requiredFields.push([".slot-angle", "V Angle"]);
    }
    let valid = true;
    const missing = [];
    for (const [selector, label] of requiredFields) {
      const input = row.querySelector(selector);
      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
        continue;
      }
      const hasValue = input.value.trim() !== "";
      input.classList.toggle("is-invalid", !hasValue);
      input.setAttribute("aria-invalid", hasValue ? "false" : "true");
      if (!hasValue) {
        input.title = `${label} is required`;
        valid = false;
        missing.push(label);
      } else {
        input.removeAttribute("title");
      }
    }
    return { valid, missing };
  }

  function updateMyEndmillsSaveState() {
    let valid = true;
    const issues = [];
    for (const row of ui.myEndmillsSlots.querySelectorAll("[data-slot-index]")) {
      if (!modalRowHasAnyData(row)) {
        for (const input of row.querySelectorAll(".is-invalid")) {
          input.classList.remove("is-invalid");
          input.removeAttribute("aria-invalid");
          input.removeAttribute("title");
        }
        continue;
      }
      const slotIndex = row.dataset.slotIndex || "?";
      const result = validateMyEndmillModalRow(row);
      valid = result.valid && valid;
      if (!result.valid) {
        issues.push(`T${slotIndex}: ${result.missing.join(", ")}`);
      }
    }
    ui.saveMyEndmillsBtn.disabled = !valid;
    if (ui.myEndmillsValidationHint) {
      const hint = issues.length ? issues[0] : "";
      ui.myEndmillsValidationHint.textContent = hint;
      ui.myEndmillsValidationHint.classList.toggle("d-none", !hint);
    }
    if (!valid && issues.length) {
      ui.saveMyEndmillsBtn.title = issues.join(" | ");
    } else {
      ui.saveMyEndmillsBtn.removeAttribute("title");
    }
    return valid;
  }

  function summarizeMyEndmillSlot(slot) {
    if (!slot) {
      return { title: "No tool slot selected", meta: "Pick a tool from your saved T1 to T12 slots." };
    }
    if (!isConfiguredMyEndmillSlot(slot)) {
      return { title: `T${slot.slot} empty`, meta: "Configure this slot in Edit My Endmills." };
    }
    const title = `T${slot.slot} - ${slot.name}`;
    const meta = [
      Number.isFinite(slot.cuttingDiameterMm) ? `${formatNumber(slot.cuttingDiameterMm)}mm` : "",
      Number.isFinite(slot.passDepthMm) ? `${formatNumber(slot.passDepthMm)}mm/pass` : "",
      Number.isFinite(slot.feedRate) ? `Feed ${Math.round(slot.feedRate)}` : "",
      Number.isFinite(slot.plungeRate) ? `Plunge ${Math.round(slot.plungeRate)}` : "",
      Number.isFinite(slot.spindle) ? `RPM ${Math.round(slot.spindle)}` : "",
    ].filter(Boolean).join(" - ");
    return { title, meta };
  }

  function getToolTypeBadgeLabel(toolType) {
    switch (toolType) {
      case "v-bit":
        return "V-Bit";
      case "ball":
        return "Ball";
      case "flat":
        return "Flat";
      default:
        return "Tool";
    }
  }

  function applyMyEndmillSlotToInputs(slot) {
    if (!slot || !isConfiguredMyEndmillSlot(slot)) {
      return;
    }
    ui.toolNumberInput.value = String(slot.slot);
    ui.toolDiameterInput.value = formatNumber(slot.cuttingDiameterMm);
    ui.cutterAngleInput.value = formatNumber(slot.fluteAngleDeg || 90);
    ui.feedRateInput.value = formatNumber(slot.feedRate);
    ui.plungeRateInput.value = formatNumber(slot.plungeRate);
    ui.spindleInput.value = formatNumber(slot.spindle);
    ui.passDepthInput.value = formatNumber(slot.passDepthMm);
    state.selectedLibraryToolId = slot.libraryToolId || null;
    state.selectedLibraryToolMeta = slot.libraryToolId
      ? state.toolLibrary.byId.get(slot.libraryToolId) || {
        id: slot.libraryToolId,
        name: slot.name,
        vendor: slot.vendor,
        vendorDisplayName: slot.vendorDisplayName,
        image: slot.image,
        libraryToolImage: slot.image,
        storeUrl: slot.storeUrl,
        productUrl: slot.storeUrl,
        purchaseUrl: slot.storeUrl,
        toolType: slot.toolType,
        operationHints: getMyEndmillSlotOperationHints(slot),
        cuttingDiameterMm: slot.cuttingDiameterMm,
        fluteAngleDeg: slot.fluteAngleDeg,
      }
      : {
        id: `custom-slot-${slot.slot}`,
        name: slot.name,
        vendor: slot.vendor,
        vendorDisplayName: slot.vendorDisplayName,
        image: slot.image,
        libraryToolImage: slot.image,
        storeUrl: slot.storeUrl,
        productUrl: slot.storeUrl,
        purchaseUrl: slot.storeUrl,
        toolType: slot.toolType,
        operationHints: getMyEndmillSlotOperationHints(slot),
        cuttingDiameterMm: slot.cuttingDiameterMm,
        fluteAngleDeg: slot.fluteAngleDeg,
      };
  }

  function renderMyEndmillSummary() {
    const slot = getMyEndmillSlot(state.myEndmills.selectedSlot);
    const summary = summarizeMyEndmillSlot(slot);
    const operation = ui.toolpathTypeInput.value;
    const recommended = slot ? myEndmillSlotSupportsOperation(slot, operation) : false;
    const recommendationMeta = slot && isConfiguredMyEndmillSlot(slot)
      ? `<div class="my-endmill-summary-recommendation ${recommended ? "is-recommended" : "is-neutral"}">${recommended ? "Recommended for this operation" : "Not the ideal match for this operation"}</div>`
      : "";
    ui.myEndmillSummary.classList.toggle("empty", !slot || !isConfiguredMyEndmillSlot(slot));
    ui.myEndmillSummary.classList.toggle("is-recommended", recommended);
    ui.myEndmillSummary.innerHTML = `
      <div class="my-endmill-summary-title">${summary.title}</div>
      <div class="my-endmill-summary-meta">${summary.meta}</div>
      ${recommendationMeta}
    `;
  }

  function renderMyEndmillSelect() {
    const operation = ui.toolpathTypeInput.value;
    const tools = getConfiguredMyEndmillSlots();
    const selected = state.myEndmills.selectedSlot;
    ui.myEndmillSelect.innerHTML = "";
    ui.myEndmillSelect.classList.remove("is-recommended");
    const placeholder = document.createElement("option");
    if (!tools.length) {
      placeholder.value = "";
      placeholder.textContent = "Setup your tool library";
      placeholder.disabled = true;
      placeholder.selected = true;
      ui.myEndmillSelect.appendChild(placeholder);
      renderMyEndmillSummary();
      return;
    }
    const choose = document.createElement("option");
    choose.value = "";
    choose.textContent = "Choose a tool slot";
    ui.myEndmillSelect.appendChild(choose);
    for (const slot of tools) {
      const option = document.createElement("option");
      option.value = String(slot.slot);
      const recommended = myEndmillSlotSupportsOperation(slot, operation);
      const badge = getToolTypeBadgeLabel(slot.toolType);
      option.textContent = `${recommended ? "Recommended · " : ""}[${badge}] T${slot.slot} - ${slot.name}`;
      if (recommended) {
        option.classList.add("is-recommended");
        option.style.color = "#15803d";
        option.style.fontWeight = "600";
      }
      option.selected = selected === slot.slot;
      ui.myEndmillSelect.appendChild(option);
    }
    if (!tools.some((slot) => slot.slot === selected)) {
      state.myEndmills.selectedSlot = tools[0]?.slot || null;
    }
    ui.myEndmillSelect.value = state.myEndmills.selectedSlot ? String(state.myEndmills.selectedSlot) : "";
    const slot = getMyEndmillSlot(state.myEndmills.selectedSlot);
    if (slot && myEndmillSlotSupportsOperation(slot, operation)) {
      ui.myEndmillSelect.classList.add("is-recommended");
    }
    applyMyEndmillSlotToInputs(slot);
    renderMyEndmillSummary();
  }

  function syncSelectedMyEndmillForOperation(options = {}) {
    const matching = getConfiguredMyEndmillSlots();
    const preserve = options.preserve !== false;
    if (!preserve || !matching.some((slot) => slot.slot === state.myEndmills.selectedSlot)) {
      state.myEndmills.selectedSlot = matching[0]?.slot || null;
    }
    renderMyEndmillSelect();
  }

  function getToolTypeOptionsMarkup(selectedType) {
    const options = [
      ["flat", "Flat"],
      ["ball", "Ball"],
      ["v-bit", "V-Bit"],
      ["other", "Other"],
    ];
    return options.map(([value, label]) => `<option value="${value}" ${selectedType === value ? "selected" : ""}>${label}</option>`).join("");
  }

  function getLibraryOptionsMarkup(selectedId) {
    const groups = new Map();
    for (const tool of state.toolLibrary.tools) {
      const key = tool.vendorDisplayName || tool.vendor || "Tools";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(tool);
    }
    const markup = [`<option value="">Custom / none</option>`];
    for (const [groupName, tools] of groups.entries()) {
      markup.push(`<optgroup label="${groupName}">`);
      for (const tool of tools.sort((a, b) => a.name.localeCompare(b.name))) {
        markup.push(`<option value="${tool.id}" ${tool.id === selectedId ? "selected" : ""}>${tool.name}</option>`);
      }
      markup.push("</optgroup>");
    }
    return markup.join("");
  }

  function renderMyEndmillsModal() {
    ui.myEndmillsSlots.innerHTML = "";
    for (const slot of state.myEndmills.slots) {
      const summary = summarizeMyEndmillSlot(slot);
      const collapseId = `myEndmillSlotCollapse${slot.slot}`;
      const headingId = `myEndmillSlotHeading${slot.slot}`;
      const item = document.createElement("div");
      item.className = "accordion-item my-endmill-slot";
      item.innerHTML = `
        <h3 class="accordion-header" id="${headingId}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
            <span class="my-endmill-slot-head">
              <span class="my-endmill-slot-title">T${slot.slot}</span>
              <span class="my-endmill-slot-summary">${summary.title}${summary.meta ? ` - ${summary.meta}` : ""}</span>
            </span>
          </button>
        </h3>
        <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headingId}" data-bs-parent="#myEndmillsSlots">
          <div class="accordion-body">
            <div class="row g-3" data-slot-index="${slot.slot}">
              <div class="col-md-6">
                <label class="form-label small mb-1">Library Tool</label>
                <select class="form-select form-select-sm slot-library-tool">
                  ${getLibraryOptionsMarkup(slot.libraryToolId)}
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small mb-1">Tool Name</label>
                <input type="text" class="form-control form-control-sm slot-name" value="${slot.name}">
              </div>
              <div class="col-md-4">
                <label class="form-label small mb-1">Type</label>
                <select class="form-select form-select-sm slot-tool-type">
                  ${getToolTypeOptionsMarkup(slot.toolType)}
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label small mb-1">Diameter</label>
                <div class="input-group input-group-sm">
                  <input type="number" step="0.001" class="form-control slot-diameter" value="${slot.cuttingDiameterMm ?? ""}">
                  <span class="input-group-text">mm</span>
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label small mb-1">V Angle</label>
                <div class="input-group input-group-sm">
                  <input type="number" step="0.1" class="form-control slot-angle" value="${slot.fluteAngleDeg ?? ""}">
                  <span class="input-group-text">deg</span>
                </div>
              </div>
              <div class="col-md-3">
                <label class="form-label small mb-1">Spindle RPM</label>
                <div class="input-group input-group-sm">
                  <input type="number" step="1" class="form-control form-control-sm slot-rpm" value="${slot.spindle ?? ""}">
                  <span class="input-group-text">rpm</span>
                </div>
              </div>
              <div class="col-md-3">
                <label class="form-label small mb-1">Feed Rate</label>
                <div class="input-group input-group-sm">
                  <input type="number" step="1" class="form-control form-control-sm slot-feed" value="${slot.feedRate ?? ""}">
                  <span class="input-group-text">mm/min</span>
                </div>
              </div>
              <div class="col-md-3">
                <label class="form-label small mb-1">Plunge Rate</label>
                <div class="input-group input-group-sm">
                  <input type="number" step="1" class="form-control form-control-sm slot-plunge" value="${slot.plungeRate ?? ""}">
                  <span class="input-group-text">mm/min</span>
                </div>
              </div>
              <div class="col-md-3">
                <label class="form-label small mb-1">Pass Depth</label>
                <div class="input-group input-group-sm">
                  <input type="number" step="0.01" class="form-control slot-pass-depth" value="${slot.passDepthMm ?? ""}">
                  <span class="input-group-text">mm</span>
                </div>
              </div>
              <div class="col-12 d-flex justify-content-end">
                <button type="button" class="btn btn-outline-secondary btn-sm clear-slot-btn">Clear Slot</button>
              </div>
            </div>
          </div>
        </div>
      `;
      ui.myEndmillsSlots.appendChild(item);
      if (slot.libraryToolId) {
        populateSlotEditorFromLibrary(item.querySelector("[data-slot-index]"), slot.libraryToolId, { preserveRates: true, preserveName: true });
      }
    }
    updateMyEndmillsSaveState();
  }

  function populateSlotEditorFromLibrary(slotRow, toolId, options = {}) {
    const tool = state.toolLibrary.byId.get(toolId);
    if (!tool || !slotRow) {
      return;
    }
    if (!options.preserveName || !slotRow.querySelector(".slot-name").value.trim()) {
      slotRow.querySelector(".slot-name").value = tool.name || "";
    }
    slotRow.querySelector(".slot-tool-type").value = tool.toolType || "flat";
    slotRow.querySelector(".slot-diameter").value = Number.isFinite(tool.cuttingDiameterMm) ? formatNumber(tool.cuttingDiameterMm) : "";
    slotRow.querySelector(".slot-angle").value = Number.isFinite(tool.fluteAngleDeg) ? formatNumber(tool.fluteAngleDeg) : "";
    if (!options.preserveRates) {
      slotRow.querySelector(".slot-rpm").value = "";
      slotRow.querySelector(".slot-feed").value = "";
      slotRow.querySelector(".slot-plunge").value = "";
      slotRow.querySelector(".slot-pass-depth").value = "";
    }
  }

  function collectMyEndmillsFromModal() {
    const nextSlots = [];
    for (const row of ui.myEndmillsSlots.querySelectorAll("[data-slot-index]")) {
      const slotNumber = Number.parseInt(row.dataset.slotIndex, 10);
      const libraryToolId = row.querySelector(".slot-library-tool")?.value || null;
      const tool = libraryToolId ? state.toolLibrary.byId.get(libraryToolId) || null : null;
      const slot = normalizeMyEndmillSlot({
        slot: slotNumber,
        libraryToolId,
        name: row.querySelector(".slot-name")?.value || "",
        toolType: row.querySelector(".slot-tool-type")?.value || "flat",
        vendor: tool?.vendor || "",
        vendorDisplayName: tool?.vendorDisplayName || "",
        description: tool ? buildToolLibraryDescription(tool) : "",
        image: tool ? getToolLibraryImageUrl(tool) : "",
        storeUrl: tool?.storeUrl || tool?.purchaseUrl || tool?.productUrl || "",
        operationHints: tool?.operationHints || [],
        cuttingDiameterMm: Number.parseFloat(row.querySelector(".slot-diameter")?.value || ""),
        fluteAngleDeg: Number.parseFloat(row.querySelector(".slot-angle")?.value || ""),
        spindle: Number.parseFloat(row.querySelector(".slot-rpm")?.value || ""),
        feedRate: Number.parseFloat(row.querySelector(".slot-feed")?.value || ""),
        plungeRate: Number.parseFloat(row.querySelector(".slot-plunge")?.value || ""),
        passDepthMm: Number.parseFloat(row.querySelector(".slot-pass-depth")?.value || ""),
      }, slotNumber);
      if (!slot.name && !slot.libraryToolId && !slot.cuttingDiameterMm && !slot.feedRate && !slot.plungeRate && !slot.spindle && !slot.passDepthMm) {
        nextSlots.push(createEmptyMyEndmillSlot(slotNumber));
      } else {
        nextSlots.push(slot);
      }
    }
    return nextSlots;
  }

  function getMyEndmillsModalInstance() {
    if (!ui.myEndmillsModal) {
      return null;
    }
    if (!myEndmillsModalInstance) {
      if (window.bootstrap?.Modal) {
        myEndmillsModalInstance = window.bootstrap.Modal.getOrCreateInstance(ui.myEndmillsModal, {
          backdrop: "static",
        });
      } else {
        myEndmillsModalInstance = {
          show() {
            ui.myEndmillsModal.classList.add("show");
            ui.myEndmillsModal.style.display = "block";
            ui.myEndmillsModal.removeAttribute("aria-hidden");
            ui.myEndmillsModal.setAttribute("aria-modal", "true");
            document.body.classList.add("modal-open");
          },
          hide() {
            ui.myEndmillsModal.classList.remove("show");
            ui.myEndmillsModal.style.display = "none";
            ui.myEndmillsModal.setAttribute("aria-hidden", "true");
            ui.myEndmillsModal.removeAttribute("aria-modal");
            document.body.classList.remove("modal-open");
          },
        };
      }
    }
    return myEndmillsModalInstance;
  }

  function getBitmapTraceModalInstance() {
    if (!ui.bitmapTraceModal) {
      return null;
    }
    if (!bitmapTraceModalInstance) {
      if (window.bootstrap?.Modal) {
        bitmapTraceModalInstance = window.bootstrap.Modal.getOrCreateInstance(ui.bitmapTraceModal, {
          backdrop: "static",
        });
      } else {
        bitmapTraceModalInstance = {
          show() {
            ui.bitmapTraceModal.classList.add("show");
            ui.bitmapTraceModal.style.display = "block";
            document.body.classList.add("modal-open");
          },
          hide() {
            ui.bitmapTraceModal.classList.remove("show");
            ui.bitmapTraceModal.style.display = "none";
            document.body.classList.remove("modal-open");
          },
        };
      }
    }
    return bitmapTraceModalInstance;
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
    if (operation === "vcarve" || operation === "chamfer") {
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
      tools.push(...sourceTools.map((tool) => normalizeLibraryTool({ ...tool, vendor: tool.vendor || source.vendor })));
    }
    state.toolLibrary.tools = tools;
    state.toolLibrary.byId = new Map(tools.map((tool) => [tool.id, tool]));
    state.toolLibrary.loaded = true;
    if (state.selectedLibraryToolId && state.toolLibrary.byId.has(state.selectedLibraryToolId)) {
      state.selectedLibraryToolMeta = state.toolLibrary.byId.get(state.selectedLibraryToolId);
    }
    syncSelectedMyEndmillForOperation({ preserve: true });
  }

  function refreshWorkspaceUi() {
    const hasGeometry = state.loops.length > 0;
    const hasSelection = state.selectedLoopIds.size > 0;
    if (!hasSelection && state.transformTool) {
      state.transformTool = null;
    }

    updateDockStatus();
    ui.canvasEmptyState.classList.toggle("d-none", hasGeometry || state.emptyCanvasStarted || Boolean(state.cadTool));
    ui.canvasWrap.classList.toggle("is-drop-target", state.dragImportActive);
    if (ui.emptyStateDropNote) {
      ui.emptyStateDropNote.textContent = state.dragImportActive
        ? "Drop DXF/SVG to open"
        : "or drag DXF/SVG here";
    }
    ui.vectorActionGroup.classList.remove("d-none");
    ui.cadActionGroup.classList.toggle("d-none", false);
    ui.clearGuidesBtn.classList.toggle("d-none", !state.entities.some((entity) => entity.type === "GUIDE"));

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

  function snapCadPoint(screenPoint) {
    const world = screenToWorld(screenPoint);
    if (!state.cadSnapEnabled) {
      return world;
    }

    const snapRadius = 12;
    let closest = null;
    for (const loop of state.loops) {
      for (const segment of loop.segments || []) {
        for (const candidate of [segment.start, segment.end]) {
          if (!candidate) {
            continue;
          }
          const screen = worldToScreen(candidate);
          const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
          if (distance <= snapRadius && (!closest || distance < closest.distance)) {
            closest = { point: { x: candidate.x, y: candidate.y }, distance };
          }
        }
      }
      if (loop.bounds) {
        const { minX, minY, maxX, maxY } = loop.bounds;
        const candidates = [
          { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
          { x: minX, y: minY },
          { x: minX, y: maxY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
        ];
        for (const candidate of candidates) {
          const screen = worldToScreen(candidate);
          const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
          if (distance <= snapRadius && (!closest || distance < closest.distance)) {
            closest = { point: candidate, distance };
          }
        }
      }
    }
    if (closest) {
      return closest.point;
    }

    const grid = getGridSpacing();
    return {
      x: Math.round(world.x / grid) * grid,
      y: Math.round(world.y / grid) * grid,
    };
  }

  function nearestPointOnInfiniteLine(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 1e-9) {
      return { x: start.x, y: start.y };
    }
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    return { x: start.x + dx * t, y: start.y + dy * t };
  }

  function createCadRectangleEntity(center, width, height, radius = 0, angleRad = 0) {
    const halfWidth = Math.max(0.0005, width / 2);
    const halfHeight = Math.max(0.0005, height / 2);
    const cappedRadius = Math.min(Math.max(0, radius), halfWidth, halfHeight);
    const minX = center.x - halfWidth;
    const maxX = center.x + halfWidth;
    const minY = center.y - halfHeight;
    const maxY = center.y + halfHeight;
    const entity = {
      type: "LWPOLYLINE",
      closed: true,
      __cadShape: "rectangle",
      __cadCornerRadius: cappedRadius,
      vertices: cappedRadius > 0.001
        ? [
          { x: minX + cappedRadius, y: minY, bulge: 0 },
          { x: maxX - cappedRadius, y: minY, bulge: Math.tan(Math.PI / 8) },
          { x: maxX, y: minY + cappedRadius, bulge: 0 },
          { x: maxX, y: maxY - cappedRadius, bulge: Math.tan(Math.PI / 8) },
          { x: maxX - cappedRadius, y: maxY, bulge: 0 },
          { x: minX + cappedRadius, y: maxY, bulge: Math.tan(Math.PI / 8) },
          { x: minX, y: maxY - cappedRadius, bulge: 0 },
          { x: minX, y: minY + cappedRadius, bulge: Math.tan(Math.PI / 8) },
        ]
        : [
          { x: minX, y: minY, bulge: 0 },
          { x: maxX, y: minY, bulge: 0 },
          { x: maxX, y: maxY, bulge: 0 },
          { x: minX, y: maxY, bulge: 0 },
        ],
    };
    return Math.abs(angleRad) > 1e-9
      ? transformEntity(entity, matrixForRotation(angleRad, center.x, center.y))
      : entity;
  }

  function createCadEntity(tool, draft) {
    const { points } = draft;
    if (tool === "line") {
      return {
        type: "LINE",
        __cadShape: "line",
        x1: points[0].x,
        y1: points[0].y,
        x2: points[1].x,
        y2: points[1].y,
      };
    }
    if (tool === "polyline") {
      return {
        type: "LWPOLYLINE",
        __cadShape: "polyline",
        closed: false,
        vertices: points.map((point) => ({ x: point.x, y: point.y, bulge: 0 })),
      };
    }
    if (tool === "rectangle") {
      const [a, b] = points;
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      return createCadRectangleEntity({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, maxX - minX, maxY - minY);
    }
    if (tool === "circle") {
      const [center, edge] = points;
      return {
        type: "CIRCLE",
        __cadShape: "circle",
        cx: center.x,
        cy: center.y,
        radius: Math.hypot(edge.x - center.x, edge.y - center.y),
      };
    }
    if (tool === "arc") {
      const [center, start, end] = points;
      return {
        type: "ARC",
        __cadShape: "arc",
        cx: center.x,
        cy: center.y,
        radius: Math.hypot(start.x - center.x, start.y - center.y),
        startAngleDeg: (Math.atan2(start.y - center.y, start.x - center.x) * 180) / Math.PI,
        endAngleDeg: (Math.atan2(end.y - center.y, end.x - center.x) * 180) / Math.PI,
      };
    }
    if (tool === "bezier") {
      return {
        type: "SPLINE",
        __cadShape: "bezier",
        degree: 3,
        knots: [0, 0, 0, 0, 1, 1, 1, 1],
        controlPoints: points.map((point) => ({ x: point.x, y: point.y, w: 1 })),
      };
    }
    if (tool === "guide") {
      return {
        type: "GUIDE",
        __cadShape: "guide",
        start: { x: points[0].x, y: points[0].y },
        end: { x: points[1].x, y: points[1].y },
      };
    }
    return null;
  }

  async function createCadTextEntity(origin, text, height, fontId) {
    const fontOption = CadFont.FONT_OPTIONS.find((option) => option.id === fontId) || CadFont.FONT_OPTIONS[0];
    const outlineFont = fontOption.kind === "outline" ? await CadFont.loadOutlineFont(fontOption.id) : null;
    return {
      type: "CAD_TEXT",
      __cadShape: "text",
      text,
      height,
      fontId: fontOption.id,
      fontName: fontOption.name,
      __cadTextMode: fontOption.kind,
      strokes: outlineFont
        ? CadFont.createOutlineText(outlineFont, text, origin, height)
        : CadFont.createStrokeText(text, origin, height),
    };
  }

  function selectEntityIndex(index) {
    state.selectedLoopIds.clear();
    for (const loop of state.loops) {
      if (loop.sourceEntityIndexes?.includes(index)) {
        state.selectedLoopIds.add(loop.id);
      }
    }
  }

  function getSelectedCadEntity() {
    const indexes = getSelectedEntityIndexes();
    if (indexes.length !== 1) {
      return null;
    }
    const entity = state.entities[indexes[0]];
    if (!entity?.__cadShape || entity.__cadShape === "guide") {
      return null;
    }
    return { entity, index: indexes[0] };
  }

  function cadShapeLabel(shape) {
    return {
      line: "Line",
      polyline: "Polyline",
      rectangle: "Rectangle",
      circle: "Circle",
      arc: "Arc",
      bezier: "Bezier curve",
      text: "Vector text",
    }[shape] || "CAD shape";
  }

  function refreshCadInspector() {
    const selected = getSelectedCadEntity();
    const show = Boolean(selected)
      && state.cadEditMode
      && !state.cadInspectorDismissed
      && !state.cadTool
      && !state.transformTool
      && !state.transformingGeometry;
    ui.cadInspector.classList.toggle("d-none", !show);
    if (!show) {
      return;
    }
    const frame = getSelectionFrame();
    if (!frame) {
      ui.cadInspector.classList.add("d-none");
      return;
    }
    const isRectangle = selected.entity.__cadShape === "rectangle";
    ui.cadInspectorTitle.textContent = cadShapeLabel(selected.entity.__cadShape);
    ui.cadInspectorXInput.value = formatNumber(frame.center.x);
    ui.cadInspectorYInput.value = formatNumber(frame.center.y);
    ui.cadInspectorWidthInput.value = formatNumber(frame.width);
    ui.cadInspectorHeightInput.value = formatNumber(frame.height);
    ui.cadInspectorAngleInput.value = formatNumber((frame.angle * 180) / Math.PI);
    ui.cadInspectorRadiusField.classList.toggle("d-none", !isRectangle);
    if (isRectangle) {
      ui.cadInspectorRadiusInput.value = formatNumber(selected.entity.__cadCornerRadius || 0);
    }
  }

  async function applyCadInspectorChanges() {
    const selected = getSelectedCadEntity();
    const frame = getSelectionFrame();
    if (!selected || !frame) {
      return;
    }
    const targetX = Number.parseFloat(ui.cadInspectorXInput.value);
    const targetY = Number.parseFloat(ui.cadInspectorYInput.value);
    const targetWidth = Number.parseFloat(ui.cadInspectorWidthInput.value);
    const targetHeight = Number.parseFloat(ui.cadInspectorHeightInput.value);
    const targetAngleDeg = Number.parseFloat(ui.cadInspectorAngleInput.value);
    if (![targetX, targetY, targetWidth, targetHeight, targetAngleDeg].every(Number.isFinite)
      || targetWidth <= 0 || targetHeight <= 0) {
      showToast("Enter a valid position, size, and angle.", "warning");
      return;
    }
    const historyBefore = captureHistorySnapshot();
    const context = captureSelectionTransformContext();
    if (!context) {
      return;
    }
    const targetAngle = (targetAngleDeg * Math.PI) / 180;
    if (selected.entity.__cadShape === "rectangle") {
      const requestedRadius = Number.parseFloat(ui.cadInspectorRadiusInput.value);
      if (!Number.isFinite(requestedRadius) || requestedRadius < 0) {
        showToast("Corner radius must be zero or greater.", "warning");
        return;
      }
      state.entities[selected.index] = createCadRectangleEntity(
        { x: targetX, y: targetY },
        targetWidth,
        targetHeight,
        requestedRadius,
        targetAngle
      );
      state.selectionFrameAngles.set(context.selectedEntityKey, normalizeRadians(targetAngle));
      rebuildLoopsFromEntities(context.selectionSignatures);
      await applySelectionTransformAndRebuild(null, context);
    } else {
      const scaleX = targetWidth / frame.width;
      const scaleY = targetHeight / frame.height;
      if (selectionContainsCurvedEntities() && Math.abs(scaleX - scaleY) > 1e-6) {
        showToast("Curved shapes need proportional resize. Set matching width and height scaling.", "warning");
        return;
      }
      const deltaAngle = targetAngle - frame.angle;
      const matrix = multiplyMatrices(
        matrixForTranslation(targetX - frame.center.x, targetY - frame.center.y),
        multiplyMatrices(
          matrixForRotation(deltaAngle, frame.center.x, frame.center.y),
          matrixForFrameScale(scaleX, scaleY, frame)
        )
      );
      context.resultAngle = normalizeRadians(targetAngle);
      await applySelectionTransformAndRebuild(matrix, context);
    }
    pushHistorySnapshot(historyBefore);
    state.cadInspectorDismissed = false;
    refreshCadInspector();
  }

  function commitCadDraft() {
    const entity = createCadEntity(state.cadTool, state.cadDraft);
    if (!entity) {
      return;
    }
    const span = entity.type === "GUIDE"
      ? Math.hypot(entity.end.x - entity.start.x, entity.end.y - entity.start.y)
      : 1;
    if ((entity.type === "LINE" && Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1) < 0.001) || span < 0.001) {
      return;
    }
    if ((entity.type === "CIRCLE" || entity.type === "ARC") && entity.radius < 0.001) {
      return;
    }
    const historyBefore = captureHistorySnapshot();
    const index = state.entities.length;
    state.entities.push(entity);
    rebuildLoopsFromEntities(new Set());
    if (entity.type !== "GUIDE") {
      selectEntityIndex(index);
    }
    state.cadDraft = null;
    pushHistorySnapshot(historyBefore);
    refreshSelectionUi();
    refreshToolpathUi();
    refreshWorkspaceUi();
    requestDraw();
  }

  function showCadTextPanel(screenPoint) {
    state.cadTextPlacement = snapCadPoint(screenPoint);
    ui.cadTextPanel.classList.remove("d-none");
    ui.cadTextInput.focus();
    ui.cadTextInput.select();
  }

  function hideCadTextPanel() {
    state.cadTextPlacement = null;
    ui.cadTextPanel.classList.add("d-none");
  }

  function updateCadTextFontPreview() {
    const option = CadFont.FONT_OPTIONS.find((candidate) => candidate.id === ui.cadTextFontSelect.value);
    ui.cadTextFontSelect.style.fontFamily = option?.family || "sans-serif";
  }

  async function commitCadText() {
    if (!state.cadTextPlacement) {
      return;
    }
    const text = ui.cadTextInput.value.trim();
    const fontId = ui.cadTextFontSelect.value;
    const height = Number.parseFloat(ui.cadTextHeightInput.value);
    if (!text) {
      showToast("Enter text to add.", "warning");
      ui.cadTextInput.focus();
      return;
    }
    if (!Number.isFinite(height) || height <= 0) {
      showToast("Text height must be greater than zero.", "warning");
      return;
    }
    const historyBefore = captureHistorySnapshot();
    const index = state.entities.length;
    try {
      state.entities.push(await createCadTextEntity(state.cadTextPlacement, text, height, fontId));
    } catch (error) {
      showToast(error?.message || "Could not create vector text.", "danger");
      return;
    }
    rebuildLoopsFromEntities(new Set());
    selectEntityIndex(index);
    hideCadTextPanel();
    pushHistorySnapshot(historyBefore);
    refreshSelectionUi();
    refreshToolpathUi();
    refreshWorkspaceUi();
    requestDraw();
  }

  function handleCadPointerDown(screenPoint) {
    if (state.cadTool === "text") {
      showCadTextPanel(screenPoint);
      return true;
    }
    const snapped = snapCadPoint(screenPoint);
    if (!state.cadDraft) {
      state.cadDraft = { tool: state.cadTool, points: [snapped], preview: snapped };
      requestDraw();
      return true;
    }

    state.cadDraft.points.push(snapped);
    state.cadDraft.preview = snapped;
    const pointsRequired = state.cadTool === "bezier" ? 4 : state.cadTool === "arc" ? 3 : state.cadTool === "polyline" ? Number.POSITIVE_INFINITY : 2;
    if (state.cadDraft.points.length >= pointsRequired) {
      commitCadDraft();
    } else {
      requestDraw();
    }
    return true;
  }

  function updateCadDraft(screenPoint) {
    if (!state.cadDraft) {
      return;
    }
    state.cadDraft.preview = snapCadPoint(screenPoint);
    requestDraw();
  }

  function setCadTool(nextTool) {
    state.cadTool = state.cadTool === nextTool ? null : nextTool;
    state.cadEditMode = false;
    state.cadDraft = null;
    hideCadTextPanel();
    state.transformTool = null;
    for (const button of ui.cadToolButtons) {
      const active = button.dataset.cadTool === state.cadTool;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    updateSelectModeUi();
    refreshWorkspaceUi();
    refreshSidebarMode();
    updateCanvasCursor();
    requestDraw();
  }

  function setSelectMode() {
    state.cadEditMode = false;
    state.cadTool = null;
    state.cadDraft = null;
    hideCadTextPanel();
    state.transformTool = null;
    state.addTabsMode = false;
    for (const button of ui.cadToolButtons) {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    }
    updateTransformToolUi();
    refreshWorkspaceUi();
    updateCanvasCursor();
    requestDraw();
  }

  function setCadEditMode() {
    state.cadEditMode = !state.cadEditMode;
    state.cadTool = null;
    state.cadDraft = null;
    hideCadTextPanel();
    state.transformTool = null;
    state.addTabsMode = false;
    state.cadInspectorDismissed = false;
    clearToolpathEditing();
    clearDraftToolpath();
    if (state.cadEditMode) {
      state.selectedLoopIds.clear();
      state.hoveredLoopId = null;
    }
    for (const button of ui.cadToolButtons) {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    }
    updateTransformToolUi();
    refreshWorkspaceUi();
    refreshCadInspector();
    updateCanvasCursor();
    requestDraw();
  }

  function clearConstructionGuides() {
    if (!state.entities.some((entity) => entity.type === "GUIDE")) {
      return;
    }
    const historyBefore = captureHistorySnapshot();
    state.entities = state.entities.filter((entity) => entity.type !== "GUIDE");
    pushHistorySnapshot(historyBefore);
    refreshWorkspaceUi();
    requestDraw();
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
    const hitSampleStep = Math.max(0.05, 4 / Math.max(state.camera.zoom, 0.01));
    for (const loop of state.loops) {
      loop.path2d = Paths.createLoopPath2D(loop.segments, worldToScreen, state.camera.zoom, loop.closed !== false);
      loop.hitContours = loop.segments
        .map((segment) => segment.flatten?.(hitSampleStep) || [])
        .filter((contour) => contour.length > 1);
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
    syncSelectedMyEndmillForOperation({ preserve: true });
    updateTransformToolUi();
    refreshSidebarMode();
    refreshWorkspaceUi();
    refreshCadInspector();
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
      onClearTabs: (toolpath) => clearTabsForToolpath(toolpath),
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
    if (!config) {
      state.draftToolpath = null;
      finishWorkerJob("draft");
      refreshToolpathUi();
      refreshWorkspaceUi();
      requestDraw();
      return;
    }
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
    const slot = getMyEndmillSlot(state.myEndmills.selectedSlot);
    const operation = ui.toolpathTypeInput.value;
    if (!validateToolSlotForOperation(slot, operation)) {
      return null;
    }
    applyMyEndmillSlotToInputs(slot);
    const toolDiameter = Number.parseFloat(ui.toolDiameterInput.value) || 6;
    const tabWidth = Math.min(50, Math.max(3, Number.parseFloat(ui.tabWidthInput.value) || 9));
    const selectedTool = getSelectedLibraryTool();
    ui.tabWidthInput.value = formatNumber(tabWidth);
    return {
      operation,
      toolNumber: slot.slot,
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
    state.myEndmills.selectedSlot = toolpath.toolNumber || null;
    const selectedSlot = getMyEndmillSlot(state.myEndmills.selectedSlot);
    if (selectedSlot && isConfiguredMyEndmillSlot(selectedSlot)) {
      applyMyEndmillSlotToInputs(selectedSlot);
    } else {
      ui.toolNumberInput.value = toolpath.toolNumber || 1;
      ui.toolDiameterInput.value = toolpath.toolDiameter;
      ui.cutterAngleInput.value = toolpath.cutterAngle || 90;
      ui.feedRateInput.value = toolpath.feedRate;
      ui.plungeRateInput.value = toolpath.plungeRate;
      ui.spindleInput.value = toolpath.spindle;
      ui.passDepthInput.value = toolpath.passDepth;
    }
    ui.overlapInput.value = toolpath.overlapPercent;
    ui.cutDepthInput.value = toolpath.cutDepth;
    ui.tabWidthInput.value = formatNumber(Math.min(50, Math.max(3, toolpath.tabWidth)));
    ui.tabHeightInput.value = toolpath.tabHeight;
    ui.safeZInput.value = toolpath.safeZ;
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
    syncSelectedMyEndmillForOperation({ preserve: true });
    refreshOperationUi();
    refreshToolpathFieldVisibility();
    renderMyEndmillSummary();
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

  function clearTabsForToolpath(toolpath) {
    if (!toolpath || !operationUsesTabs(toolpath)) {
      return;
    }
    if (!window.confirm(`Clear all tabs from ${toolpath.label}?`)) {
      return;
    }
    const historyBefore = captureHistorySnapshot();
    toolpath.tabs = [];
    refreshToolpathUi();
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
    if (!entities.length) {
      showToast(`No usable vectors found in ${name}.`, "warning");
      return;
    }
    const hasExistingGeometry = state.entities.length > 0;
    const historyBefore = hasExistingGeometry || state.toolpaths.length ? captureHistorySnapshot() : null;
    if (!hasExistingGeometry) {
      state.fileName = name;
    }
    const rawBounds = boundsOfEntities(entities);
    const shiftX = rawBounds ? -rawBounds.minX : 0;
    const shiftY = rawBounds ? (sourceLabel === "SVG" ? rawBounds.maxY : -rawBounds.minY) : 0;

    state.importTranslation = { x: shiftX, y: shiftY };
    const importedEntities = entities.map((entity) => {
      const translated = translateEntity(entity, shiftX, sourceLabel === "SVG" ? 0 : shiftY);
      if (sourceLabel !== "SVG") {
        return translated;
      }
      return mirrorEntityY(translated, rawBounds?.maxY || 0);
    });
    state.entities.push(...importedEntities);
    state.emptyCanvasStarted = false;
    rebuildLoopsFromEntities(new Set());
    state.selectedLoopIds.clear();
    state.addTabsMode = false;
    state.dragImportActive = false;
    state.geometryTransform = null;
    state.transformingGeometry = false;
    clearToolpathEditing();
    clearDraftToolpath();
    fitCameraToBounds(state.bounds);
    loopPathsDirty = true;
    refreshSelectionUi();
    refreshToolpathUi();
    refreshWorkspaceUi();
    draw();
    pushHistorySnapshot(historyBefore);
    if (hasExistingGeometry) {
      showToast(`Added ${name} to the canvas.`, "success");
    }
  }

  function startNewEmptyCanvas() {
    const hasWork = state.entities.length > 0 || state.toolpaths.length > 0;
    if (hasWork && !window.confirm("Start a new canvas? This clears the current vectors and toolpaths.")) {
      return;
    }
    const historyBefore = hasWork ? captureHistorySnapshot() : null;
    state.fileName = "";
    state.entities = [];
    state.loops = [];
    state.selectedLoopIds.clear();
    state.toolpaths = [];
    state.activeToolpathId = null;
    state.addTabsMode = false;
    state.cadTool = null;
    state.cadDraft = null;
    state.geometryTransform = null;
    state.transformingGeometry = false;
    state.transformTool = null;
    state.bounds = null;
    state.emptyCanvasStarted = true;
    state.camera = { zoom: 1, panX: 0, panY: 0 };
    clearToolpathEditing();
    clearDraftToolpath();
    loopPathsDirty = true;
    refreshSelectionUi();
    refreshToolpathUi();
    refreshWorkspaceUi();
    updateCanvasCursor();
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
    if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
      openBitmapTraceDialog(file);
      return;
    }
    const text = await file.text();
    if (/\.svg$/i.test(file.name) || /^\s*<svg[\s>]/i.test(text)) {
      loadSvgText(text, file.name);
      return;
    }
    loadDxfText(text, file.name);
  }

  async function openBitmapTraceDialog(file) {
    state.pendingBitmapFile = file;
    state.traceSourceImageData = null;
    state.tracePreviewSvg = "";
    state.tracePreviewToken += 1;
    ui.bitmapTraceFileName.textContent = file.name;
    ui.traceThresholdValue.textContent = ui.traceThresholdInput.value;
    ui.traceCornerValue.textContent = Number.parseFloat(ui.traceCornerInput.value).toFixed(2);
    ui.tracePreview.innerHTML = '<span class="trace-preview-empty">Preparing preview...</span>';
    ui.tracePreviewStatus.textContent = "Preparing image...";
    getBitmapTraceModalInstance()?.show();
    try {
      state.traceSourceImageData = await rasterizeBitmap(file, 900);
      scheduleTracePreview(true);
    } catch (error) {
      ui.tracePreviewStatus.textContent = "Preview unavailable";
      showToast(error instanceof Error ? error.message : "The bitmap could not be read.", "danger");
    }
  }

  function getTraceSettings() {
    return {
      threshold: Number.parseInt(ui.traceThresholdInput.value, 10) || 0,
      turnpolicy: "right",
      turdsize: Math.max(0, Number.parseInt(ui.traceSpeckleInput.value, 10) || 0),
      alphamax: Math.min(1.33, Math.max(0, Number.parseFloat(ui.traceCornerInput.value) || 0)),
      optcurve: ui.traceOptimizeInput.checked,
      opttolerance: 0.2,
      blackOnWhite: !ui.traceInvertInput.checked,
    };
  }

  function scheduleTracePreview(immediate = false) {
    if (state.tracePreviewTimer) {
      window.clearTimeout(state.tracePreviewTimer);
    }
    state.tracePreviewTimer = window.setTimeout(() => {
      state.tracePreviewTimer = null;
      renderTracePreview();
    }, immediate ? 0 : 160);
  }

  async function renderTracePreview() {
    if (!state.pendingBitmapFile || !state.traceSourceImageData) {
      return;
    }
    const token = ++state.tracePreviewToken;
    ui.tracePreviewStatus.textContent = "Tracing preview...";
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const svg = await traceImageData(state.traceSourceImageData, getTraceSettings());
      if (token !== state.tracePreviewToken) {
        return;
      }
      state.tracePreviewSvg = svg;
      ui.tracePreview.innerHTML = svg;
      ui.tracePreviewStatus.textContent = "Live preview";
    } catch (error) {
      if (token !== state.tracePreviewToken) {
        return;
      }
      ui.tracePreview.innerHTML = '<span class="trace-preview-empty">No trace produced. Raise the brightness threshold or use a clearer image.</span>';
      ui.tracePreviewStatus.textContent = "No contours";
    }
  }

  function traceImageData(imageData, settings, flipY = false) {
    const bitmap = new Potrace.Bitmap(imageData.width, imageData.height);
    for (let index = 0, pixel = 0; index < imageData.data.length; index += 4, pixel += 1) {
      const alpha = imageData.data[index + 3] / 255;
      const luminance = (
        imageData.data[index] * 0.2126
        + imageData.data[index + 1] * 0.7152
        + imageData.data[index + 2] * 0.0722
      ) * alpha + 255 * (1 - alpha);
      const isDark = luminance < settings.threshold;
      bitmap.data[pixel] = settings.blackOnWhite ? Number(isDark) : Number(!isDark);
    }
    const pathList = Potrace.traceBitmap(bitmap, settings);
    return buildPotraceSvg(pathList, imageData.width, imageData.height, flipY);
  }

  function buildPotraceSvg(pathList, width, height, flipY) {
    const paths = Potrace.getPaths(pathList);
    const pathData = paths.map((segments) => {
      if (!segments.length) {
        return "";
      }
      const commands = [`M ${segments[0].x.toFixed(3)} ${segments[0].y.toFixed(3)}`];
      for (const segment of segments.slice(1)) {
        if (segment.type === "CURVE") {
          commands.push(`C ${segment.x1.toFixed(3)} ${segment.y1.toFixed(3)} ${segment.x2.toFixed(3)} ${segment.y2.toFixed(3)} ${segment.x.toFixed(3)} ${segment.y.toFixed(3)}`);
        } else {
          commands.push(`L ${segment.x.toFixed(3)} ${segment.y.toFixed(3)}`);
        }
      }
      commands.push("Z");
      return commands.join(" ");
    }).filter(Boolean).join(" ");
    if (!pathData) {
      throw new Error("No vector contours were found. Raise the brightness threshold or use a clearer image.");
    }
    const path = `<path d="${pathData}" fill="#000000" fill-rule="evenodd"/>`;
    const content = flipY ? `<g transform="translate(0 ${height}) scale(1 -1)">${path}</g>` : path;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${content}</svg>`;
  }

  async function tracePendingBitmap() {
    const file = state.pendingBitmapFile;
    if (!file) {
      return;
    }
    ui.traceBitmapBtn.disabled = true;
    ui.traceBitmapBtn.textContent = "Tracing...";
    startWorkerJob("trace", { label: "Tracing bitmap", percent: 10, priority: 2 });
    try {
      updateWorkerJob("trace", { label: "Preparing bitmap", percent: 35, priority: 2 });
      const imageData = await rasterizeBitmap(file, 1800);
      updateWorkerJob("trace", { label: "Vectorizing contours", percent: 62, priority: 2 });
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const svg = await traceImageData(imageData, getTraceSettings(), true);
      updateWorkerJob("trace", { label: "Importing vectors", percent: 88, priority: 2 });
      const entities = parseSvgFile(svg);
      if (!entities.length) {
        throw new Error("No vector contours were found. Raise the brightness threshold or use a clearer image.");
      }
      loadImportedEntities(entities, `${file.name.replace(/\.[^.]+$/, "")}.svg`, "Potrace bitmap");
      getBitmapTraceModalInstance()?.hide();
      clearBitmapTraceState();
      showToast(`Traced ${entities.length} vector paths from ${file.name}.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Bitmap tracing failed.", "danger");
    } finally {
      finishWorkerJob("trace");
      ui.traceBitmapBtn.disabled = false;
      ui.traceBitmapBtn.textContent = "Import Vectors";
    }
  }

  function clearBitmapTraceState() {
    state.pendingBitmapFile = null;
    state.traceSourceImageData = null;
    state.tracePreviewSvg = "";
    state.tracePreviewToken += 1;
    if (state.tracePreviewTimer) {
      window.clearTimeout(state.tracePreviewTimer);
      state.tracePreviewTimer = null;
    }
  }

  function loadBitmap(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("The bitmap could not be read."));
      };
      image.src = url;
    });
  }

  async function rasterizeBitmap(file, maxDimension) {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.naturalWidth, bitmap.naturalHeight));
    const width = Math.max(1, Math.round(bitmap.naturalWidth * scale));
    const height = Math.max(1, Math.round(bitmap.naturalHeight * scale));
    const traceCanvas = document.createElement("canvas");
    traceCanvas.width = width;
    traceCanvas.height = height;
    const traceCtx = traceCanvas.getContext("2d", { willReadFrequently: true });
    traceCtx.fillStyle = "#ffffff";
    traceCtx.fillRect(0, 0, width, height);
    traceCtx.drawImage(bitmap, 0, 0, width, height);
    return traceCtx.getImageData(0, 0, width, height);
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
    if (hit) {
      state.cadInspectorDismissed = false;
    }
    if (!append) {
      state.selectedLoopIds.clear();
    }
    if (hit) {
      const textEntityIndex = (hit.sourceEntityIndexes || []).find((index) => state.entities[index]?.type === "CAD_TEXT");
      const linkedLoopIds = textEntityIndex === undefined
        ? [hit.id]
        : state.loops
          .filter((loop) => loop.sourceEntityIndexes?.includes(textEntityIndex))
          .map((loop) => loop.id);
      if (append && linkedLoopIds.every((id) => state.selectedLoopIds.has(id))) {
        for (const id of linkedLoopIds) {
          state.selectedLoopIds.delete(id);
        }
      } else {
        for (const id of linkedLoopIds) {
          state.selectedLoopIds.add(id);
        }
      }
    }
    refreshSelectionUi();
    refreshToolpathUi();
    draw();
  }

  function isLoopBorderHit(loop, screenPoint, hitRadius = 14) {
    const worldPoint = screenToWorld(screenPoint);
    const maxWorldDistance = hitRadius / Math.max(state.camera.zoom, 0.01);
    return (loop.hitContours || []).some((contour) => {
      const nearest = nearestPointOnPolyline(contour, worldPoint);
      return nearest && nearest.distance <= maxWorldDistance;
    });
  }

  function findLoopHit(point, predicate = null) {
    if (loopPathsDirty) {
      rebuildLoopPaths();
      loopPathsDirty = false;
    }
    for (let i = state.loops.length - 1; i >= 0; i -= 1) {
      const loop = state.loops[i];
      if (predicate && !predicate(loop)) {
        continue;
      }
      if (loop.closed !== false) {
        if (ctx.isPointInPath(loop.path2d, point.x, point.y)) {
          return loop;
        }
        if (isLoopBorderHit(loop, point)) {
          return loop;
        }
        continue;
      }
      if (isLoopBorderHit(loop, point)) {
        return loop;
      }
    }
    return null;
  }

  function isCadLoop(loop) {
    return (loop.sourceEntityIndexes || []).some((index) => {
      const entity = state.entities[index];
      return entity?.__cadShape && entity.__cadShape !== "guide";
    });
  }

  function findCadLoopHit(point) {
    return findLoopHit(point, isCadLoop);
  }

  function pickCadLoopAtScreenPoint(point) {
    const hit = findCadLoopHit(point);
    state.selectedLoopIds.clear();
    if (hit) {
      const textEntityIndex = (hit.sourceEntityIndexes || []).find((index) => state.entities[index]?.type === "CAD_TEXT");
      if (textEntityIndex !== undefined) {
        selectEntityIndex(textEntityIndex);
      } else {
        state.selectedLoopIds.add(hit.id);
      }
      state.cadInspectorDismissed = false;
    }
    updateTransformToolUi();
    refreshWorkspaceUi();
    refreshCadInspector();
    updateCanvasCursor(point);
    requestDraw();
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
    if (loopIds.size) {
      state.cadInspectorDismissed = false;
    }
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
      findLoopHit: state.cadEditMode ? findCadLoopHit : findLoopHit,
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
  ui.ribbonTabs.forEach((tab) => {
    tab.addEventListener("click", () => setRibbonTab(tab.dataset.ribbonTab || "cad"));
  });
  ui.browseVectorBtn.addEventListener("click", openFilePicker);
  ui.newEmptyCanvasBtn.addEventListener("click", startNewEmptyCanvas);
  ui.newCanvasBtn.addEventListener("click", startNewEmptyCanvas);
  ui.openFileBtn.addEventListener("click", openFilePicker);
  ui.toggleSettingsBtn.addEventListener("click", () => {
    workspaceSettingsOriginal = {
      safeZ: ui.safeZInput.value,
      forcePolylineArcs: ui.forcePolylineArcsInput.checked,
    };
    getWorkspaceSettingsModalInstance()?.show();
  });
  ui.applyWorkspaceSettingsBtn.addEventListener("click", () => {
    workspaceSettingsOriginal = null;
    getWorkspaceSettingsModalInstance()?.hide();
    showToast("Workspace settings applied.", "success", { duration: 1800 });
  });
  ui.workspaceSettingsModal?.querySelectorAll("[data-bs-dismiss='modal']").forEach((button) => {
    button.addEventListener("click", restoreWorkspaceSettings);
  });
  ui.workspaceSettingsModal?.addEventListener("hidden.bs.modal", restoreWorkspaceSettings);
  ui.zoomInBtn.addEventListener("click", () => {
    adjustZoom(1.2);
  });
  ui.zoomOutBtn.addEventListener("click", () => {
    adjustZoom(1 / 1.2);
  });
  ui.undoBtn.addEventListener("click", undoHistory);
  ui.redoBtn.addEventListener("click", redoHistory);
  ui.selectModeBtn.addEventListener("click", setSelectMode);
  ui.cadEditModeBtn.addEventListener("click", setCadEditMode);
  ui.transformToolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const requestedTool = button.dataset.transformTool || null;
      state.cadEditMode = false;
      state.cadTool = null;
      state.cadDraft = null;
      for (const cadButton of ui.cadToolButtons) {
        cadButton.classList.remove("is-active");
        cadButton.setAttribute("aria-pressed", "false");
      }
      state.transformTool = state.transformTool === requestedTool ? null : requestedTool;
      updateTransformToolUi();
      updateCanvasCursor();
      draw();
    });
  });
  ui.deleteVectorsBtn.addEventListener("click", () => {
    deleteSelectedVectors();
  });
  ui.duplicateVectorsBtn.addEventListener("click", duplicateSelectedVectors);
  ui.booleanVectorsBtn.addEventListener("click", openBooleanDialog);
  ui.booleanOperationInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }
      state.booleanOperation = input.value;
      ui.booleanOperationInputs.forEach((option) => {
        option.closest(".boolean-operation-option")?.classList.toggle("is-active", option.checked);
      });
      refreshBooleanPreview();
    });
  });
  ui.applyBooleanBtn.addEventListener("click", applyBooleanOperation);
  ui.booleanModal?.querySelectorAll("[data-bs-dismiss='modal']").forEach((button) => {
    button.addEventListener("click", () => {
      state.booleanPreviewContours = null;
      requestDraw();
      getBooleanModalInstance()?.hide();
    });
  });
  ui.booleanModal?.addEventListener("hidden.bs.modal", () => {
    state.booleanPreviewContours = null;
    requestDraw();
  });
  for (const option of ui.operationOptions) {
    option.addEventListener("click", () => {
      ui.toolpathTypeInput.value = option.dataset.operation;
      syncSelectedMyEndmillForOperation({ preserve: true });
      refreshOperationUi();
      refreshToolpathFieldVisibility();
      rebuildDraftToolpath();
      refreshToolpathUi();
      draw();
    });
  }
  ui.myEndmillSelect.addEventListener("change", async () => {
    state.myEndmills.selectedSlot = ui.myEndmillSelect.value ? Number.parseInt(ui.myEndmillSelect.value, 10) : null;
    applyMyEndmillSlotToInputs(getMyEndmillSlot(state.myEndmills.selectedSlot));
    renderMyEndmillSummary();
    await rebuildDraftToolpath();
    refreshToolpathUi();
    draw();
  });
  ui.editMyEndmillsBtn.addEventListener("click", () => {
    renderMyEndmillsModal();
    getMyEndmillsModalInstance()?.show();
  });
  ui.myEndmillsSlots.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.classList.contains("slot-library-tool")) {
      populateSlotEditorFromLibrary(target.closest("[data-slot-index]"), target.value);
    }
    updateMyEndmillsSaveState();
  });
  ui.myEndmillsSlots.addEventListener("input", () => {
    updateMyEndmillsSaveState();
  });
  ui.myEndmillsSlots.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest(".clear-slot-btn") : null;
    if (!target) {
      return;
    }
    const row = target.closest("[data-slot-index]");
    if (!row) {
      return;
    }
    row.querySelector(".slot-library-tool").value = "";
    row.querySelector(".slot-name").value = "";
    row.querySelector(".slot-tool-type").value = "flat";
    row.querySelector(".slot-diameter").value = "";
    row.querySelector(".slot-angle").value = "";
    row.querySelector(".slot-rpm").value = "";
    row.querySelector(".slot-feed").value = "";
    row.querySelector(".slot-plunge").value = "";
    row.querySelector(".slot-pass-depth").value = "";
    updateMyEndmillsSaveState();
  });
  ui.saveMyEndmillsBtn.addEventListener("click", async () => {
    if (!updateMyEndmillsSaveState()) {
      showToast("Finish the required fields for each tool slot before saving.", "warning");
      return;
    }
    state.myEndmills.slots = collectMyEndmillsFromModal();
    saveMyEndmillsToStorage();
    syncSelectedMyEndmillForOperation({ preserve: true });
    getMyEndmillsModalInstance()?.hide();
    await rebuildDraftToolpath();
    refreshToolpathUi();
    draw();
  });
  ui.myEndmillsModal?.querySelectorAll("[data-bs-dismiss='modal']").forEach((button) => {
    button.addEventListener("click", () => {
      getMyEndmillsModalInstance()?.hide();
    });
  });
  ui.bitmapTraceModal?.querySelectorAll("[data-bs-dismiss='modal']").forEach((button) => {
    button.addEventListener("click", () => {
      clearBitmapTraceState();
      getBitmapTraceModalInstance()?.hide();
    });
  });
  ui.traceThresholdInput.addEventListener("input", () => {
    ui.traceThresholdValue.textContent = ui.traceThresholdInput.value;
    scheduleTracePreview();
  });
  ui.traceSpeckleInput.addEventListener("input", scheduleTracePreview);
  ui.traceCornerInput.addEventListener("input", () => {
    ui.traceCornerValue.textContent = Number.parseFloat(ui.traceCornerInput.value).toFixed(2);
    scheduleTracePreview();
  });
  ui.traceOptimizeInput.addEventListener("change", scheduleTracePreview);
  ui.traceInvertInput.addEventListener("change", scheduleTracePreview);
  ui.traceBitmapBtn.addEventListener("click", tracePendingBitmap);
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
  ui.cadToolButtons.forEach((button) => {
    button.addEventListener("click", () => setCadTool(button.dataset.cadTool || null));
  });
  ui.clearGuidesBtn.addEventListener("click", clearConstructionGuides);
  ui.cadSnapBtn.addEventListener("click", () => {
    openGridSettings();
  });
  ui.applyGridSettingsBtn.addEventListener("click", applyGridSettings);
  ui.cadInspectorCloseBtn.addEventListener("click", () => {
    state.cadInspectorDismissed = true;
    refreshCadInspector();
  });
  ui.cadTextAddBtn.addEventListener("click", commitCadText);
  ui.cadTextCancelBtn.addEventListener("click", hideCadTextPanel);
  ui.cadTextFontSelect.addEventListener("change", updateCadTextFontPreview);
  updateCadTextFontPreview();
  ui.applyCadInspectorBtn.addEventListener("click", applyCadInspectorChanges);
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
    ui.toolNumberInput,
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
    if (!getMyEndmillSlot(state.myEndmills.selectedSlot) || !isConfiguredMyEndmillSlot(getMyEndmillSlot(state.myEndmills.selectedSlot))) {
      showToast("Set up and select an endmill slot before creating a toolpath.", "warning");
      return;
    }
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
  ui.removeTabsBtn?.addEventListener("click", () => {
    const active = getActiveToolpath();
    clearTabsForToolpath(active);
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

  function dragEventHasFiles(event) {
    const transfer = event.dataTransfer;
    return Boolean(
      transfer?.files?.length ||
      Array.from(transfer?.types || []).includes("Files")
    );
  }

  // A marquee begins as a mouse drag. Prevent the browser from converting it into
  // a native HTML drag, which otherwise stops canvas mousemove updates mid-drag.
  ui.canvasWrap.addEventListener("dragstart", (event) => {
    if (!dragEventHasFiles(event)) {
      event.preventDefault();
    }
  });

  ui.canvasWrap.addEventListener("selectstart", (event) => event.preventDefault());

  ["dragenter", "dragover"].forEach((eventName) => {
    ui.canvasWrap.addEventListener(eventName, (event) => {
      if (!dragEventHasFiles(event)) {
        return;
      }
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
    if (!dragEventHasFiles(event)) {
      return;
    }
    event.preventDefault();
    state.dragImportActive = false;
    refreshWorkspaceUi();
    const file = event.dataTransfer?.files?.[0];
    await loadVectorFile(file);
  });

  canvas.addEventListener("mousedown", (event) => {
    const point = { x: event.offsetX, y: event.offsetY };
    if (event.button === 0 && state.cadTool && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      handleCadPointerDown(point);
      updateCanvasCursor(point);
      return;
    }
    if (event.button === 0 && state.cadEditMode) {
      pickCadLoopAtScreenPoint(point);
      return;
    }
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
      if (!typing && event.key.toLowerCase() === "d" && state.selectedLoopIds.size > 0) {
        event.preventDefault();
        duplicateSelectedVectors();
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
    if (event.key === "Escape" && state.cadTool) {
      event.preventDefault();
      if (state.cadDraft) {
        state.cadDraft = null;
        requestDraw();
      } else {
        setCadTool(null);
      }
      return;
    }
    if (event.key === "Enter" && state.cadTool === "polyline" && state.cadDraft?.points.length >= 2) {
      event.preventDefault();
      commitCadDraft();
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
    if (state.cadTool && state.cadDraft) {
      updateCadDraft(point);
      updateCanvasCursor(point);
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
      : (state.cadEditMode ? findCadLoopHit(point) : findLoopHit(point))?.id || null;
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

  canvas.addEventListener("dblclick", (event) => {
    if (state.cadTool !== "polyline" || !state.cadDraft || state.cadDraft.points.length < 2) {
      return;
    }
    event.preventDefault();
    commitCadDraft();
    updateCanvasCursor({ x: event.offsetX, y: event.offsetY });
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
        toolNumber: ui.toolNumberInput,
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
            toolNumber: state.draftToolpath.toolNumber,
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
          toolNumber: toolpath.toolNumber,
          previewContours: toolpath.previewContours.length,
          motionPaths: toolpath.motionPaths.length,
        })),
      };
    },
  };

  loadMyEndmillsFromStorage();
  refreshWorkspaceUi();
  refreshSelectionUi();
  refreshToolpathUi();
  updateTransformToolUi();
  syncAutoTabHeight();
  updateCadSnapUi();
  syncSelectedMyEndmillForOperation({ preserve: true });
  loadToolLibraries().catch((error) => {
    showToast(error instanceof Error ? error.message : "Failed to load tool library.", "danger");
    renderMyEndmillSelect();
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

