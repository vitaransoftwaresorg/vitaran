import sharp from "sharp";
import type { AnswerOption } from "./answer-key-parse.js";

const COLS = 10;
const ROWS = 10;
const INK = 140;

type Gray = { width: number; height: number; data: Buffer };

async function asGray(png: Buffer): Promise<Gray> {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

function inkOnRow(gray: Gray, y: number) {
  let dark = 0;
  const start = y * gray.width;
  for (let x = 0; x < gray.width; x++) if (gray.data[start + x]! < INK) dark += 1;
  return dark / gray.width;
}

function inkOnCol(gray: Gray, x: number, y0: number) {
  let dark = 0;
  const span = gray.height - y0;
  if (span <= 0) return 0;
  for (let y = y0; y < gray.height; y++) if (gray.data[y * gray.width + x]! < INK) dark += 1;
  return dark / span;
}

function cluster(values: number[], maxGap = 4) {
  const groups: number[][] = [];
  for (const value of values) {
    const last = groups[groups.length - 1];
    if (last && value - last[last.length - 1]! <= maxGap) last.push(value);
    else groups.push([value]);
  }
  return groups.map((group) => Math.round(group.reduce((sum, n) => sum + n, 0) / group.length));
}

function sample(gray: Gray, x: number, y: number) {
  if (x < 0 || y < 0 || x >= gray.width || y >= gray.height) return 255;
  return gray.data[y * gray.width + x] ?? 255;
}

function holeCount(gray: Gray, left: number, top: number, right: number, bottom: number) {
  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) ink[y * w + x] = sample(gray, left + x, top + y) < INK ? 1 : 0;
  }
  const seen = new Uint8Array(w * h);
  const flood = (sx: number, sy: number) => {
    const stack: Array<[number, number]> = [[sx, sy]];
    while (stack.length) {
      const next = stack.pop();
      if (!next) break;
      const x = next[0];
      const y = next[1];
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (seen[i] || ink[i]) continue;
      seen[i] = 1;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  };
  for (let x = 0; x < w; x++) {
    flood(x, 0);
    flood(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    flood(0, y);
    flood(w - 1, y);
  }
  let holes = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (seen[i] || ink[i]) continue;
      holes += 1;
      flood(x, y);
    }
  }
  return holes;
}

function leftStem(gray: Gray, left: number, top: number, right: number, bottom: number) {
  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);
  const stem = Math.max(2, Math.round(w * 0.22));
  let dark = 0;
  let total = 0;
  for (let y = Math.round(h * 0.12); y < Math.round(h * 0.88); y++) {
    for (let x = 0; x < stem; x++) {
      total += 1;
      if (sample(gray, left + x, top + y) < INK) dark += 1;
    }
  }
  return total ? dark / total : 0;
}

function classify(gray: Gray, left: number, top: number, right: number, bottom: number): AnswerOption {
  const holes = holeCount(gray, left, top, right, bottom);
  const stem = leftStem(gray, left, top, right, bottom);
  if (holes >= 2) return "B";
  if (holes === 0) return "C";
  return stem >= 0.36 ? "D" : "A";
}

/** The option letter is the right-most ink blob in the cell (after the "12)"). */
function rightmostLetterBox(gray: Gray, left: number, top: number, right: number, bottom: number) {
  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) ink[y * w + x] = sample(gray, left + x, top + y) < INK ? 1 : 0;
  }
  const seen = new Uint8Array(w * h);
  const blobs: Array<{ left: number; top: number; right: number; bottom: number; area: number }> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (seen[start] || !ink[start]) continue;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      const stack: Array<[number, number]> = [[x, y]];
      seen[start] = 1;
      while (stack.length) {
        const next = stack.pop();
        if (!next) break;
        const cx = next[0];
        const cy = next[1];
        area += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [nx, ny] of [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ] as const) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const i = ny * w + nx;
          if (seen[i] || !ink[i]) continue;
          seen[i] = 1;
          stack.push([nx, ny]);
        }
      }
      if (area >= 18 && area < w * h * 0.45) {
        blobs.push({ left: minX, top: minY, right: maxX, bottom: maxY, area });
      }
    }
  }
  const letter = blobs.sort((a, b) => b.right - a.right || b.area - a.area)[0];
  if (!letter) return null;
  return {
    left: left + letter.left,
    top: top + letter.top,
    right: left + letter.right + 1,
    bottom: top + letter.bottom + 1,
  };
}

/** Read the printed 10×10 KEY grid. Question n is row-major 1–100. */
export async function readKeyGrid(png: Buffer): Promise<Record<string, AnswerOption>> {
  const gray = await asGray(png);
  const hLines = cluster(
    Array.from({ length: gray.height }, (_, y) => y).filter((y) => inkOnRow(gray, y) > 0.7),
  );
  const tableH = hLines[0] !== undefined && hLines[1] !== undefined && hLines[1] - hLines[0] > 40 ? hLines.slice(1) : hLines;
  if (tableH.length === 10) tableH.push(gray.height - 2);
  if (tableH.length < 11) {
    throw new Error(`KEY table rows not found (${tableH.length})`);
  }

  const y0 = tableH[0]!;
  const vLines = cluster(
    Array.from({ length: gray.width }, (_, x) => x).filter((x) => inkOnCol(gray, x, y0) > 0.7),
  ).filter((x) => x > 8 && x < gray.width - 8);
  if (vLines.length < 11) {
    throw new Error(`KEY table columns not found (${vLines.length})`);
  }

  const answers: Record<string, AnswerOption> = {};
  for (let row = 0; row < ROWS; row++) {
    const top = tableH[row]! + 3;
    const bottom = tableH[row + 1]! - 3;
    for (let col = 0; col < COLS; col++) {
      const left = vLines[col]! + 2;
      const right = vLines[col + 1]! - 2;
      const letter = rightmostLetterBox(gray, left, top, right, bottom);
      if (!letter) continue;
      answers[String(row * COLS + col + 1)] = classify(
        gray,
        letter.left,
        letter.top,
        letter.right,
        letter.bottom,
      );
    }
  }
  return answers;
}
