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

/** Any colour as ink — used only for finding printed bubble rings. */
function grayAt(rgba: Rgba, x: number, y: number) {
  const { r, g, b } = pixel(rgba, x, y);
  return Math.min(r, g, b);
}

/**
 * Dark pen / pencil only. Red printed digits and rings stay bright on max(R,G,B),
 * so empty bubbles with a "8" glyph no longer look filled.
 */
function darkAt(rgba: Rgba, x: number, y: number) {
  const { r, g, b } = pixel(rgba, x, y);
  return Math.max(r, g, b);
}

function paperThr(rgba: Rgba, x0: number, y0: number, x1: number, y1: number) {
  const values: number[] = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) values.push(darkAt(rgba, x, y));
  }
  values.sort((a, b) => a - b);
  return (values[Math.floor(values.length * 0.7)] ?? 200) * 0.72;
}

/** Mean darkness 0..1 inside the bubble core (dark ink channel). */
function coreDark(rgba: Rgba, x: number, y: number, radius: number) {
  const inner = Math.max(2, Math.round(radius * 0.55));
  let sum = 0;
  let n = 0;
  for (let dy = -inner; dy <= inner; dy += 1) {
    for (let dx = -inner; dx <= inner; dx += 1) {
      if (dx * dx + dy * dy > inner * inner) continue;
      sum += 255 - darkAt(rgba, x + dx, y + dy);
      n += 1;
    }
  }
  return n ? sum / (n * 255) : 0;
}

function coreFill(rgba: Rgba, x: number, y: number, radius: number, thr: number) {
  const inner = Math.max(2, Math.round(radius * 0.55));
  let ink = 0;
  let n = 0;
  for (let dy = -inner; dy <= inner; dy += 1) {
    for (let dx = -inner; dx <= inner; dx += 1) {
      if (dx * dx + dy * dy > inner * inner) continue;
      if (darkAt(rgba, x + dx, y + dy) < thr) ink += 1;
      n += 1;
    }
  }
  return n ? ink / n : 0;
}

function cellFill(
  rgba: Rgba,
  cx: number,
  cy: number,
  radius: number,
  thr: number,
  searchX: number,
  searchY = searchX,
) {
  // Prefer continuous darkness — catches soft pencil; hard fill backs it up.
  const probe = (x: number, y: number) => Math.max(coreDark(rgba, x, y, radius), coreFill(rgba, x, y, radius, thr));
  if (searchX <= 0 && searchY <= 0) return probe(cx, cy);
  let best = 0;
  const stepX = searchX <= 0 ? 1 : Math.max(1, Math.round(searchX / 3));
  const stepY = searchY <= 0 ? 1 : Math.max(1, Math.round(searchY / 3));
  for (let dy = -searchY; dy <= searchY; dy += stepY) {
    for (let dx = -searchX; dx <= searchX; dx += stepX) {
      const fill = probe(cx + dx, cy + dy);
      if (fill > best) best = fill;
    }
  }
  return best;
}

type RollRead = { digits: string; score: number };

/**
 * Pick one digit per column using fill above that column's empty baseline.
 * Printed digit glyphs ink empty bubbles differently (8 > 1); absolute fill alone
 * misreads neighbouring similar regs like 6179101 vs 6179106.
 */
function digitsFromGrid(
  rgba: Rgba,
  xs: number[],
  ys: number[],
  radius: number,
  thr: number,
  search = 0,
): RollRead | null {
  if (xs.length !== ROLL_COLS || ys.length !== ROLL_ROWS) return null;
  const colPitch =
    xs.length > 1 ? median(xs.slice(1).map((x, i) => x - xs[i]!)) : radius * 3;
  const searchX = search <= 0 ? 0 : Math.min(search, Math.max(1, colPitch * 0.12), radius * 0.3);
  // Keep Y search tight — walking into the row above/below flips every digit by ±1.
  const searchY = search <= 0 ? 0 : Math.min(search, colPitch * 0.14, radius * 0.28);
  let digits = "";
  let score = 0;
  for (const cx of xs) {
    const fills = ys.map((cy) => cellFill(rgba, cx, cy, radius, thr, searchX, searchY));
    const ordered = [...fills].sort((a, b) => a - b);
    // Empty bubbles ≈ lower fills (printed glyph only); filled bubble sits well above.
    const empty = ordered[Math.floor(ordered.length * 0.3)] ?? 0;
    const above = fills.map((fill) => Math.max(0, fill - empty));
    const ranked = above
      .map((value, digit) => ({ value, digit }))
      .sort((a, b) => b.value - a.value);
    const top = ranked[0]!;
    const second = ranked[1]?.value ?? 0;
    const lead = top.value - second;
    if (top.value < 0.08 || lead < 0.04) return null;
    digits += String(top.digit);
    score += lead;
  }
  return /^\d{7}$/.test(digits) ? { digits, score } : null;
}

/**
 * Fine vertical nudge only (±0.15 row). Full ±1 shifts look "confident" while
 * reading every digit as N±1 — never auto-accept those.
 */
function digitsFromGridRobust(
  rgba: Rgba,
  xs: number[],
  ys: number[],
  radius: number,
  thr: number,
  search = 0,
): RollRead | null {
  if (ys.length < 2) return digitsFromGrid(rgba, xs, ys, radius, thr, search);
  const rowPitch = median(ys.slice(1).map((y, i) => y - ys[i]!));
  const base = digitsFromGrid(rgba, xs, ys, radius, thr, search);
  let best = base;
  for (const frac of [0.15, -0.15]) {
    const shifted = ys.map((y) => y + frac * rowPitch);
    const read = digitsFromGrid(rgba, xs, shifted, radius, thr, search);
    if (!read) continue;
    if (!best || read.score > best.score * 1.08) best = read;
  }
  return best;
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
      // Ring finding still uses any-colour ink so pale red bubbles register.
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

/**
 * Place `count` centres on a regular pitch that maximises ink under each centre.
 * Adjacent same-digit fills often merge into one wide ink run; peak/run splitting then
 * collapses two columns into one. A fixed-pitch lattice still lands on both columns.
 */
function fitPitchCentres(profile: number[], count: number, pitchHint: number) {
  if (profile.length < count * 2 || pitchHint <= 0) return null;
  let best: number[] | null = null;
  let bestScore = -Infinity;
  const pitchLo = pitchHint * 0.72;
  const pitchHi = pitchHint * 1.28;
  const pitchStep = Math.max(0.5, pitchHint * 0.02);
  for (let pitch = pitchLo; pitch <= pitchHi; pitch += pitchStep) {
    const span = pitch * (count - 1);
    if (span >= profile.length - 1) continue;
    const maxStart = profile.length - 1 - span;
    const startStep = Math.max(0.5, pitch * 0.04);
    for (let start = 0; start <= maxStart; start += startStep) {
      let score = 0;
      const centres: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const at = start + i * pitch;
        const lo = Math.max(0, Math.floor(at - pitch * 0.2));
        const hi = Math.min(profile.length - 1, Math.ceil(at + pitch * 0.2));
        let local = 0;
        let peakAt = at;
        for (let x = lo; x <= hi; x += 1) {
          const value = profile[x]!;
          if (value > local) {
            local = value;
            peakAt = x;
          }
        }
        score += local;
        centres.push(peakAt);
      }
      // Prefer even spacing when scores tie (keeps columns from collapsing together).
      const gaps = centres.slice(1).map((x, i) => x - centres[i]!);
      const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      const spread = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
      const ranked = score - spread * 0.05;
      if (ranked > bestScore) {
        bestScore = ranked;
        best = centres;
      }
    }
  }
  return best;
}

function axisCentresX(profile: number[], count: number, pitchHint: number, minWidth: number) {
  // Pitch-fit helps when adjacent filled columns merge into one ink run.
  return (
    fitPitchCentres(profile, count, pitchHint) ??
    takeSpaced(runCentres(profile, minWidth, 2), count, pitchHint)
  );
}

function axisCentresY(profile: number[], count: number, pitchHint: number, minWidth: number) {
  // Do not ink-maximise Y — filled rows pull the lattice and shift every digit ±1.
  return (
    takeSpaced(runCentres(profile, minWidth, 2), count, pitchHint) ??
    fitPitchCentres(profile, count, pitchHint)
  );
}

/** Every evenly spaced window of `count` centres — the true 0–9 lattice is one of these. */
function spacedWindows(centres: number[], count: number, pitchHint: number) {
  if (centres.length < count) return [] as number[][];
  const out: number[][] = [];
  for (let i = 0; i <= centres.length - count; i += 1) {
    const slice = centres.slice(i, i + count);
    const gaps = slice.slice(1).map((x, k) => x - slice[k]!);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (mean < pitchHint * 0.7 || mean > pitchHint * 1.35) continue;
    const spread = gaps.reduce((sum, gap) => sum + Math.abs(gap - mean), 0) / gaps.length;
    if (spread > pitchHint * 0.22) continue;
    out.push(slice);
  }
  return out;
}

function ringPaperThr(rgba: Rgba, x0: number, y0: number, x1: number, y1: number) {
  const values: number[] = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) values.push(grayAt(rgba, x, y));
  }
  values.sort((a, b) => a - b);
  return (values[Math.floor(values.length * 0.7)] ?? 200) * 0.66;
}

function rollFromBox(
  rgba: Rgba,
  box: { x0: number; y0: number; x1: number; y1: number },
  peaked: boolean,
): RollRead | null {
  const x0 = box.x0 * rgba.width;
  const x1 = box.x1 * rgba.width;
  const y0 = box.y0 * rgba.height;
  const y1 = box.y1 * rgba.height;
  const colPitch = (x1 - x0) / ROLL_COLS;
  const rowPitch = (y1 - y0) / ROLL_ROWS;
  const thr = paperThr(rgba, x0, y0, x1, y1);
  const ringThr = ringPaperThr(rgba, x0, y0, x1, y1);
  const radius = Math.max(3, Math.min(colPitch, rowPitch) * 0.32);
  const search = Math.max(2, Math.min(colPitch, rowPitch) * 0.18);
  if (!peaked) {
    const xs = Array.from({ length: ROLL_COLS }, (_, c) => x0 + (c + 0.5) * colPitch);
    const ys = Array.from({ length: ROLL_ROWS }, (_, r) => y0 + (r + 0.5) * rowPitch);
    return digitsFromGridRobust(rgba, xs, ys, radius, thr, search);
  }
  const xsRel = axisCentresX(
    axisProfile(rgba, x0, y0, x1, y1, "x", ringThr),
    ROLL_COLS,
    colPitch,
    Math.max(3, colPitch * 0.2),
  );
  if (!xsRel) return null;
  const xs = xsRel.map((x) => x0 + x);
  const yProfile = axisProfile(rgba, x0, y0, x1, y1, "y", ringThr);
  const rowPitchHint = rowPitch;
  const centres = runCentres(yProfile, Math.max(3, rowPitchHint * 0.2), 2).map((y) => y0 + y);
  const windows =
    spacedWindows(centres, ROLL_ROWS, rowPitchHint).length > 0
      ? spacedWindows(centres, ROLL_ROWS, rowPitchHint)
      : [
          axisCentresY(yProfile, ROLL_ROWS, rowPitchHint, Math.max(3, rowPitchHint * 0.2))?.map(
            (y) => y0 + y,
          ) ?? null,
        ].filter((row): row is number[] => !!row);
  let best: RollRead | null = null;
  for (const ys of windows) {
    const read = digitsFromGridRobust(rgba, xs, ys, radius, thr, 0);
    if (read && (!best || read.score > best.score)) best = read;
  }
  return best;
}

function rollFromHough(rgba: Rgba): RollRead | null {
  const src = matFromRgba(rgba.data, rgba.width, rgba.height);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const circles = houghCircles(gray).filter(
    (c) =>
      c.y > rgba.height * 0.1 &&
      c.y < rgba.height * 0.48 &&
      c.x > rgba.width * 0.03 &&
      c.x < rgba.width * 0.48,
  );
  src.delete();
  gray.delete();
  if (circles.length < 40) return null;
  const radius = median(circles.map((c) => c.r)) || Math.min(rgba.width, rgba.height) * 0.008;
  // Merge a little wider so split detections of the same bubble do not invent extra rows.
  const colGroups = uniqueCenters(circles.map((c) => c.x), radius * 1.45).filter((row) => row.n >= 4);
  const rowGroups = uniqueCenters(circles.map((c) => c.y), radius * 1.35).filter((row) => row.n >= 4);
  const colMeans = colGroups.sort((a, b) => a.mean - b.mean).map((row) => row.mean);
  const rowMeans = rowGroups.sort((a, b) => a.mean - b.mean).map((row) => row.mean);
  if (colMeans.length < ROLL_COLS || rowMeans.length < ROLL_ROWS) return null;
  const colPitch =
    median(colMeans.slice(1).map((x, i) => x - colMeans[i]!)) || radius * 2.6;
  const rowPitch =
    median(rowMeans.slice(1).map((y, i) => y - rowMeans[i]!)) || radius * 2.4;
  // Prefer the densest evenly spaced 7 columns (registration grid, not answer options).
  const colWindows = spacedWindows(colMeans, ROLL_COLS, colPitch);
  let colXs: number[] | null = null;
  let colSupport = -1;
  for (const window of colWindows.length ? colWindows : [takeSpaced(colMeans, ROLL_COLS, colPitch)].filter(Boolean) as number[][]) {
    const support = window.reduce((sum, x) => {
      const hit = colGroups.find((g) => Math.abs(g.mean - x) < radius);
      return sum + (hit?.n ?? 0);
    }, 0);
    if (support > colSupport) {
      colSupport = support;
      colXs = window;
    }
  }
  if (!colXs) return null;
  const thr = paperThr(rgba, rgba.width * 0.04, rgba.height * 0.1, rgba.width * 0.45, rgba.height * 0.48);
  // Try every evenly spaced 10-row window. Handwriting boxes / answer-grid rows also
  // cluster; only the real 0–9 lattice gives one clear dark bubble per column.
  const rowWindows = spacedWindows(rowMeans, ROLL_ROWS, rowPitch);
  const candidates =
    rowWindows.length > 0
      ? rowWindows
      : [
          takeSpaced(rowMeans, ROLL_ROWS, rowPitch),
          spacedWindow(rowMeans.slice(0, ROLL_ROWS), ROLL_ROWS),
          rowMeans.length > ROLL_ROWS
            ? spacedWindow(rowMeans.slice(1, 1 + ROLL_ROWS), ROLL_ROWS)
            : null,
        ].filter((row): row is number[] => !!row);
  let best: RollRead | null = null;
  for (const rowYs of candidates) {
    const read = digitsFromGridRobust(rgba, colXs, rowYs, radius, thr, radius * 0.22);
    if (!read) continue;
    if (!best || read.score > best.score) best = read;
  }
  return best;
}

/** Best evenly spaced window of `count` centres when takeSpaced cannot match pitch. */
function spacedWindow(centres: number[], count: number) {
  if (centres.length < count) return null;
  if (centres.length === count) return centres;
  let best: number[] | null = null;
  let bestSpread = Infinity;
  for (let i = 0; i <= centres.length - count; i += 1) {
    const slice = centres.slice(i, i + count);
    const gaps = slice.slice(1).map((x, k) => x - slice[k]!);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const spread = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
    if (spread < bestSpread) {
      bestSpread = spread;
      best = slice;
    }
  }
  return best;
}

export function readRollBubbleCandidates(rgba: Rgba) {
  const reads: RollRead[] = [];
  const add = (read: RollRead | null) => {
    // Unbubbled sheets collapse to 0000000 / 1111111 — drop those before ranking.
    if (!read || !/^\d{7}$/.test(read.digits) || /^(\d)\1{6}$/.test(read.digits)) return;
    const existing = reads.find((row) => row.digits === read.digits);
    if (existing) existing.score = Math.max(existing.score, read.score);
    else reads.push(read);
  };
  // Hough circle lattice first — more stable than ink-window guesses on photos.
  add(rollFromHough(rgba));
  for (const box of ROLL_WINDOWS) {
    add(rollFromBox(rgba, box, true));
    add(rollFromBox(rgba, box, false));
  }
  // Do not invent ±1-every-digit strings. Those bind to the wrong enrolled student
  // when the raw bubble read was already correct (or only one digit off).
  reads.sort((a, b) => b.score - a.score);
  return reads.map((read) => read.digits);
}

function houghCircles(gray: CvMat) {
  const blur = new cv.Mat();
  const circlesMat = new cv.Mat();
  cv.medianBlur(gray, blur, 5);
  const minR = Math.max(4, Math.round(Math.min(gray.cols, gray.rows) * 0.006));
  const maxR = Math.max(minR + 2, Math.round(Math.min(gray.cols, gray.rows) * 0.014));
  // Slightly looser accumulator so filled (ink-dark) bubbles still count as circles.
  cv.HoughCircles(blur, circlesMat, cv.HOUGH_GRADIENT, 1.1, minR * 1.5, 55, 12, minR, maxR);
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
