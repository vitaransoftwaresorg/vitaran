import { ANSWER_OPTIONS, type AnswerOption } from "./answer-key-parse.js";
import type { Gray, Rgba } from "./omr-geometry.js";

const COLS = 5;
const GROUPS = 4;
const ROWS_PER_GROUP = 5;
const ROWS = GROUPS * ROWS_PER_GROUP;
const OPTIONS = ANSWER_OPTIONS.length;

/**
 * Measured on a warped full Vitaran sheet. A bubbles-only crop skips the header band and
 * uses the whole frame; the four question groups are found on the photo either way.
 */
const AREA = { x0: 0.02, x1: 0.95, y0: 0.36, y1: 0.82 };
const COL_SPLITS = [0.215, 0.4, 0.58, 0.76];
const GROUP_SPLITS = [0.464, 0.572, 0.688];
const SPLIT_SEARCH_X = 0.05;
const SPLIT_SEARCH_Y = 0.035;
/**
 * The darkest option in a row is the answer when it stands clear of the other three, so light
 * pencil still counts. Fills here are above the option's empty-bubble level on the same sheet.
 */
const MARK_MIN = 0.05;
const MARK_LEAD = 0.05;
/** A printed letter never inks more of the core than this; above it the option is just popular. */
const LETTER_INK_MAX = 0.15;
/** Every option this dark, and at least this share of the darkest option's fill, is filled. */
const MARK_FILL = 0.22;
const MARK_RATIO = 0.6;

export type OmFlag = { question: number; reason: string };

export type OmBubble = {
  question: number;
  option: AnswerOption;
  x: number;
  y: number;
  fill: number;
  /** Mean ink across the 8 sectors of the inner ring. */
  ring: number;
  /** Ink in the emptiest sector: low for dots, crosses and ticks. */
  even: number;
};

export type OmLayout = {
  /** Filled options, A–D packed ("A", "ACD"). Empty questions are omitted. */
  answers: Record<string, string>;
  flags: OmFlag[];
  markCount: number;
  bubbles: OmBubble[];
  radius: number;
  headerBottom: number;
  /** True when the four question groups and five columns were measured on this photo. */
  measured: boolean;
};

type Box = { x0: number; x1: number; y0: number; y1: number };
type Run = { start: number; end: number };
type OptionFit = { xs: number[]; width: number; pitch: number | null };

function inkImage(rgba: Rgba): Gray {
  const n = rgba.width * rgba.height;
  const data = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    data[i] = Math.min(rgba.data[i * 4]!, rgba.data[i * 4 + 1]!, rgba.data[i * 4 + 2]!);
  }
  return { width: rgba.width, height: rgba.height, data };
}

function px(img: Gray, x: number, y: number) {
  const sx = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  return img.data[sy * img.width + sx] ?? 255;
}

function paperLevel(img: Gray, box: Box) {
  const values: number[] = [];
  for (let y = box.y0; y < box.y1; y += 2) {
    for (let x = box.x0; x < box.x1; x += 2) values.push(px(img, x, y));
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length * 0.7)] ?? 255;
}

function xProfile(img: Gray, box: Box, thr: number) {
  const out: number[] = [];
  for (let x = box.x0; x < box.x1; x++) {
    let n = 0;
    for (let y = box.y0; y < box.y1; y++) if (px(img, x, y) < thr) n += 1;
    out.push(n);
  }
  return out;
}

function yProfile(img: Gray, box: Box, thr: number) {
  const out: number[] = [];
  for (let y = box.y0; y < box.y1; y++) {
    let n = 0;
    for (let x = box.x0; x < box.x1; x++) if (px(img, x, y) < thr) n += 1;
    out.push(n);
  }
  return out;
}

function smooth(values: number[], half: number) {
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      sum += values[j]!;
      n += 1;
    }
    return sum / n;
  });
}

function valleys(profile: number[], offset: number, expected: number[], search: number) {
  const smoothed = smooth(profile, 4);
  return expected.map((at) => {
    const lo = Math.max(0, Math.round(at - search - offset));
    const hi = Math.min(smoothed.length - 1, Math.round(at + search - offset));
    let best = lo;
    for (let i = lo; i <= hi; i++) if (smoothed[i]! < smoothed[best]!) best = i;
    return best + offset;
  });
}

function inkRuns(profile: number[], thr: number, mergeGap: number): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i]! < thr) continue;
    if (current && i - current.end <= mergeGap) current.end = i;
    else {
      current = { start: i, end: i };
      runs.push(current);
    }
  }
  return runs;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function optionCentres(img: Gray, cell: Box, thr: number): OptionFit | null {
  const profile = xProfile(img, cell, thr);
  const peak = Math.max(...profile);
  const runs = inkRuns(profile, Math.max(2, peak * 0.12), 3)
    .map((run) => ({ start: cell.x0 + run.start, end: cell.x0 + run.end, width: run.end - run.start + 1 }))
    .filter((run) => run.width >= 5);
  if (runs.length < 2) return null;
  const sized = runs.map((run) => run.width).filter((w) => w >= 12);
  if (sized.length === 0) return null;
  const smallest = Math.min(...sized);
  const width = median(sized.filter((w) => w <= smallest * 1.6));
  const clean = runs.filter((run) => run.width >= width * 0.75 && run.width <= width * 1.3);
  const centres = clean.map((run) => (run.start + run.end) / 2);
  const steps = centres
    .slice(1)
    .map((x, i) => x - centres[i]!)
    .filter((d) => d >= width * 1.0 && d <= width * 1.8);
  const pitch = steps.length ? median(steps) : null;
  // The red registration dots sit just right of the last column, well off the option pitch.
  while (runs.length > 2) {
    const last = runs[runs.length - 1]!;
    const prev = runs[runs.length - 2]!;
    if ((last.start + last.end) / 2 - (prev.start + prev.end) / 2 <= width * 2.2) break;
    runs.pop();
  }
  const dRight = runs[runs.length - 1]!.end;
  return { xs: [dRight - width / 2], width, pitch };
}

function finishOptions(fit: OptionFit, pitch: number, img: Gray, cell: Box, thr: number) {
  const step = fit.pitch ?? pitch;
  const d = fit.xs[0]!;
  const profile = xProfile(img, cell, thr);
  const peak = Math.max(...profile);
  const clean = inkRuns(profile, Math.max(2, peak * 0.12), 3)
    .map((run) => ({ centre: cell.x0 + (run.start + run.end) / 2, width: run.end - run.start + 1 }))
    .filter((run) => run.width >= fit.width * 0.75 && run.width <= fit.width * 1.3);
  return Array.from({ length: OPTIONS }, (_, i) => {
    const guess = d - (OPTIONS - 1 - i) * step;
    if (i === OPTIONS - 1) return guess;
    const near = clean.filter((run) => Math.abs(run.centre - guess) <= step * 0.3);
    if (near.length === 0) return guess;
    return near.reduce((a, b) => (Math.abs(a.centre - guess) <= Math.abs(b.centre - guess) ? a : b)).centre;
  });
}

function rowCentres(img: Gray, cell: Box, thr: number) {
  const profile = yProfile(img, cell, thr);
  const peak = Math.max(...profile);
  const runs = inkRuns(profile, Math.max(2, peak * 0.1), 3);
  if (runs.length === 0) return null;
  const top = runs[0]!.start;
  const bottom = runs[runs.length - 1]!.end;
  const slice = (bottom - top + 1) / ROWS_PER_GROUP;
  return Array.from({ length: ROWS_PER_GROUP }, (_, i) => {
    const guess = top + (i + 0.5) * slice;
    let mass = 0;
    let sum = 0;
    for (let y = Math.round(guess - slice / 2); y <= Math.round(guess + slice / 2); y++) {
      const v = profile[y] ?? 0;
      mass += v;
      sum += v * y;
    }
    return cell.y0 + (mass > 0 ? sum / mass : guess);
  });
}

function coreFill(img: Gray, cx: number, cy: number, radius: number, thr: number) {
  const r2 = radius * radius;
  let dark = 0;
  let total = 0;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      total += 1;
      if (px(img, x, y) < thr) dark += 1;
    }
  }
  return total ? dark / total : 0;
}

const SECTORS = 8;

/**
 * Ink across the inner ring of a bubble (inside the printed outline), split into 8 sectors.
 * A darkened circle inks every sector; a dot leaves the ring empty, a cross or tick leaves gaps.
 */
function ringShape(img: Gray, cx: number, cy: number, width: number, thr: number) {
  const inner = width * 0.18;
  const outer = width * 0.36;
  const dark = new Array<number>(SECTORS).fill(0);
  const total = new Array<number>(SECTORS).fill(0);
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 > outer * outer || d2 < inner * inner) continue;
      const angle = Math.atan2(y - cy, x - cx) + Math.PI;
      const sector = Math.min(SECTORS - 1, Math.floor((angle / (2 * Math.PI)) * SECTORS));
      total[sector]! += 1;
      if (px(img, x, y) < thr) dark[sector]! += 1;
    }
  }
  const fills = dark.map((n, i) => (total[i] ? n / total[i]! : 0));
  return {
    ring: fills.reduce((sum, v) => sum + v, 0) / SECTORS,
    even: Math.min(...fills),
  };
}

type Band = { y0: number; y1: number; run: number };

/**
 * Ink per row against the paper brightness of the surrounding strip, so a shadow across
 * the bottom of a phone photo does not read as ink.
 */
function localRowInk(img: Gray, x0: number, x1: number, yFrom: number) {
  const H = img.height;
  const levels = new Map<number, number>();
  const levelAt = (y: number) => {
    const block = Math.floor(y / 8);
    const cached = levels.get(block);
    if (cached != null) return cached;
    const level = paperLevel(img, { x0, x1, y0: Math.max(0, block * 8 - 24), y1: Math.min(H, block * 8 + 32) });
    levels.set(block, level);
    return level;
  };
  const rows: Array<{ ink: number; run: number }> = [];
  for (let y = yFrom; y < H; y++) {
    const thr = levelAt(y) * 0.82;
    let ink = 0;
    let run = 0;
    let longest = 0;
    for (let x = x0; x < x1; x++) {
      if (px(img, x, y) < thr) {
        ink += 1;
        run += 1;
        if (run > longest) longest = run;
      } else run = 0;
    }
    rows.push({ ink, run: longest });
  }
  return rows;
}

/**
 * The four printed question groups are bands of bubbles separated by clear paper.
 * Their height and position change with how the photo was taken, so measure them on every sheet.
 */
function findGroupBands(img: Gray, x0: number, x1: number, rowGap: number): { found: Box[][]; guessed: Box[][] } {
  const W = img.width;
  const H = img.height;
  const yFrom = Math.round(H * 0.01);
  const rows = localRowInk(img, x0, x1, yFrom);
  const bands: Band[] = [];
  let current: Band | null = null;
  rows.forEach((row, i) => {
    const y = yFrom + i;
    if (row.ink <= 6) return;
    if (current && y - current.y1 <= rowGap) {
      current.y1 = y;
      current.run = Math.max(current.run, row.run);
    } else {
      current = { y0: y, y1: y, run: row.run };
      bands.push(current);
    }
  });

  const isGroup = (band: Band) => {
    const h = band.y1 - band.y0;
    return h >= H * 0.04 && h <= H * 0.28 && band.run < W * 0.1;
  };
  const packs: Band[][] = [];
  const guesses: Band[][] = [];
  for (let i = 0; i < bands.length; i++) {
    const found: Band[] = [];
    for (let j = i; j < bands.length && found.length < GROUPS && isGroup(bands[j]!); j++) found.push(bands[j]!);
    if (found.length === GROUPS) packs.push(found);
    if (found.length !== GROUPS - 1) continue;
    const [a, b, c] = found as [Band, Band, Band];
    const gap = (b.y0 - a.y1 + (c.y0 - b.y1)) / 2;
    const height = c.y1 - c.y0 + (c.y1 - c.y0 - (b.y1 - b.y0));
    const next = bands[i + GROUPS - 1];
    const start = next && next.y0 - c.y1 <= gap * 2 ? next.y0 : c.y1 + gap;
    const end = Math.min(H - 1, start + height);
    if (end - start < height * 0.8) continue;
    guesses.push([...found, { y0: start, y1: end, run: 0 }]);
  }
  const rank = (list: Band[][]) =>
    list
      .map((pack) => {
        const heights = pack.map((band) => band.y1 - band.y0);
        const gaps = pack.slice(1).map((band, k) => band.y0 - pack[k]!.y1);
        const span = pack[GROUPS - 1]!.y1 - pack[0]!.y0;
        return { pack, score: span - variance(heights) * 4 - variance(gaps) * 4 };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ pack }) => pack.map(({ y0, y1 }) => ({ x0, x1, y0, y1 })));
  return { found: rank(packs), guessed: rank(guesses) };
}

function variance(values: number[]) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

/**
 * Inside one group band each printed column (label + A–D) is a cluster of ink, separated from the
 * next column by clear paper. Skewed photos move these clusters, so they are found per band.
 */
function columnClusters(img: Gray, band: Box): Box[] | null {
  const W = img.width;
  const ink = paperLevel(img, band) * 0.82;
  const profile = xProfile(img, band, ink);
  const runs = inkRuns(profile, 2, Math.round(W * 0.012))
    .map((run) => ({ x0: band.x0 + run.start, x1: band.x0 + run.end + 1 }))
    .filter((run) => run.x1 - run.x0 >= W * 0.08 && run.x1 - run.x0 <= W * 0.25);
  if (runs.length < COLS) return null;
  return runs
    .sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0))
    .slice(0, COLS)
    .sort((a, b) => a.x0 - b.x0)
    .map(({ x0, x1 }) => ({ x0, x1, y0: band.y0, y1: band.y1 }));
}

/**
 * Best evenly spaced comb of `count` bubbles in an ink profile: bubbles cover ink, the thin
 * paper gaps between neighbours stay clear. Returns centres in profile coordinates.
 */
function fitComb(
  profile: number[],
  count: number,
  pitchLo: number,
  pitchHi: number,
  lastLo = 0,
  lastHi = profile.length,
) {
  const sum = [0];
  for (const v of profile) sum.push(sum[sum.length - 1]! + v);
  const mean = (a: number, b: number) => {
    const lo = Math.max(0, Math.round(a));
    const hi = Math.min(profile.length, Math.round(b));
    return hi > lo ? (sum[hi]! - sum[lo]!) / (hi - lo) : 0;
  };
  let best: { centres: number[]; pitch: number; score: number } | null = null;
  for (let pitch = pitchLo; pitch <= pitchHi; pitch += 0.5) {
    const half = pitch * 0.4;
    for (let last = Math.max(lastLo, (count - 1) * pitch + half); last <= Math.min(lastHi, profile.length - half); last += 1) {
      const centres = Array.from({ length: count }, (_, k) => last - (count - 1 - k) * pitch);
      let score = 0;
      for (const c of centres) score += mean(c - half, c + half);
      for (let k = 0; k < count - 1; k++) score -= 1.5 * mean(centres[k]! + half, centres[k + 1]! - half);
      if (!best || score > best.score) best = { centres, pitch, score };
    }
  }
  return best;
}

function bubbleRuns(img: Gray, cell: Box, thr: number) {
  const profile = xProfile(img, cell, thr);
  const peak = Math.max(...profile);
  return inkRuns(profile, Math.max(2, peak * 0.12), 1).map((run) => ({
    centre: cell.x0 + (run.start + run.end) / 2,
    width: run.end - run.start + 1,
  }));
}

function measuredBlocks(img: Gray, bands: Box[]) {
  const W = img.width;
  const H = img.height;
  const pad = Math.round(H * 0.004);
  const cells: Array<{ c: number; g: number; cell: Box; ink: number; dark: number }> = [];
  for (let g = 0; g < GROUPS; g++) {
    const band: Box = {
      x0: Math.round(W * 0.01),
      x1: Math.round(W * 0.99),
      y0: Math.max(0, bands[g]!.y0 - pad),
      y1: Math.min(H, bands[g]!.y1 + pad),
    };
    const columns = columnClusters(img, band);
    if (!columns) return null;
    columns.forEach((cell, c) => {
      const local = paperLevel(img, cell);
      cells.push({ c, g, cell, ink: local * 0.82, dark: local * 0.55 });
    });
  }

  const widths: number[] = [];
  const steps: number[] = [];
  const runsByCell = cells.map(({ cell, ink }) => {
    const runs = bubbleRuns(img, cell, ink);
    const last = runs.slice(-OPTIONS);
    for (const run of last) widths.push(run.width);
    return last;
  });
  const width = median(widths.filter((w) => w >= W * 0.014));
  for (const runs of runsByCell) {
    for (let i = 1; i < runs.length; i++) {
      const step = runs[i]!.centre - runs[i - 1]!.centre;
      if (step >= width * 0.9 && step <= width * 1.8) steps.push(step);
    }
  }
  const pitch = steps.length ? median(steps) : width * 1.25;

  return cells.map(({ c, g, cell, ink, dark }): Block => {
    const xComb = fitComb(
      xProfile(img, cell, ink),
      OPTIONS,
      pitch * 0.85,
      pitch * 1.15,
      cell.x1 - cell.x0 - width * 1.4,
      cell.x1 - cell.x0,
    );
    if (!xComb) return { c, g, cell, ink, dark, fit: null, xs: null, ys: null };
    const xs = xComb.centres.map((x) => cell.x0 + x);
    const optionBox: Box = {
      ...cell,
      x0: Math.round(xs[0]! - xComb.pitch * 0.45),
      x1: Math.round(xs[OPTIONS - 1]! + xComb.pitch * 0.45),
    };
    const rowPitch = (cell.y1 - cell.y0) / ROWS_PER_GROUP;
    const yComb = fitComb(yProfile(img, optionBox, ink), ROWS_PER_GROUP, rowPitch * 0.8, rowPitch * 1.1);
    const ys = yComb ? yComb.centres.map((y) => cell.y0 + y) : null;
    const fit: OptionFit = { xs, width: xComb.pitch * 0.82, pitch: xComb.pitch };
    return { c, g, cell, ink, dark, fit, xs, ys };
  });
}

function pickMarked(cells: Array<{ option: AnswerOption; fill: number }>) {
  const ranked = [...cells].sort((a, b) => b.fill - a.fill);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.fill < MARK_MIN) return { marked: [] as typeof cells };
  const filled = ranked.filter((cell) => cell.fill >= MARK_FILL && cell.fill >= best.fill * MARK_RATIO);
  if (filled.length > 1) return { marked: filled };
  if (second && best.fill - second.fill < MARK_LEAD) return { marked: [] as typeof cells };
  return { marked: [best] };
}

export function layoutOmrBubbles(rgba: Rgba): OmLayout {
  const img = inkImage(rgba);
  const W = img.width;
  const H = img.height;
  const fullSheet = H / W > 1.2;
  const search: Box = {
    x0: Math.round(W * AREA.x0),
    x1: Math.round(W * AREA.x1),
    y0: Math.round(H * (fullSheet ? 0.3 : 0.02)),
    y1: Math.round(H * (fullSheet ? 0.9 : 0.98)),
  };
  // Crisp scans with faint outlines leave clear paper between bubble rows, so groups are also
  // merged across a wider gap (still well under the gap between groups). Four groups seen on
  // the sheet beat a guessed fourth, and a candidate only counts once all five columns are found.
  const groupX0 = Math.round(W * AREA.x0);
  const groupX1 = Math.round(W * AREA.x1);
  const tight = findGroupBands(img, groupX0, groupX1, 4);
  const wide = findGroupBands(img, groupX0, groupX1, Math.max(8, Math.round(H * 0.008)));
  const candidates = [...tight.found, ...wide.found, ...tight.guessed, ...wide.guessed];
  let measured: Block[] | null = null;
  for (const bands of candidates.slice(0, 12)) {
    measured = measuredBlocks(img, bands);
    if (measured) break;
  }
  const blocks = measured ?? fixedBlocks(img, search);
  const sheetPitch = median(blocks.flatMap((block) => (block.fit?.pitch != null ? [block.fit.pitch] : []))) || W * 0.03;

  const bubbles: OmBubble[] = [];
  const answers: Record<string, string> = {};
  const flags: OmFlag[] = [];
  const radii: number[] = [];

  for (const { c, g, cell, ink, dark, fit, xs: fixedXs, ys } of blocks) {
    const xs = fixedXs ?? (fit ? finishOptions(fit, sheetPitch, img, cell, ink) : null);
    const rows = ys ?? (xs && fit ? rowCentres(img, { ...cell, x0: Math.round(xs[0]! - fit.width) }, ink) : null);
    if (process.env.OMR_DEBUG) {
      console.log(
        `col ${c} group ${g} pitch ${fit?.pitch?.toFixed(1) ?? `sheet ${sheetPitch.toFixed(1)}`} width ${fit?.width} opts [${xs?.map((x) => x.toFixed(0)).join(",")}] rows [${rows?.map((y) => y.toFixed(0)).join(",")}] ${measured ? "measured" : "fallback"}`,
      );
    }
    for (let r = 0; r < ROWS_PER_GROUP; r++) {
      const question = c * ROWS + g * ROWS_PER_GROUP + r + 1;
      if (!fit || !xs || !rows) {
        flags.push({ question, reason: "Could not locate the bubbles for this question" });
        continue;
      }
      const radius = Math.max(3, fit.width * 0.3);
      radii.push(radius);
      const cy = rows[r]!;
      const cells = xs.map((cx, i) => ({
        option: ANSWER_OPTIONS[i]!,
        x: cx,
        y: cy,
        fill: coreFill(img, cx, cy, radius, dark),
        ...ringShape(img, cx, cy, fit.width, dark),
      }));
      for (const cellRead of cells) bubbles.push({ question, ...cellRead });
    }
  }

  // The printed letter inside an empty bubble carries ink of its own ("B" more than "C"), and
  // light varies across a photo. Measure each option's empty level per printed column of 20
  // questions and judge marks above it.
  const columnOf = (question: number) => Math.floor((question - 1) / ROWS);
  const baseline = new Map<string, number>();
  for (let c = 0; c < COLS; c++) {
    for (const option of ANSWER_OPTIONS) {
      const fills = bubbles
        .filter((b) => b.option === option && columnOf(b.question) === c)
        .map((b) => b.fill)
        .sort((a, b) => a - b);
      baseline.set(`${c}${option}`, Math.min(LETTER_INK_MAX, fills[Math.floor(fills.length * 0.25)] ?? 0));
    }
  }
  const byQuestion = new Map<number, OmBubble[]>();
  for (const bubble of bubbles) byQuestion.set(bubble.question, [...(byQuestion.get(bubble.question) ?? []), bubble]);
  for (const [question, cells] of byQuestion) {
    const c = columnOf(question);
    const { marked } = pickMarked(
      cells.map((cell) => ({ option: cell.option, fill: Math.max(0, cell.fill - (baseline.get(`${c}${cell.option}`) ?? 0)) })),
    );
    if (marked.length > 0) {
      answers[String(question)] = ANSWER_OPTIONS.filter((option) =>
        marked.some((cell) => cell.option === option),
      ).join("");
    }
  }

  return {
    answers,
    flags,
    markCount: Object.keys(answers).length,
    bubbles: bubbles.sort((a, b) => a.question - b.question),
    radius: median(radii),
    headerBottom: Math.min(...blocks.map((block) => block.cell.y0)),
    measured: measured != null,
  };
}

type Block = {
  c: number;
  g: number;
  cell: Box;
  ink: number;
  dark: number;
  fit: OptionFit | null;
  xs: number[] | null;
  ys: number[] | null;
};

/** The measured page fractions, used only when the group bands cannot be found. */
function fixedBlocks(img: Gray, search: Box): Block[] {
  const W = img.width;
  const H = img.height;
  const inkThr = paperLevel(img, search) * 0.82;
  const area: Box = {
    x0: Math.round(W * AREA.x0),
    x1: Math.round(W * AREA.x1),
    y0: search.y0,
    y1: search.y1,
  };

  const colEdges = [
    area.x0,
    ...valleys(
      xProfile(img, area, inkThr),
      area.x0,
      COL_SPLITS.map((t) => t * W),
      SPLIT_SEARCH_X * W,
    ),
    area.x1,
  ];

  const blocks: Block[] = [];
  for (let c = 0; c < COLS; c++) {
    const column: Box = { x0: colEdges[c]!, x1: colEdges[c + 1]!, y0: area.y0, y1: area.y1 };
    const groupEdges = [
      area.y0,
      ...valleys(yProfile(img, column, inkThr), area.y0, GROUP_SPLITS.map((t) => t * H), SPLIT_SEARCH_Y * H),
      area.y1,
    ];
    for (let g = 0; g < GROUPS; g++) {
      const cell: Box = { ...column, y0: groupEdges[g]!, y1: groupEdges[g + 1]! };
      const local = paperLevel(img, cell);
      const ink = local * 0.82;
      blocks.push({ c, g, cell, ink, dark: local * 0.55, fit: optionCentres(img, cell, ink), xs: null, ys: null });
    }
  }
  return blocks;
}
