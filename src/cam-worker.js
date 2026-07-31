import * as CamOps from "./cam-ops.js?v=20260730-vcarve8";

let clipperReadyPromise = null;

function assetUrl(path) {
  const url = new URL(path, import.meta.url);
  const version = new URL(import.meta.url).searchParams.get("v");
  if (version) {
    url.searchParams.set("v", version);
  }
  return url;
}

async function evalGlobalScript(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load script: ${response.status}`);
  }
  const source = await response.text();
  globalThis.eval(source);
}

async function ensureClipper() {
  if (globalThis.ClipperLib) {
    return;
  }
  if (clipperReadyPromise) {
    return clipperReadyPromise;
  }
  clipperReadyPromise = evalGlobalScript(assetUrl("../clipperjs/clipper_unminified.js")).catch((error) => {
    clipperReadyPromise = null;
    throw error;
  });
  return clipperReadyPromise;
}

function postProgress(id, percent, label) {
  self.postMessage({
    id,
    progress: {
      percent,
      label,
    },
  });
}

self.onmessage = async (event) => {
  const { id, type, selectedLoops, config, toolpathOptions, toolpaths, fileName, forcePolylineArcs } = event.data || {};
  try {
    await ensureClipper();

    if (type === "build-toolpath") {
      postProgress(id, 8, "Preparing toolpath");
      const result = CamOps.createToolpathFromLoops(selectedLoops || [], config || {}, {
        ...(toolpathOptions || {}),
        onProgress(percent, label) {
          postProgress(id, percent, label);
        },
      });
      postProgress(id, 100, "Toolpath ready");
      self.postMessage({ id, result });
      return;
    }

    if (type === "build-gcode") {
      postProgress(id, 5, "Preparing G-code");
      const result = CamOps.buildGcode({
        toolpaths: toolpaths || [],
        fileName,
        forcePolylineArcs,
        onProgress(percent, label) {
          postProgress(id, percent, label);
        },
      });
      postProgress(id, 100, "G-code ready");
      self.postMessage({ id, result });
      return;
    }

    throw new Error(`Unknown CAM worker request: ${type}`);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
