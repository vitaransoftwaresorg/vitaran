import { cv, matFromRgba } from "../scan/cv.js";
import { ANSWER_OPTIONS, type AnswerOption } from "./answer-key-parse.js";
import type { Rgba } from "./omr-geometry.js";

/**
 * Vitaran answer grid: 5 blocks of 20 questions side by side, each question row has A–D.
 * Rows come in 4 groups of 5 separated by a wider gap. Positions are found from the printed
 * bubble circles on every sheet, so framing, margins and tilt of a phone photo do not matter.
 */
const BLOCKS = 5;
const OPTIONS = ANSWER_OPTIONS.length;
const GROUPS = 4;
const ROWS_PER_GROUP = 5;
const ROWS = GROUPS * ROWS_PER_GROUP;
const COLS = BLOCKS * OPTIONS;

type Circle = { x: number; y: number; r: number };
type Cluster = { mean: number; n: number };

export type AnswerGrid = {
  /** Centre of every bubble, [row 0..19][col 0..19]. */
  points: Array<Array<{ x: number; y: number }>>;
  radius: number;
  angle: number;
  /** How many of the 400 lattice points matched a detected circle. */
  snapped: number;
  /**
   * Worst gap between neighbouring bubbles (options in a block, rows in a group) relative to the
   * usual gap. Clean reads stay under ~0.4; a lattice that slid onto the wrong circles collapses
   * two points together or stretches a gap, reading ≥0.75 and shifting answers by an option.
   */
  spacingError: number;
};

/** Above this the grid is misaligned and answers would be read off the wrong bubbles. */
export const MAX_SPACING_ERROR = 0.6;

function spacingError(points: AnswerGrid["points"]) {
  const across: number[] = [];
  const down: number[] = [];
  const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (col % OPTIONS !== OPTIONS - 1) across.push(gap(points[row]![col]!, points[row]![col + 1]!));
      if (row % ROWS_PER_GROUP !== ROWS_PER_GROUP - 1) down.push(gap(points[row]![col]!, points[row + 1]![col]!));
    }
  }
  const worst = (gaps: number[]) => {
    const usual = median(gaps);
    return usual > 0 ? Math.max(...gaps.map((g) => Math.abs(g - usual) / usual)) : Infinity;
  };
  return Math.max(worst(across), worst(down));
}

export type GridCell = {
  question: number;
  option: AnswerOption;
  x: number;
  y: number;
  /** Ink in the bubble above this option's empty level on the same sheet, 0..1. */
  score: number;
  raw: number;
};

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function detectCircles(rgba: Rgba): Circle[] {
  const src = matFromRgba(rgba.data, rgba.width, rgba.height);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const blur = new cv.Mat();
  cv.medianBlur(gray, blur, 3);
  const out = new cv.Mat();
  const scale = rgba.width / 1000;
  const minR = Math.max(4, Math.round(6.5 * scale));
  const maxR = Math.max(minR + 3, Math.round(16 * scale));
  cv.HoughCircles(blur, out, cv.HOUGH_GRADIENT, 1, minR * 1.6, 60, 12, minR, maxR);
  const circles: Circle[] = [];
  for (let i = 0; i < out.cols; i++) {
    circles.push({ x: out.data32F[i * 3]!, y: out.data32F[i * 3 + 1]!, r: out.data32F[i * 3 + 2]! });
  }
  src.delete();
  gray.delete();
  blur.delete();
  out.delete();
  return circles;
}

function cluster1d(values: number[], tol: number): Cluster[] {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: Array<{ sum: number; n: number; mean: number }> = [];
  for (const v of sorted) {
    const last = groups[groups.length - 1];
    if (last && v - last.mean <= tol) {
      last.sum += v;
      last.n += 1;
      last.mean = last.sum / last.n;
    } else groups.push({ sum: v, n: 1, mean: v });
  }
  return groups.map(({ mean, n }) => ({ mean, n }));
}

/** Tilt of the sheet from neighbouring bubbles in the same row. */
function estimateAngle(circles: Circle[], r: number) {
  const angles: number[] = [];
  for (const a of circles) {
    let best: Circle | null = null;
    for (const b of circles) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx < r * 1.5 || dx > r * 3.2 || Math.abs(dy) > r * 0.8) continue;
      if (!best || dx < best.x - a.x) best = b;
    }
    if (best) angles.push(Math.atan2(best.y - a.y, best.x - a.x));
  }
  return median(angles);
}

/**
 * Split sorted cluster centres into `parts` runs of `each` using the widest gaps, and fill a
 * missing centre inside a run from the run's pitch. Returns null when the shape does not fit.
 */
function splitRuns(centres: number[], parts: number, each: number): number[] | null {
  if (centres.length < parts * (each - 1)) return null;
  const gaps = centres.slice(1).map((v, i) => ({ i, gap: v - centres[i]! }));
  const pitch = median(gaps.map((g) => g.gap));
  const cuts = [...gaps]
    .sort((a, b) => b.gap - a.gap)
    .slice(0, parts - 1)
    .filter((g) => g.gap > pitch * 1.35)
    .map((g) => g.i)
    .sort((a, b) => a - b);
  if (cuts.length !== parts - 1) return null;
  const runs: number[][] = [];
  let start = 0;
  for (const cut of [...cuts, centres.length - 1]) {
    runs.push(centres.slice(start, cut + 1));
    start = cut + 1;
  }
  const out: number[] = [];
  for (const run of runs) {
    let fixed = run;
    if (fixed.length > each) return null;
    while (fixed.length < each) {
      // One centre missed inside or at the end of a run: insert by pitch where the gap is widest.
      const inner = fixed.slice(1).map((v, i) => ({ i, gap: v - fixed[i]! }));
      const wide = inner.sort((a, b) => b.gap - a.gap)[0];
      if (wide && wide.gap > pitch * 1.6) {
        fixed = [...fixed.slice(0, wide.i + 1), fixed[wide.i]! + wide.gap / 2, ...fixed.slice(wide.i + 1)];
      } else return null;
    }
    out.push(...fixed);
  }
  return out.length === parts * each ? out : null;
}

/** Keep the densest band of clusters that matches the expected count (answer grid, not header). */
function pickClusters(clusters: Cluster[], minN: number) {
  return clusters.filter((c) => c.n >= minN).map((c) => c.mean);
}

const debug = (...args: unknown[]) => {
  if (process.env.OMR_DEBUG) console.log("[omr-grid]", ...args);
};

export function locateAnswerGrid(rgba: Rgba): AnswerGrid | null {
  const all = detectCircles(rgba);
  debug("circles", all.length);
  if (all.length < 200) return null;
  const r = median(all.map((c) => c.r));
  const circles = all.filter((c) => c.r >= r * 0.7 && c.r <= r * 1.4);
  const angle = estimateAngle(circles, r);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const cx = rgba.width / 2;
  const cy = rgba.height / 2;
  const rotated = circles.map((c) => ({
    ...c,
    u: cx + (c.x - cx) * cos - (c.y - cy) * sin,
    v: cy + (c.x - cx) * sin + (c.y - cy) * cos,
  }));

  // Answer rows carry up to 20 bubbles; registration rows only 7, header text a few.
  const rowClusters = cluster1d(rotated.map((c) => c.v), r * 0.7);
  const dense = pickClusters(rowClusters, 10);
  debug("angle", ((angle * 180) / Math.PI).toFixed(2), "r", r.toFixed(1), "dense rows", dense.length, dense.map((v) => v.toFixed(0)).join(","));
  const rowVs = splitRuns(dense.length > ROWS ? bestWindow(dense, ROWS) : dense, GROUPS, ROWS_PER_GROUP);
  if (!rowVs) return null;

  // Circles on each answer row, left to right.
  const rowCircles = rowVs.map((v) =>
    rotated.filter((c) => Math.abs(c.v - v) <= r * 0.8).sort((a, b) => a.u - b.u),
  );

  // Column centres from the cleanest row, then tracked row by row so perspective drift
  // (columns leaning across the sheet) is followed instead of splitting a column in two.
  let refRow = -1;
  let refCols: number[] | null = null;
  const order = rowCircles
    .map((cs, i) => ({ i, n: cs.length }))
    .sort((a, b) => Math.abs(a.n - COLS) - Math.abs(b.n - COLS) || Math.abs(a.i - ROWS / 2) - Math.abs(b.i - ROWS / 2));
  for (const { i } of order) {
    const us = cluster1d(rowCircles[i]!.map((c) => c.u), r * 0.9).map((c) => c.mean);
    const cols = splitRuns(us, BLOCKS, OPTIONS);
    if (cols) {
      refRow = i;
      refCols = cols;
      break;
    }
  }
  debug("ref row", refRow, refCols?.map((u) => u.toFixed(0)).join(","));
  if (!refCols) return null;
  const pitch = median(refCols.slice(1).map((u, i) => u - refCols![i]!).filter((d) => d < r * 4));

  const tracked: Array<Array<{ u: number; v: number } | null>> = rowVs.map(() => new Array(COLS).fill(null));
  const track = (row: number, predicted: number[]) => {
    const found = predicted.map((u) => {
      let best: (typeof rotated)[number] | null = null;
      for (const c of rowCircles[row]!) {
        if (Math.abs(c.u - u) > pitch * 0.4) continue;
        if (!best || Math.abs(c.u - u) < Math.abs(best.u - u)) best = c;
      }
      return best;
    });
    found.forEach((c, col) => {
      tracked[row]![col] = c ? { u: c.u, v: c.v } : null;
    });
    // Shift unmatched predictions by the row's median drift.
    const drift = median(found.flatMap((c, col) => (c ? [c.u - predicted[col]!] : [])));
    return predicted.map((u, col) => found[col]?.u ?? u + drift);
  };
  let next = track(refRow, refCols);
  for (let row = refRow + 1; row < ROWS; row++) next = track(row, next);
  next = refCols;
  for (let row = refRow - 1; row >= 0; row--) next = track(row, next);

  // Least-squares line per column (u against v) and per row (v against u).
  const fit = (pts: Array<{ a: number; b: number }>) => {
    if (pts.length < 2) return null;
    const ma = pts.reduce((s, p) => s + p.a, 0) / pts.length;
    const mb = pts.reduce((s, p) => s + p.b, 0) / pts.length;
    const vaa = pts.reduce((s, p) => s + (p.a - ma) ** 2, 0);
    const slope = vaa > 1e-6 ? pts.reduce((s, p) => s + (p.a - ma) * (p.b - mb), 0) / vaa : 0;
    return (a: number) => mb + slope * (a - ma);
  };
  const colLines = Array.from({ length: COLS }, (_, col) =>
    fit(tracked.flatMap((row) => (row[col] ? [{ a: row[col]!.v, b: row[col]!.u }] : []))),
  );
  const rowLines = tracked.map((row) => fit(row.flatMap((p) => (p ? [{ a: p.u, b: p.v }] : []))));
  if (colLines.some((line) => !line)) return null;

  // Back to image space; snap each lattice point to the detected circle under it.
  const back = (u: number, v: number) => ({
    x: cx + (u - cx) * Math.cos(angle) - (v - cy) * Math.sin(angle),
    y: cy + (u - cx) * Math.sin(angle) + (v - cy) * Math.cos(angle),
  });
  let snapped = 0;
  const points = rowVs.map((rowV, row) =>
    Array.from({ length: COLS }, (_, col) => {
      const u0 = colLines[col]!(rowV);
      const v = rowLines[row]?.(u0) ?? rowV;
      const u = colLines[col]!(v);
      const guess = back(u, v);
      let best: Circle | null = null;
      let bestD = (r * 0.6) ** 2;
      for (const c of circles) {
        const d = (c.x - guess.x) ** 2 + (c.y - guess.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best) {
        snapped += 1;
        return { x: best.x, y: best.y };
      }
      return guess;
    }),
  );
  return { points, radius: r, angle: (angle * 180) / Math.PI, snapped, spacingError: spacingError(points) };
}

/** The window of `count` consecutive clusters with the most even spacing pattern (4×5 rows). */
function bestWindow(values: number[], count: number) {
  let best = values.slice(-count);
  let bestScore = -Infinity;
  for (let i = 0; i + count <= values.length; i++) {
    const slice = values.slice(i, i + count);
    if (!splitRuns(slice, GROUPS, ROWS_PER_GROUP)) continue;
    const span = slice[slice.length - 1]! - slice[0]!;
    const score = -span;
    if (score > bestScore) {
      bestScore = score;
      best = slice;
    }
  }
  return best;
}

type Channel = "min" | "max";

/**
 * "min" sees any colour as ink (red pen, highlighter, and also the red printed letters).
 * "max" only sees dark ink — pencil, blue/black pen — and ignores the red template print.
 */
function level(rgba: Rgba, x: number, y: number, channel: Channel) {
  const sx = Math.max(0, Math.min(rgba.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(rgba.height - 1, Math.round(y)));
  const i = (sy * rgba.width + sx) * 4;
  const r = rgba.data[i]!;
  const g = rgba.data[i + 1]!;
  const b = rgba.data[i + 2]!;
  return channel === "min" ? Math.min(r, g, b) : Math.max(r, g, b);
}

/** Paper brightness near a bubble (bright percentile of a ring just outside it). */
function paperNear(rgba: Rgba, x: number, y: number, r: number, channel: Channel) {
  const values: number[] = [];
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    values.push(level(rgba, x + Math.cos(t) * r * 1.9, y + Math.sin(t) * r * 1.9, channel));
  }
  values.sort((p, q) => p - q);
  return values[Math.floor(values.length * 0.75)]!;
}

/** Share of the bubble interior that is clearly darker than the paper around it. */
function interiorInk(rgba: Rgba, x: number, y: number, r: number, channel: Channel, paper: number) {
  const thr = paper * 0.7;
  const inner = r * 0.62;
  let dark = 0;
  let n = 0;
  for (let dy = -inner; dy <= inner; dy += 1) {
    for (let dx = -inner; dx <= inner; dx += 1) {
      if (dx * dx + dy * dy > inner * inner) continue;
      n += 1;
      if (level(rgba, x + dx, y + dy, channel) < thr) dark += 1;
    }
  }
  return n ? dark / n : 0;
}

/**
 * Measured on real sheets: empty bubbles (printed letter only) score up to ~0.12, filled ones
 * 0.65+. A bubble at least 15% inked above its empty level counts as attempted.
 */
const MARK = 0.15;
/** Below MARK but above the empty noise: shown to the examiner instead of guessed. */
const FAINT = 0.08;
/** A second option is a real double mark only when it is this close to the darkest. */
const MULTI_RATIO = 0.6;

function emptyLevels(raw: number[][]) {
  // Empty level per option column: the printed letter inks each empty bubble a little.
  return Array.from({ length: COLS }, (_, col) => {
    const values = raw.map((row) => row[col]!).sort((a, b) => a - b);
    return values[Math.floor(values.length * 0.25)]!;
  });
}

/** Paper within this many rows / option columns of a bubble backs up its own ring. */
const PAPER_ROWS = 1;
const PAPER_COLS = 2;
/** Shadows can dim one bubble's ring slightly below its neighbours; only bigger drops are ink. */
const PAPER_SLACK = 0.92;

/**
 * Paper level per bubble. Ink that spills past the circle darkens that bubble's own ring and
 * would make a filled bubble look empty, so the neighbours' paper is a floor.
 */
function paperLevels(rgba: Rgba, grid: AnswerGrid, channel: Channel) {
  const local = grid.points.map((row) => row.map((p) => paperNear(rgba, p.x, p.y, grid.radius, channel)));
  return local.map((row, r) =>
    row.map((own, c) => {
      const around: number[] = [];
      for (let dr = -PAPER_ROWS; dr <= PAPER_ROWS; dr++) {
        for (let dc = -PAPER_COLS; dc <= PAPER_COLS; dc++) {
          const value = local[r + dr]?.[c + dc];
          if (value !== undefined) around.push(value);
        }
      }
      return Math.max(own, median(around) * PAPER_SLACK);
    }),
  );
}

export function scoreAnswerGrid(rgba: Rgba, grid: AnswerGrid, channel: Channel = "min") {
  const paper = paperLevels(rgba, grid, channel);
  const raw: number[][] = grid.points.map((row, r) =>
    row.map((p, c) => interiorInk(rgba, p.x, p.y, grid.radius, channel, paper[r]![c]!)),
  );
  const empty = emptyLevels(raw);
  const cells: GridCell[] = [];
  const answers: Record<string, AnswerOption[]> = {};
  const flags: Array<{ question: number; reason: string }> = [];
  for (let row = 0; row < ROWS; row++) {
    for (let block = 0; block < BLOCKS; block++) {
      const question = block * ROWS + row + 1;
      const options = ANSWER_OPTIONS.map((option, o) => {
        const col = block * OPTIONS + o;
        const p = grid.points[row]![col]!;
        const value = raw[row]![col]!;
        const score = Math.max(0, value - empty[col]!);
        cells.push({ question, option, x: p.x, y: p.y, score, raw: value });
        return { option, score };
      });
      const ranked = [...options].sort((a, b) => b.score - a.score);
      const top = ranked[0]!;
      if (top.score < MARK) {
        if (top.score >= FAINT) flags.push({ question, reason: `Faint mark on ${top.option} — please check` });
        continue;
      }
      // A second option counts only when it is itself a real fill, not a smudge.
      const picked = ranked.filter((o) => o.score >= MARK && o.score >= top.score * MULTI_RATIO);
      answers[String(question)] = picked.map((o) => o.option);
      if (picked.length > 1) flags.push({ question, reason: "More than one option is filled" });
    }
  }
  return { answers, cells, flags };
}
