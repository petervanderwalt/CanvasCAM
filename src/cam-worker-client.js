const CAM_WORKER_VERSION = "20260731-worker1";

let workerRef = null;
let requestId = 0;
const pendingRequests = new Map();

function getWorker() {
  if (workerRef) {
    return workerRef;
  }
  workerRef = new Worker(new URL(`./cam-worker.js?v=${CAM_WORKER_VERSION}`, import.meta.url), { type: "module" });
  workerRef.addEventListener("message", handleWorkerMessage);
  workerRef.addEventListener("error", (event) => {
    const error = new Error(event.message || "CAM worker failed.");
    rejectAllPending(error);
  });
  return workerRef;
}

function handleWorkerMessage(event) {
  const { id, result, error, progress } = event.data || {};
  const pending = pendingRequests.get(id);
  if (!pending) {
    return;
  }

  if (progress) {
    pending.onProgress?.(progress);
    return;
  }

  pendingRequests.delete(id);

  if (error) {
    pending.reject(new Error(error));
    return;
  }

  pending.resolve(result);
}

function rejectAllPending(error) {
  for (const pending of pendingRequests.values()) {
    pending.reject(error);
  }
  pendingRequests.clear();
}

function postWorkerRequest(type, payload = {}, options = {}) {
  const worker = getWorker();
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      resolve,
      reject,
      onProgress: options.onProgress,
    });
    worker.postMessage({ id, type, ...payload });
  });
}

function serializeLoop(loop) {
  return {
    id: loop.id,
    points: loop.points.map((point) => ({ x: point.x, y: point.y })),
  };
}

function serializeToolpath(toolpath) {
  return {
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
    trochoidEnabled: Boolean(toolpath.trochoidEnabled),
    trochoidRadius: toolpath.trochoidRadius,
    trochoidEngagementPercent: toolpath.trochoidEngagementPercent,
    tabWidth: toolpath.tabWidth,
    tabHeight: toolpath.tabHeight,
    safeZ: toolpath.safeZ,
    feedRate: toolpath.feedRate,
    plungeRate: toolpath.plungeRate,
    spindle: toolpath.spindle,
    toolNumber: toolpath.toolNumber,
    libraryToolId: toolpath.libraryToolId,
    libraryToolName: toolpath.libraryToolName,
    libraryToolVendor: toolpath.libraryToolVendor,
    libraryToolImage: toolpath.libraryToolImage,
    libraryToolUrl: toolpath.libraryToolUrl,
    libraryToolDescription: toolpath.libraryToolDescription,
    previewContours: toolpath.previewContours.map((contour) => contour.map((point) => ({ x: point.x, y: point.y }))),
    motionPaths: (toolpath.motionPaths || []).map((path) => ({
      safeToClose: Boolean(path.safeToClose),
      points: path.points.map((point) => ({ x: point.x, y: point.y, z: point.z })),
    })),
    tabs: toolpath.tabs.map((tab) => ({
      contourIndex: tab.contourIndex,
      along: tab.along,
      point: tab.point ? { x: tab.point.x, y: tab.point.y } : null,
    })),
  };
}

export function createToolpathInWorker(selectedLoops, config, options = {}) {
  return postWorkerRequest(
    "build-toolpath",
    {
      selectedLoops: selectedLoops.map(serializeLoop),
      config: { ...config },
      toolpathOptions: {
        id: options.id,
        label: options.label,
      },
    },
    { onProgress: options.onProgress }
  );
}

export function buildGcodeInWorker({ toolpaths, fileName, forcePolylineArcs, onProgress }) {
  return postWorkerRequest(
    "build-gcode",
    {
      toolpaths: toolpaths.map(serializeToolpath),
      fileName,
      forcePolylineArcs,
    },
    { onProgress }
  );
}
