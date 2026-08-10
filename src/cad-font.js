import { parse as parseOpenType } from "../vendor/opentype.module.js?v=1.3.4";

const GLYPHS = {
  A: [[[0, 0], [2, 6], [4, 0]], [[0.75, 3], [3.25, 3]]],
  B: [[[0, 0], [0, 6], [2.8, 6], [4, 5], [4, 3.5], [2.8, 3], [0, 3]], [[2.8, 3], [4, 2.5], [4, 1], [2.8, 0], [0, 0]]],
  C: [[[4, 5.5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 0.5]]],
  D: [[[0, 0], [0, 6], [2.5, 6], [4, 5], [4, 1], [2.5, 0], [0, 0]]],
  E: [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3], [3.25, 3]]],
  F: [[[0, 0], [0, 6], [4, 6]], [[0, 3], [3.25, 3]]],
  G: [[[4, 5.5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 3], [2.25, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[0, 6], [4, 6]], [[2, 6], [2, 0]], [[0, 0], [4, 0]]],
  J: [[[0, 6], [4, 6]], [[3, 6], [3, 1], [2, 0], [0.75, 0], [0, 1]]],
  K: [[[0, 0], [0, 6]], [[4, 6], [0, 3], [4, 0]]],
  L: [[[0, 6], [0, 0], [4, 0]]],
  M: [[[0, 0], [0, 6], [2, 3], [4, 6], [4, 0]]],
  N: [[[0, 0], [0, 6], [4, 0], [4, 6]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  P: [[[0, 0], [0, 6], [2.75, 6], [4, 5], [4, 4], [2.75, 3], [0, 3]]],
  Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.25, 2], [4, 0]]],
  R: [[[0, 0], [0, 6], [2.75, 6], [4, 5], [4, 4], [2.75, 3], [0, 3]], [[2, 3], [4, 0]]],
  S: [[[4, 5.5], [3, 6], [1, 6], [0, 5], [0, 3.5], [1, 3], [3, 3], [4, 2.5], [4, 1], [3, 0], [1, 0], [0, 0.5]]],
  T: [[[0, 6], [4, 6]], [[2, 6], [2, 0]]],
  U: [[[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]]],
  V: [[[0, 6], [2, 0], [4, 6]]],
  W: [[[0, 6], [1, 0], [2, 3], [3, 0], [4, 6]]],
  X: [[[0, 6], [4, 0]], [[4, 6], [0, 0]]],
  Y: [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]],
  Z: [[[0, 6], [4, 6], [0, 0], [4, 0]]],
  0: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  1: [[[2, 0], [2, 6]], [[1, 5], [2, 6], [3, 5]], [[0.5, 0], [3.5, 0]]],
  2: [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [0, 0], [4, 0]]],
  3: [[[0, 6], [3, 6], [4, 5], [4, 1], [3, 0], [0, 0]], [[1, 3], [3.5, 3]]],
  4: [[[4, 0], [4, 6]], [[0, 2.5], [4, 2.5]], [[0, 2.5], [2.5, 6]]],
  5: [[[4, 6], [0, 6], [0, 3], [3, 3], [4, 2], [4, 1], [3, 0], [0, 0]]],
  6: [[[4, 5.5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2.5], [3, 3], [0, 3]]],
  7: [[[0, 6], [4, 6], [1, 0]]],
  8: [[[1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3]]],
  9: [[[4, 3], [1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0], [0, 0.5]]],
  "-": [[[0.5, 3], [3.5, 3]]],
  ".": [[[2, 0], [2, 0.2]]],
  "/": [[[0, 0], [4, 6]]],
};

export const FONT_OPTIONS = [
  { id: "single-line", name: "Single Line Engraving", kind: "stroke", family: "CadEngraving" },
  { id: "space-mono", name: "Space Mono", kind: "outline", family: "Space Mono", asset: "assets/fonts/SpaceMono-Regular.ttf" },
  { id: "bungee", name: "Bungee", kind: "outline", family: "Bungee", asset: "assets/fonts/Bungee-Regular.ttf" },
];

const outlineFontCache = new Map();

export function createStrokeText(text, origin, height) {
  const scale = Math.max(0.1, height) / 6;
  let cursor = origin.x;
  const strokes = [];
  for (const character of String(text || "").toUpperCase()) {
    if (character === " ") {
      cursor += scale * 3;
      continue;
    }
    const glyph = GLYPHS[character] || GLYPHS["-"];
    for (const stroke of glyph) {
      strokes.push(stroke.map(([x, y]) => ({
        x: cursor + x * scale,
        y: origin.y + y * scale,
      })));
    }
    cursor += scale * 5;
  }
  return strokes;
}

export async function loadOutlineFont(fontId) {
  const option = FONT_OPTIONS.find((candidate) => candidate.id === fontId);
  if (!option?.asset) {
    throw new Error("The selected outline font is unavailable.");
  }
  if (outlineFontCache.has(fontId)) {
    return outlineFontCache.get(fontId);
  }
  const response = await fetch(option.asset);
  if (!response.ok) {
    throw new Error(`Could not load ${option.name}.`);
  }
  const font = parseOpenType(await response.arrayBuffer());
  outlineFontCache.set(fontId, font);
  return font;
}

export function createOutlineText(font, text, origin, height) {
  const path = font.getPath(text, 0, 0, height);
  const contours = [];
  let contour = null;
  let cursor = null;
  let start = null;

  const appendPoint = (x, y) => {
    const point = { x: origin.x + x, y: origin.y - y };
    if (!contour || !cursor || Math.hypot(point.x - cursor.x, point.y - cursor.y) > 1e-6) {
      contour.push(point);
      cursor = point;
    }
  };
  const closeContour = () => {
    if (contour?.length > 1 && start) {
      appendPoint(start.x - origin.x, origin.y - start.y);
      contours.push(contour);
    }
    contour = null;
    cursor = null;
    start = null;
  };

  for (const command of path.commands) {
    if (command.type === "M") {
      closeContour();
      contour = [];
      appendPoint(command.x, command.y);
      start = cursor;
    } else if (command.type === "L") {
      appendPoint(command.x, command.y);
    } else if (command.type === "Q" && cursor) {
      const from = { x: cursor.x - origin.x, y: origin.y - cursor.y };
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8;
        const mt = 1 - t;
        appendPoint(mt * mt * from.x + 2 * mt * t * command.x1 + t * t * command.x, mt * mt * from.y + 2 * mt * t * command.y1 + t * t * command.y);
      }
    } else if (command.type === "C" && cursor) {
      const from = { x: cursor.x - origin.x, y: origin.y - cursor.y };
      for (let step = 1; step <= 12; step += 1) {
        const t = step / 12;
        const mt = 1 - t;
        appendPoint(mt ** 3 * from.x + 3 * mt ** 2 * t * command.x1 + 3 * mt * t ** 2 * command.x2 + t ** 3 * command.x, mt ** 3 * from.y + 3 * mt ** 2 * t * command.y1 + 3 * mt * t ** 2 * command.y2 + t ** 3 * command.y);
      }
    } else if (command.type === "Z") {
      closeContour();
    }
  }
  closeContour();
  return contours;
}
