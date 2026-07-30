const VCARVE_CLIPPER_SCALE = 1270000000 / 25.4;
const VCARVE_CLIPPER_TO_CPP_SCALE = 1 / 128;
const VCARVE_MM_TO_CPP_SCALE = VCARVE_CLIPPER_SCALE * VCARVE_CLIPPER_TO_CPP_SCALE;

let readyPromise = null;

function assetUrl(path) {
  const url = new URL(path, import.meta.url);
  const version = new URL(import.meta.url).searchParams.get("v");
  if (version) {
    url.searchParams.set("v", version);
  }
  return url;
}

function workerParams() {
  return new URL(import.meta.url).searchParams;
}

function useDebugCamCpp() {
  const value = workerParams().get("camCpp");
  return value === "debug" || value === "assert";
}

function isNodeRuntime() {
  return typeof process !== "undefined" && !!process.versions?.node;
}

async function evalGlobalScript(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load script: ${response.status}`);
  }
  const source = await response.text();
  globalThis.eval(source);
}

function camCppReady() {
  return typeof Module !== "undefined"
    && typeof Module._separateTabs === "function"
    && typeof Module._vCarve === "function"
    && Module.calledRun;
}

function getHeapU32() {
  if (typeof HEAPU32 !== "undefined") {
    return HEAPU32;
  }
  if (typeof Module !== "undefined" && Module.HEAPU32) {
    return Module.HEAPU32;
  }
  throw new Error("HEAPU32 not available");
}

async function ensureCamCpp() {
  if (camCppReady()) {
    return;
  }
  if (isNodeRuntime()) {
    throw new Error("V-Carve worker does not support node runtime.");
  }
  if (readyPromise) {
    return readyPromise;
  }

  readyPromise = (async () => {
    const scriptName = useDebugCamCpp() ? "web-cam-cpp.debug.js" : "web-cam-cpp.js";
    const wasmName = useDebugCamCpp() ? "web-cam-cpp.debug.wasm" : "web-cam-cpp.wasm";
    const wasmBase = assetUrl("../vendor/cam-cpp/");

    globalThis.Module = {
      ...(globalThis.Module || {}),
      locateFile(path) {
        if (path === "web-cam-cpp.wasm") {
          return new URL(wasmName, wasmBase).href;
        }
        return new URL(path, wasmBase).href;
      },
    };

    await evalGlobalScript(assetUrl(`../vendor/cam-cpp/${scriptName}`));

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("cam-cpp WASM worker init timed out")), 15000);
      const done = () => {
        clearTimeout(timeout);
        resolve();
      };

      if (camCppReady()) {
        done();
        return;
      }

      const prior = globalThis.Module?.onRuntimeInitialized;
      globalThis.Module.onRuntimeInitialized = function onRuntimeInitialized() {
        if (prior) {
          prior();
        }
        done();
      };

      const abortPrior = globalThis.Module?.onAbort;
      globalThis.Module.onAbort = function onAbort(reason) {
        if (abortPrior) {
          abortPrior(reason);
        }
        clearTimeout(timeout);
        reject(new Error(typeof reason === "string" ? reason : "cam-cpp abort"));
      };
    });
  })().catch((error) => {
    readyPromise = null;
    throw error;
  });

  return readyPromise;
}

self.onmessage = async (event) => {
  const { id, type, paths, cutterAngle, passDepth, maxDepth } = event.data || {};
  try {
    if (type === "ensure-ready") {
      await ensureCamCpp();
      self.postMessage({ id, result: true });
      return;
    }

    if (type === "vcarve") {
      await ensureCamCpp();
      const result = generateVCarveToolpaths(paths || [], {
        cutterAngle,
        passDepth,
        maxDepth,
      });
      self.postMessage({ id, result });
      return;
    }

    throw new Error(`Unknown V-Carve worker request: ${type}`);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

function generateVCarveToolpaths(paths, { cutterAngle, passDepth, maxDepth }) {
  if (!camCppReady()) {
    throw new Error("cam-cpp WASM module not loaded - V-Carve unavailable");
  }
  if (!paths.length) {
    return [];
  }
  if (!(cutterAngle > 0 && cutterAngle < 180)) {
    throw new Error("V-Carve cutter angle must be between 0 and 180 degrees.");
  }

  const memoryBlocks = [];
  const cGeometry = clipperPathsToCPaths(memoryBlocks, paths);
  const resultPathsRef = Module._malloc(4);
  const resultNumPathsRef = Module._malloc(4);
  const resultPathSizesRef = Module._malloc(4);
  memoryBlocks.push(resultPathsRef, resultNumPathsRef, resultPathSizesRef);

  try {
    Module.ccall(
      "vCarve",
      "void",
      ["number", "number", "number", "number", "number", "number", "number", "number", "number", "number"],
      [
        0,
        0,
        cGeometry[0],
        cGeometry[1],
        cGeometry[2],
        cutterAngle,
        passDepth * VCARVE_MM_TO_CPP_SCALE,
        resultPathsRef,
        resultNumPathsRef,
        resultPathSizesRef,
      ]
    );

    return cPathsToVCarvePaths(memoryBlocks, resultPathsRef, resultNumPathsRef, resultPathSizesRef, maxDepth);
  } finally {
    for (const ptr of memoryBlocks) {
      Module._free(ptr);
    }
  }
}

function clipperPathsToCPaths(memoryBlocks, clipperPaths) {
  const heapU32 = getHeapU32();
  const cPaths = Module._malloc(clipperPaths.length * 4);
  const cPathSizes = Module._malloc(clipperPaths.length * 4);
  memoryBlocks.push(cPaths, cPathSizes);

  const cPathsBase = cPaths >> 2;
  const cPathSizesBase = cPathSizes >> 2;

  for (let i = 0; i < clipperPaths.length; i += 1) {
    const clipperPath = clipperPaths[i];
    let cPath = Module._malloc(clipperPath.length * 2 * 8 + 4);
    memoryBlocks.push(cPath);
    if (cPath & 4) {
      cPath += 4;
    }
    const pathArray = new Float64Array(heapU32.buffer, heapU32.byteOffset + cPath);
    for (let j = 0; j < clipperPath.length; j += 1) {
      const point = clipperPath[j];
      pathArray[j * 2] = point.X * VCARVE_CLIPPER_TO_CPP_SCALE;
      pathArray[j * 2 + 1] = point.Y * VCARVE_CLIPPER_TO_CPP_SCALE;
    }
    heapU32[cPathsBase + i] = cPath;
    heapU32[cPathSizesBase + i] = clipperPath.length;
  }

  return [cPaths, clipperPaths.length, cPathSizes];
}

function cPathsToVCarvePaths(memoryBlocks, cPathsRef, cNumPathsRef, cPathSizesRef, maxDepth) {
  const heapU32 = getHeapU32();
  const cPaths = heapU32[cPathsRef >> 2];
  const cNumPaths = heapU32[cNumPathsRef >> 2];
  const cPathSizes = heapU32[cPathSizesRef >> 2];
  memoryBlocks.push(cPaths, cPathSizes);

  const cPathsBase = cPaths >> 2;
  const cPathSizesBase = cPathSizes >> 2;
  const maxDepthLimit = Number.isFinite(maxDepth) ? -Math.abs(maxDepth) : null;
  const convertedPaths = [];

  for (let i = 0; i < cNumPaths; i += 1) {
    const pathSize = heapU32[cPathSizesBase + i];
    let cPath = heapU32[cPathsBase + i];
    memoryBlocks.push(cPath);
    if (cPath & 4) {
      cPath += 4;
    }
    const pathArray = new Float64Array(heapU32.buffer, heapU32.byteOffset + cPath);
    const points = [];

    for (let j = 0; j < pathSize; j += 1) {
      const x = pathArray[j * 3] / VCARVE_MM_TO_CPP_SCALE;
      const y = pathArray[j * 3 + 1] / VCARVE_MM_TO_CPP_SCALE;
      let z = -Math.abs(pathArray[j * 3 + 2] / VCARVE_MM_TO_CPP_SCALE);
      if (maxDepthLimit !== null) {
        z = Math.max(z, maxDepthLimit);
      }
      points.push({ x, y, z });
    }

    if (points.length) {
      convertedPaths.push({
        safeToClose: false,
        points,
      });
    }
  }

  return convertedPaths;
}
