import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/cut-preview-3d-worker.js", import.meta.url), "utf8");

async function simulate(operation) {
  const messages = [];
  let listener;
  const self = {
    addEventListener(type, callback) {
      if (type === "message") listener = callback;
    },
    postMessage(message) {
      messages.push(message);
    },
  };
  vm.runInNewContext(source, { self, setTimeout, Math, Float32Array, Uint8Array, Promise });
  listener({ data: {
    type: "build",
    version: 1,
    toolpaths: [{
      operation,
      toolDiameter: 6,
      cutterAngle: 90,
      motionPaths: [{ points: [{ x: 0, y: 0, z: -3 }, { x: 20, y: 0, z: -3 }] }],
    }],
  } });
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const complete = messages.find((message) => message.type === "complete");
    if (complete) return complete;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${operation} simulation`);
}

const profile = await simulate("profile-outside");
const vcarve = await simulate("vcarve");

assert.equal(new Uint8Array(profile.sampleKinds)[0], 0, "profile simulation must use a flat cutter");
assert.equal(new Uint8Array(vcarve.sampleKinds)[0], 1, "V-Carve simulation must use V-bit stock removal");
assert.ok(new Float32Array(vcarve.grid).some((z) => z < 0), "V-Carve simulation must remove stock");

console.log("3D cut-preview worker checks passed.");
