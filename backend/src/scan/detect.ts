import sharp from "sharp";
import { type AnswerOption } from "../utils/answer-key-parse.js";
import {
  asRgba,
  CANONICAL_HEIGHT,
  CANONICAL_WIDTH,
  findPaperQuad,
  warpQuad,
  type Quad,
  type Rgba,
} from "../utils/omr-geometry.js";
import { locateAnswerGrid, MAX_SPACING_ERROR, scoreAnswerGrid } from "../utils/omr-grid.js";
import { layoutOmrBubbles } from "../utils/omr-layout.js";
import { cv, matFromRgba, type CvMat } from "./cv.js";

export type { Rgba };

const ROLL_COLS = 7;
const ROLL_ROWS = 10;
const ROLL_WINDOWS = [
  { x0: 0.05, y0: 0.155, x1: 0.345, y1: 0.355 },
  { x0: 0.04, y0: 0.14, x1: 0.36, y1: 0.38 },
  { x0: 0.06, y0: 0.17, x1: 0.33, y1: 0.34 },
  { x0: 0.03, y0: 0.12, x1: 0.4, y1: 0.4 },
  { x0: 0.02, y0: 0.1, x1: 0.42, y1: 0.36 },
];

type Circle = { x: number; y: number; r: number };

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function uniqueCenters(values: number[], minSep: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: Array<{ sum: number; n: number; mean: number }> = [];
  for (const value of sorted) {
    const last = groups[groups.length - 1];
    if (!last || value - last.mean > minSep) groups.push({ sum: value, n: 1, mean: value });
    else {
      last.sum += value;
      last.n += 1;
      last.mean = last.sum / last.n;
    }
  }
  return groups;
}

function pixel(rgba: Rgba, x: number, y: number) {
  const sx = Math.max(0, Math.min(rgba.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(rgba.height - 1, Math.round(y)));
  const i = (sy * rgba.width + sx) * 4;
  return { r: rgba.data[i] ?? 0, g: rgba.data[i + 1] ?? 0, b: rgba.data[i + 2] ?? 0 };
}

function grayAt(rgba: Rgba, x: number, y: number) {
  const { r, g, b } = pixel(rgba, x, y);
  return Math.min(r, g, b);
}

function paperThr(rgba: Rgba, x0: number, y0: number, x1: number, y1: number) {
  const values: number[] = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) values.push(grayAt(rgba, x, y));
  }
  values.sort((a, b) => a - b);
  return (values[Math.floor(values.length * 0.7)] ?? 200) * 0.66;
}

function coreFill(rgba: Rgba, x: number, y: number, radius: number, thr: number) {
  const inner = Math.max(2, Math.round(radius * 0.58));
  let ink = 0;
  let n = 0;
  for (let dy = -inner; dy <= inner; dy += 1) {
    for (let dx = -inner; dx <= inner; dx += 1) {
      if (dx * dx + dy * dy > inner * inner) continue;
      if (grayAt(rgba, x + dx, y + dy) < thr) ink += 1;
      n += 1;
    }
  }
  return n ? ink / n : 0;
}

function cellFill(rgba: Rgba, cx: number, cy: number, radius: number, thr: number, search: number) {
  if (search <= 0) return coreFill(rgba, cx, cy, radius, thr);
  let best = 0;
  const step = Math.max(1, Math.round(search / 3));
  for (let dy = -search; dy <= search; dy += step) {
    for (let dx = -search; dx <= search; dx += step) {
      const fill = coreFill(rgba, cx + dx, cy + dy, radius, thr);
      if (fill > best) best = fill;
    }
  }
  return best;
}

function digitsFromGrid(rgba: Rgba, xs: number[], ys: number[], radius: number, thr: number, search = 0) {
  if (xs.length !== ROLL_COLS || ys.length !== ROLL_ROWS) return "";
  let digits = "";
  for (const cx of xs) {
    const fills = ys.map((cy) => cellFill(rgba, cx, cy, radius, thr, search));
    const ranked = [...fills].sort((a, b) => b - a);
    const digit = fills.findIndex((fill) => fill === ranked[0]);
    if (digit < 0 || ranked[0]! < 0.08 || ranked[0]! - (ranked[1] ?? 0) < 0.04) continue;
    digits += String(digit);
  }
  return /^\d{7}$/.test(digits) ? digits : "";
}

function axisProfile(
  rgba: Rgba,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  axis: "x" | "y",
  thr: number,
) {
  const size = axis === "x" ? x1 - x0 : y1 - y0;
  const out = new Array<number>(Math.max(0, Math.floor(size))).fill(0);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (grayAt(rgba, x, y) >= thr) continue;
      out[Math.floor(axis === "x" ? x - x0 : y - y0)]! += 1;
    }
  }
  return out;
}

function runCentres(profile: number[], minWidth: number, mergeGap: number) {
  const peak = Math.max(...profile, 0);
  const floor = Math.max(2, peak * 0.14);
  const runs: Array<{ start: number; end: number }> = [];
  let current: { start: number; end: number } | null = null;
  for (let i = 0; i < profile.length; i += 1) {
    if (profile[i]! < floor) continue;
    if (current && i - current.end <= mergeGap) current.end = i;
    else {
      current = { start: i, end: i };
      runs.push(current);
    }
  }
  return runs.filter((run) => run.end - run.start + 1 >= minWidth).map((run) => (run.start + run.end) / 2);
}

function takeSpaced(centres: number[], count: number, pitchHint: number) {
  if (centres.length === count) return centres;
  if (centres.length < count) return null;
  let best: number[] | null = null;
  let bestScore = Infinity;
  for (let i = 0; i <= centres.length - count; i += 1) {
    const slice = centres.slice(i, i + count);
    const gaps = slice.slice(1).map((x, k) => x - slice[k]!);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (mean < pitchHint * 0.55 || mean > pitchHint * 1.6) continue;
    const spread = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
    if (spread < bestScore) {
      bestScore = spread;
      best = slice;
    }
  }
  return best;
}

function rollFromBox(rgba: Rgba, box: { x0: number; y0: number; x1: number; y1: number }, peaked: boolean) {
  const x0 = box.x0 * rgba.width;
  const x1 = box.x1 * rgba.width;
  const y0 = box.y0 * rgba.height;
  const y1 = box.y1 * rgba.height;
  const colPitch = (x1 - x0) / ROLL_COLS;
  const rowPitch = (y1 - y0) / ROLL_ROWS;
  const thr = paperThr(rgba, x0, y0, x1, y1);
  const radius = Math.max(3, Math.min(colPitch, rowPitch) * 0.32);
  const search = Math.max(2, Math.min(colPitch, rowPitch) * 0.22);
  let xs: number[];
  let ys: number[];
  if (peaked) {
    const xsRel = takeSpaced(
      runCentres(axisProfile(rgba, x0, y0, x1, y1, "x", thr), Math.max(3, colPitch * 0.2), 2),
      ROLL_COLS,
      colPitch,
    );
    const ysRel = takeSpaced(
      runCentres(axisProfile(rgba, x0, y0, x1, y1, "y", thr), Math.max(3, rowPitch * 0.2), 2),
      ROLL_ROWS,
      rowPitch,
    );
    if (!xsRel || !ysRel) return "";
    xs = xsRel.map((x) => x0 + x);
    ys = ysRel.map((y) => y0 + y);
  } else {
    xs = Array.from({ length: ROLL_COLS }, (_, c) => x0 + (c + 0.5) * colPitch);
    ys = Array.from({ length: ROLL_ROWS }, (_, r) => y0 + (r + 0.5) * rowPitch);
  }
  return digitsFromGrid(rgba, xs, ys, radius, thr, peaked ? 0 : search);
}

function rollFromHough(rgba: Rgba) {
  const src = matFromRgba(rgba.data, rgba.width, rgba.height);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const circles = houghCircles(gray).filter(
    (c) => c.y > rgba.height * 0.08 && c.y < rgba.height * 0.42 && c.x > rgba.width * 0.04 && c.x < rgba.width * 0.4,
  );
  src.delete();
  const radius = median(circles.map((c) => c.r)) || Math.min(rgba.width, rgba.height) * 0.008;
  const colXs = uniqueCenters(circles.map((c) => c.x), radius * 1.3)
    .filter((row) => row.n >= 4)
    .sort((a, b) => a.mean - b.mean)
    .map((row) => row.mean)
    .slice(0, ROLL_COLS);
  const rowYs = uniqueCenters(circles.map((c) => c.y), radius * 1.15)
    .filter((row) => row.n >= 3)
    .sort((a, b) => a.mean - b.mean)
    .map((row) => row.mean)
    .slice(-ROLL_ROWS);
  gray.delete();
  const thr = paperThr(rgba, rgba.width * 0.04, rgba.height * 0.08, rgba.width * 0.4, rgba.height * 0.42);
  return digitsFromGrid(rgba, colXs, rowYs, radius, thr, radius * 0.6);
}

export function readRollBubbleCandidates(rgba: Rgba) {
  const found: string[] = [];
  const add = (value: string) => {
    if (/^\d{7}$/.test(value) && !found.includes(value)) found.push(value);
  };
  add(rollFromHough(rgba));
  for (const box of ROLL_WINDOWS) {
    add(rollFromBox(rgba, box, true));
    add(rollFromBox(rgba, box, false));
  }
  return found;
}

function houghCircles(gray: CvMat) {
  const blur = new cv.Mat();
  const circlesMat = new cv.Mat();
  cv.medianBlur(gray, blur, 5);
  const minR = Math.max(4, Math.round(Math.min(gray.cols, gray.rows) * 0.0065));
  const maxR = Math.max(minR + 2, Math.round(Math.min(gray.cols, gray.rows) * 0.015));
  cv.HoughCircles(blur, circlesMat, cv.HOUGH_GRADIENT, 1.2, minR * 1.7, 70, 14, minR, maxR);
  const circles: Circle[] = [];
  for (let i = 0; i < circlesMat.cols; i += 1) {
    circles.push({
      x: circlesMat.data32F[i * 3] ?? 0,
      y: circlesMat.data32F[i * 3 + 1] ?? 0,
      r: circlesMat.data32F[i * 3 + 2] ?? minR,
    });
  }
  blur.delete();
  circlesMat.delete();
  return circles;
}

export async function warpSheet(
  image: Buffer,
  options: { flat?: boolean; corners?: [number, number][] } = {},
): Promise<Rgba> {
  const rgba = await asRgba(image);
  if (options.corners?.length === 4) {
    const quad = options.corners.map(([x, y]) => ({
      x: Math.max(0, Math.min(rgba.width - 1, x * (rgba.width - 1))),
      y: Math.max(0, Math.min(rgba.height - 1, y * (rgba.height - 1))),
    })) as Quad;
    return (await warpQuad(rgba, quad)).rgba;
  }
  // PDF pages are already flat scans — perspective warp often mis-finds corners and shifts bubbles.
  if (!options.flat) {
    const quad = findPaperQuad(rgba);
    if (quad) {
      const warped = await warpQuad(rgba, quad);
      return warped.rgba;
    }
  }
  const resized = await sharp(rgba.data, { raw: { width: rgba.width, height: rgba.height, channels: 4 } })
    .resize(CANONICAL_WIDTH, CANONICAL_HEIGHT, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: resized.info.width, height: resized.info.height, data: resized.data };
}

export function readAnswerBubbles(rgba: Rgba) {
  // Primary: grid fitted to the printed bubble circles on this sheet (handles margins, tilt, perspective).
  try {
    const grid = locateAnswerGrid(rgba);
    if (grid && grid.snapped >= 320 && grid.spacingError <= MAX_SPACING_ERROR) {
      const read = scoreAnswerGrid(rgba, grid);
      return {
        answers: read.answers,
        markCount: Object.keys(read.answers).length,
        flags: read.flags,
        measured: true,
        gridFound: true,
        bubbles: bubbleMap(rgba, grid.radius, read.cells),
      };
    }
  } catch {
    // Fall through to the fixed-template layout.
  }
  const layout = layoutOmrBubbles(rgba);
  const answers: Record<string, AnswerOption[]> = {};
  for (const [question, options] of Object.entries(layout.answers)) {
    if (options.length) answers[question] = options;
  }
  return {
    answers,
    markCount: Object.keys(answers).length,
    flags: layout.flags,
    measured: layout.measured,
    /** False when the printed bubble grid wasn't found and the fixed template was guessed instead. */
    gridFound: false,
    bubbles: bubbleMap(rgba, layout.radius, layout.bubbles),
  };
}

export type BubbleMap = {
  width: number;
  height: number;
  radius: number;
  points: Array<{ question: number; option: AnswerOption; x: number; y: number }>;
};

function bubbleMap(
  rgba: Rgba,
  radius: number,
  cells: Array<{ question: number; option: AnswerOption; x: number; y: number }>,
): BubbleMap {
  return {
    width: rgba.width,
    height: rgba.height,
    radius: Math.round(radius * 10) / 10,
    points: cells.map(({ question, option, x, y }) => ({
      question,
      option,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    })),
  };
}

export function readRollBubbles(rgba: Rgba) {
  return readRollBubbleCandidates(rgba)[0] ?? "";
}

export async function textCropPng(
  rgba: Rgba,
  box: { left: number; top: number; width: number; height: number },
  height = 180,
) {
  const left = Math.max(0, Math.round(box.left * rgba.width));
  const top = Math.max(0, Math.round(box.top * rgba.height));
  const width = Math.min(rgba.width - left, Math.max(12, Math.round(box.width * rgba.width)));
  const cropH = Math.min(rgba.height - top, Math.max(12, Math.round(box.height * rgba.height)));
  const src = matFromRgba(rgba.data, rgba.width, rgba.height);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const crop = new Array<number>(width * cropH);
  for (let y = 0; y < cropH; y += 1) {
    for (let x = 0; x < width; x += 1) {
      crop[y * width + x] = gray.data[(top + y) * gray.cols + (left + x)] ?? 255;
    }
  }
  src.delete();
  gray.delete();
  return sharp(Buffer.from(Uint8Array.from(crop)), { raw: { width, height: cropH, channels: 1 } })
    .sharpen()
    .resize({ height, kernel: "lanczos3" })
    .toColorspace("srgb")
    .withMetadata({ density: 300 })
    .png()
    .toBuffer();
}
