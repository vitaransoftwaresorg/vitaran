/** Point in 0–1 fractions of the frame. Order everywhere: TL, TR, BR, BL. */
export type Corner = { x: number; y: number };
export type SheetQuad = [Corner, Corner, Corner, Corner];

const A4 = 1000 / 1414;
const DETECT_SIDE = 320;
/** Finer pass on the captured photo so corners land within a few pixels. */
export const CAPTURE_DETECT_SIDE = 720;
/** The registration dots need a few pixels each, more than the edge search at DETECT_SIDE gives. */
const DOT_SIDE = 720;
const CAPTURE_DOT_SIDE = 1280;

/**
 * Finds the OMR sheet in a frame: from its printed registration dots when they are visible,
 * else as four straight paper edges around an A4-shaped, lighter region.
 * Returns null rather than guessing a wrong outline.
 */
export function detectSheet(source: CanvasImageSource, width: number, height: number, canvas: HTMLCanvasElement) {
  const dots = dotSheet(source, width, height, canvas, DOT_SIDE);
  if (dots?.complete) return dots.quad;
  return withEdges(dots, edgeSheet(source, width, height, canvas, DETECT_SIDE));
}

/**
 * Without the bottom-left dot the dots only span the top half, and a tilted sheet's foot lands
 * short; the paper edges then give the outline, as long as they hold every dot that was seen.
 */
function withEdges(dots: DotSheet | null, edges: SheetQuad | null) {
  if (!dots) return edges;
  if (edges && dots.seen.every((dot) => insideQuad(edges, dot, 0.015))) return edges;
  return dots.quad;
}

function edgeSheet(
  source: CanvasImageSource,
  width: number,
  height: number,
  canvas: HTMLCanvasElement,
  side: number,
  lenient = false,
) {
  const scale = Math.min(1, side / Math.max(width, height));
  const w = Math.max(8, Math.round(width * scale));
  const h = Math.max(8, Math.round(height * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const luma = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    luma[i] = (data[i * 4]! * 77 + data[i * 4 + 1]! * 150 + data[i * 4 + 2]! * 29) >> 8;
  }
  return edgeQuad(luma, w, h, lenient);
}

/**
 * Sheet outline for a photo the user just took: the registration dots or a strict edge match,
 * else the live outline (all `trusted`), else a lenient match kept only if it holds every printed registration dot, so a
 * wrong guess never cuts the sheet. A lenient outline is good enough to show, not to read from.
 */
export function captureQuad(
  source: CanvasImageSource,
  width: number,
  height: number,
  canvas: HTMLCanvasElement,
  live: SheetQuad | null = null,
) {
  const fit = dotSheet(source, width, height, canvas, CAPTURE_DOT_SIDE);
  const strict = fit?.complete
    ? fit.quad
    : withEdges(fit, edgeSheet(source, width, height, canvas, CAPTURE_DETECT_SIDE));
  if (strict) return { quad: strict, trusted: true };
  if (live) return { quad: live, trusted: true };
  const loose = edgeSheet(source, width, height, canvas, CAPTURE_DETECT_SIDE, true);
  if (!loose) return null;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const dots = registrationDots(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  if (dots.length < 3 || !dots.every((dot) => insideQuad(loose, dot, 0.015))) return null;
  // The dots run from the header to the foot of the sheet; a cluster in one band proves nothing.
  const span = Math.max(...dots.map((d) => d.y)) - Math.min(...dots.map((d) => d.y));
  const quadHeight = (loose[3].y + loose[2].y - loose[0].y - loose[1].y) / 2;
  return span >= quadHeight * 0.6 ? { quad: loose, trusted: false } : null;
}

/** `seen`: the matched dots (frame fractions); `complete`: the bottom-left dot is among them. */
type DotSheet = { quad: SheetQuad; seen: Corner[]; complete: boolean };

function dotSheet(source: CanvasImageSource, width: number, height: number, canvas: HTMLCanvasElement, side: number) {
  const scale = Math.min(1, side / Math.max(width, height));
  const w = Math.max(8, Math.round(width * scale));
  const h = Math.max(8, Math.round(height * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  return dotQuad(registrationDots(ctx.getImageData(0, 0, w, h).data, w, h), w, h);
}

/**
 * Registration dot centres on the printed page, as fractions of the A4 sheet: top-left, top-right,
 * middle-left, middle-right and bottom-left. No dot bottom-right.
 */
const PAGE_DOT = { left: 0.071, right: 0.936, top: 0.06, middle: 0.469, bottom: 0.931 };

type Role = "tl" | "tr" | "ml" | "mr" | "bl";

/** Where each registration dot sits on the page (fractions). */
const ROLE_AT: Record<Role, Corner> = {
  tl: { x: PAGE_DOT.left, y: PAGE_DOT.top },
  tr: { x: PAGE_DOT.right, y: PAGE_DOT.top },
  ml: { x: PAGE_DOT.left, y: PAGE_DOT.middle },
  mr: { x: PAGE_DOT.right, y: PAGE_DOT.middle },
  bl: { x: PAGE_DOT.left, y: PAGE_DOT.bottom },
};
const ROLES = Object.keys(ROLE_AT) as Role[];
/** Any three dots off one line fix the page; only the left column (tl, ml, bl) is a line. */
const ROLE_TRIPLES = ROLES.flatMap((a, i) =>
  ROLES.slice(i + 1).flatMap((b, j) =>
    ROLES.slice(i + j + 2)
      .map((c) => [a, b, c] as [Role, Role, Role])
      .filter((t) => !t.every((role) => role === "tl" || role === "ml" || role === "bl")),
  ),
).map((roles) => {
  // Inverse of the page offsets from the first dot, so three image dots give the affine directly.
  const [p0, p1, p2] = roles.map((role) => ROLE_AT[role]) as [Corner, Corner, Corner];
  const a = p1.x - p0.x, b = p2.x - p0.x, c = p1.y - p0.y, d = p2.y - p0.y;
  const det = a * d - b * c;
  return { roles, origin: p0, inv: [d / det, -b / det, -c / det, a / det] as const };
});
/**
 * Four dots with no three on a line, reaching the bottom-left dot, for a perspective fit. Without
 * it the top half alone would be stretched over the whole page, so a flat fit is steadier.
 */
const PERSPECTIVE_SETS: Role[][] = [
  ["tl", "tr", "mr", "bl"],
  ["tr", "mr", "ml", "bl"],
];
const BR: Corner = { x: PAGE_DOT.right, y: PAGE_DOT.bottom };

type Affine = [number, number, number, number, number, number];

/** Page fractions → image pixels: x = a0·u + a1·v + a2, y = a3·u + a4·v + a5. Least squares over all pairs. */
function fitAffine(page: Corner[], image: Corner[]): Affine | null {
  const n = page.length;
  let suu = 0, suv = 0, svv = 0, su = 0, sv = 0;
  let sxu = 0, sxv = 0, sx = 0, syu = 0, syv = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    const { x: u, y: v } = page[i]!;
    const { x, y } = image[i]!;
    suu += u * u; suv += u * v; svv += v * v; su += u; sv += v;
    sxu += x * u; sxv += x * v; sx += x; syu += y * u; syv += y * v; sy += y;
  }
  const m = [
    [suu, suv, su],
    [suv, svv, sv],
    [su, sv, n],
  ];
  const det =
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
  if (Math.abs(det) < 1e-12) return null;
  const solve = (r0: number, r1: number, r2: number) => {
    const col = (k: number, r: number[]) => m.map((row, i) => row.map((value, j) => (j === k ? r[i]! : value)));
    const d = (q: number[][]) =>
      q[0]![0]! * (q[1]![1]! * q[2]![2]! - q[1]![2]! * q[2]![1]!) -
      q[0]![1]! * (q[1]![0]! * q[2]![2]! - q[1]![2]! * q[2]![0]!) +
      q[0]![2]! * (q[1]![0]! * q[2]![1]! - q[1]![1]! * q[2]![0]!);
    const r = [r0, r1, r2];
    return [d(col(0, r)) / det, d(col(1, r)) / det, d(col(2, r)) / det];
  };
  const [a0, a1, a2] = solve(sxu, sxv, sx);
  const [a3, a4, a5] = solve(syu, syv, sy);
  return [a0!, a1!, a2!, a3!, a4!, a5!];
}

const applyAffine = (a: Affine, p: Corner) => ({ x: a[0] * p.x + a[1] * p.y + a[2], y: a[3] * p.x + a[4] * p.y + a[5] });

/**
 * Page corners from the dots: any three dots that are not all on the left edge fix the page,
 * at least one more dot must land where that predicts, and no dot may sit in the empty
 * bottom-right spot (which keeps the sheet's orientation unambiguous). Works in any rotation and
 * with a dot hidden by glare or a thumb.
 */
function dotQuad(dots: Corner[], w: number, h: number): DotSheet | null {
  if (dots.length < 4 || dots.length > 40) return null;
  const pts = dots.map((d) => ({ x: d.x * w, y: d.y * h }));
  const minSpan = Math.min(w, h) * 0.3;
  let best: { score: number; found: Partial<Record<Role, Corner>> } | null = null;

  for (const { roles, origin, inv } of ROLE_TRIPLES) {
    for (const a of pts) {
      for (const b of pts) {
        if (b === a) continue;
        for (const c of pts) {
          if (c === a || c === b) continue;
          const e1x = b.x - a.x, e2x = c.x - a.x, e1y = b.y - a.y, e2y = c.y - a.y;
          const m0 = e1x * inv[0] + e2x * inv[2], m1 = e1x * inv[1] + e2x * inv[3];
          const m3 = e1y * inv[0] + e2y * inv[2], m4 = e1y * inv[1] + e2y * inv[3];
          const map: Affine = [m0, m1, a.x - m0 * origin.x - m1 * origin.y, m3, m4, a.y - m3 * origin.x - m4 * origin.y];
          // Page width and height in the image; an A4 page is 1 : 1.414.
          const ux = map[0], uy = map[3];
          const vx = map[1], vy = map[4];
          const lu = Math.hypot(ux, uy);
          const lv = Math.hypot(vx, vy);
          const tall = lv * (PAGE_DOT.bottom - PAGE_DOT.top);
          if (tall < minSpan || ux * vy - uy * vx <= 0) continue;
          if (Math.abs((ux * vx + uy * vy) / (lu * lv)) > 0.25) continue;
          const ratio = (lu / lv) * 1.414;
          if (ratio < 0.7 || ratio > 1.22) continue;

          const near = (target: Corner, tol: number) => {
            let hit: Corner | null = null;
            let gap = tol;
            for (const q of pts) {
              const d = Math.hypot(q.x - target.x, q.y - target.y);
              if (d < gap) [hit, gap] = [q, d];
            }
            return hit;
          };
          if (near(applyAffine(map, BR), tall * 0.07)) continue;
          const found: Partial<Record<Role, Corner>> = {};
          roles.forEach((role, i) => (found[role] = [a, b, c][i]));
          let extra = 0;
          for (const role of ROLES) {
            if (found[role]) continue;
            // Perspective moves the other dots off the flat prediction; nothing else prints near them.
            const hit = near(applyAffine(map, ROLE_AT[role]), tall * 0.12);
            if (hit && hit !== a && hit !== b && hit !== c) {
              found[role] = hit;
              extra += 1;
            }
          }
          if (extra === 0) continue;
          // Without the bottom-left dot the other four look the same upside down; sheets are
          // photographed roughly upright, so that breaks the tie (never outweighs a matched dot).
          const upright = vy / lv;
          const score = extra + 0.4 * upright + (0.5 * lu * lv) / (w * h);
          if (!best || score > best.score) best = { score, found };
        }
      }
    }
  }
  if (!best) return null;

  const { found } = best;
  const pageCorners = [0, 1, 2, 3].map((i) => ({ x: i === 1 || i === 2 ? 1 : 0, y: i >= 2 ? 1 : 0 }));
  const set = PERSPECTIVE_SETS.find((roles) => roles.every((role) => found[role]));
  const homography = set
    ? solveHomography(
        set.map((role) => ROLE_AT[role]),
        set.map((role) => found[role]!),
      )
    : null;
  const seen = ROLES.filter((role) => found[role]);
  const affine = homography
    ? null
    : fitAffine(
        seen.map((role) => ROLE_AT[role]),
        seen.map((role) => found[role]!),
      );
  if (!homography && !affine) return null;
  const corners = pageCorners.map((p) => {
    if (!homography) return applyAffine(affine!, p);
    const d = homography[6]! * p.x + homography[7]! * p.y + 1;
    return {
      x: (homography[0]! * p.x + homography[1]! * p.y + homography[2]!) / d,
      y: (homography[3]! * p.x + homography[4]! * p.y + homography[5]!) / d,
    };
  });
  const quad = corners.map((p) => ({ x: clamp01(p.x / w), y: clamp01(p.y / h) })) as SheetQuad;
  if (quadArea(quad) <= 0.15) return null;
  return { quad, seen: seen.map((role) => ({ x: found[role]!.x / w, y: found[role]!.y / h })), complete: Boolean(found.bl) };
}

/** The crimson of the printed registration dots, also dim or warm-lit; pen fills are blue/black, rings are pale. */
const isRegistrationInk = (r: number, g: number, b: number) =>
  r > 45 && r - g >= 30 && r > g * 1.7 && r > b * 1.25 && g < 110;

/** Centres (0–1) of the round crimson dots printed near the sheet's edges. */
function registrationDots(data: Uint8ClampedArray, w: number, h: number) {
  // From a sheet at 40% of the frame width up to one overfilling it.
  const minArea = Math.max(6, w * w * 2.5e-5);
  const maxArea = Math.max(60, w * w * 7e-4);
  const seen = new Uint8Array(w * h);
  const dots: Corner[] = [];
  const ink = (i: number) => isRegistrationInk(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!);
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !ink(start)) continue;
    let area = 0, sumX = 0, sumY = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i / w) | 0;
      area += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const n of [i - 1, i + 1, i - w, i + w]) {
        if (n < 0 || n >= w * h || seen[n] || (n % w !== x && Math.abs((n % w) - x) > 1) || !ink(n)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    // Blur and perspective squash the dots into ellipses.
    const round = Math.abs(bw - bh) <= Math.max(2, Math.max(bw, bh) * 0.45) && area > bw * bh * 0.55;
    if (round && area >= minArea && area <= maxArea) dots.push({ x: sumX / area / w, y: sumY / area / h });
  }
  return dots;
}

/** Point inside a convex quad grown by `margin` (frame fractions). */
function insideQuad(quad: SheetQuad, point: Corner, margin: number) {
  const cx = quad.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = quad.reduce((sum, p) => sum + p.y, 0) / 4;
  const grown = quad.map((p) => {
    const d = Math.hypot(p.x - cx, p.y - cy) || 1;
    return { x: p.x + ((p.x - cx) / d) * margin, y: p.y + ((p.y - cy) / d) * margin };
  });
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = grown[i]!;
    const b = grown[(i + 1) % 4]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

type Line = { theta: number; rho: number; votes: number };

const THETA_STEPS = 180;
const COS = Float32Array.from({ length: THETA_STEPS }, (_, t) => Math.cos((t * Math.PI) / THETA_STEPS));
const SIN = Float32Array.from({ length: THETA_STEPS }, (_, t) => Math.sin((t * Math.PI) / THETA_STEPS));

/**
 * Paper edges as straight lines: Hough transform on gradient-oriented edge pixels, then the
 * top/bottom/left/right combination whose sides are best backed by real edges and look like A4.
 */
/**
 * `lenient` is for a photo the user chose to take: a white sheet on a light table has little
 * contrast and partly hidden edges, so weaker sides and a lower score still count.
 */
function edgeQuad(luma: Uint8Array, w: number, h: number, lenient = false): SheetQuad | null {
  // 3×3 box blur keeps print texture from swamping the paper outline.
  const blur = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const row = (y + dy) * w + x;
        sum += luma[row - 1]! + luma[row]! + luma[row + 1]!;
      }
      blur[y * w + x] = sum / 9;
    }
  }

  const mag = new Float32Array(w * h);
  const angle = new Int16Array(w * h).fill(-1);
  let strong = 0;
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const gx =
        blur[i - w + 1]! + 2 * blur[i + 1]! + blur[i + w + 1]! - blur[i - w - 1]! - 2 * blur[i - 1]! - blur[i + w - 1]!;
      const gy =
        blur[i + w - 1]! + 2 * blur[i + w]! + blur[i + w + 1]! - blur[i - w - 1]! - 2 * blur[i - w]! - blur[i - w + 1]!;
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      if (m < 32) continue;
      let t = Math.round((Math.atan2(gy, gx) * THETA_STEPS) / Math.PI);
      if (t < 0) t += THETA_STEPS;
      angle[i] = t % THETA_STEPS;
      if (m >= 40) strong += 1;
    }
  }
  if (strong < (w + h) * (lenient ? 0.4 : 0.8)) return null;

  const diag = Math.ceil(Math.hypot(w, h));
  const rhoSize = diag * 2 + 1;
  const acc = new Float32Array(THETA_STEPS * rhoSize);
  for (let i = 0; i < w * h; i++) {
    const t0 = angle[i]!;
    if (t0 < 0 || mag[i]! < 40) continue;
    const x = i % w;
    const y = (i / w) | 0;
    for (let dt = -3; dt <= 3; dt++) {
      const t = (t0 + dt + THETA_STEPS) % THETA_STEPS;
      const rho = Math.round(x * COS[t]! + y * SIN[t]!) + diag;
      acc[t * rhoSize + rho]! += 1;
    }
  }

  const peaks: Line[] = [];
  const minVotes = Math.min(w, h) * (lenient ? 0.22 : 0.35);
  for (let t = 0; t < THETA_STEPS; t++) {
    for (let r = 0; r < rhoSize; r++) {
      const votes = acc[t * rhoSize + r]!;
      if (votes < minVotes) continue;
      let isPeak = true;
      for (let dt = -4; dt <= 4 && isPeak; dt++) {
        const tt = (t + dt + THETA_STEPS) % THETA_STEPS;
        const wrap = t + dt < 0 || t + dt >= THETA_STEPS;
        for (let dr = -6; dr <= 6; dr++) {
          const rr = wrap ? rhoSize - 1 - (r + dr) : r + dr;
          if (rr < 0 || rr >= rhoSize || (dt === 0 && dr === 0)) continue;
          const other = acc[tt * rhoSize + rr]!;
          if (other > votes || (other === votes && (dt < 0 || (dt === 0 && dr < 0)))) {
            isPeak = false;
            break;
          }
        }
      }
      if (isPeak) peaks.push({ theta: t, rho: r - diag, votes });
    }
  }
  peaks.sort((a, b) => b.votes - a.votes);

  // Normal near 90° → horizontal line; near 0/180° → vertical line.
  const horizontal: Array<Line & { at: number }> = [];
  const vertical: Array<Line & { at: number }> = [];
  for (const line of peaks.slice(0, 60)) {
    const deg = line.theta;
    if (deg > 63 && deg < 117) {
      horizontal.push({ ...line, at: (line.rho - (w / 2) * COS[line.theta]!) / SIN[line.theta]! });
    } else if (deg < 27 || deg > 153) {
      vertical.push({ ...line, at: (line.rho - (h / 2) * SIN[line.theta]!) / COS[line.theta]! });
    }
  }
  const tops = horizontal.filter((l) => l.at < h * 0.55).slice(0, 10);
  const bottoms = horizontal.filter((l) => l.at > h * 0.45).slice(0, 10);
  const lefts = vertical.filter((l) => l.at < w * 0.55).slice(0, 10);
  const rights = vertical.filter((l) => l.at > w * 0.45).slice(0, 10);
  if (lenient) {
    // A sheet that runs off the photo is bounded by the frame there.
    const across = THETA_STEPS / 2;
    tops.push({ theta: across, rho: 0, votes: 0, at: 0 });
    bottoms.push({ theta: across, rho: h - 1, votes: 0, at: h - 1 });
    lefts.push({ theta: 0, rho: 0, votes: 0, at: 0 });
    rights.push({ theta: 0, rho: w - 1, votes: 0, at: w - 1 });
  }

  const lumaAt = (x: number, y: number) =>
    x < 0 || y < 0 || x > w - 1 || y > h - 1 ? -1 : blur[Math.round(y) * w + Math.round(x)]!;

  /** Share of the side backed by an edge running along it, and how much brighter the inside is. */
  const support = (a: { x: number; y: number }, b: { x: number; y: number }, center: { x: number; y: number }) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(8, Math.round(length / 3));
    let normal = Math.round((Math.atan2(b.x - a.x, -(b.y - a.y)) * THETA_STEPS) / Math.PI);
    normal = ((normal % THETA_STEPS) + THETA_STEPS) % THETA_STEPS;
    let nx = -(b.y - a.y) / length;
    let ny = (b.x - a.x) / length;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if ((center.x - mid.x) * nx + (center.y - mid.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    let hit = 0;
    let total = 0;
    let inside = 0;
    let outside = 0;
    let pairs = 0;
    for (let s = 0; s <= steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps;
      const y = a.y + ((b.y - a.y) * s) / steps;
      if (x < 2 || y < 2 || x > w - 3 || y > h - 3) continue;
      total += 1;
      let matched = false;
      for (let dy = -1; dy <= 1 && !matched; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = Math.round(y + dy) * w + Math.round(x + dx);
          const t = angle[i]!;
          if (t < 0) continue;
          const diff = Math.abs(t - normal) % THETA_STEPS;
          if (Math.min(diff, THETA_STEPS - diff) <= 14) {
            matched = true;
            break;
          }
        }
      }
      if (matched) hit += 1;
      const lin = lumaAt(x + nx * 4, y + ny * 4);
      const lout = lumaAt(x - nx * 4, y - ny * 4);
      if (lin >= 0 && lout >= 0) {
        inside += lin;
        outside += lout;
        pairs += 1;
      }
    }
    // Sides that run off the frame can't be checked; count them as weak.
    const edge = total < steps * 0.5 ? 0.3 : hit / total;
    const contrast = pairs ? (inside - outside) / pairs : 0;
    return { edge, contrast };
  };

  let best: { quad: SheetQuad; score: number } | null = null;
  for (const top of tops) {
    for (const bottom of bottoms) {
      if (bottom.at - top.at < h * 0.3 || angleGap(top.theta, bottom.theta) > 16) continue;
      for (const left of lefts) {
        for (const right of rights) {
          if (right.at - left.at < w * 0.3 || angleGap(left.theta, right.theta) > 16) continue;
          const tl = intersect(top, left);
          const tr = intersect(top, right);
          const br = intersect(bottom, right);
          const bl = intersect(bottom, left);
          if (!tl || !tr || !br || !bl) continue;
          const corners = [tl, tr, br, bl];
          if (corners.some((p) => p.x < -w * 0.04 || p.y < -h * 0.04 || p.x > w * 1.04 || p.y > h * 1.04)) continue;
          if (!convex(corners)) continue;
          const quad = corners.map((p) => ({ x: clamp01(p.x / (w - 1)), y: clamp01(p.y / (h - 1)) })) as SheetQuad;
          const area = quadArea(quad);
          if (area < 0.18) continue;
          const sideW = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2;
          const sideH = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2;
          const aspect = sideW / Math.max(1, sideH);
          const a4err = Math.abs(aspect - A4);
          if (a4err > 0.3) continue;
          const center = { x: (tl.x + tr.x + br.x + bl.x) / 4, y: (tl.y + tr.y + br.y + bl.y) / 4 };
          const sides: Array<ReturnType<typeof support>> = [];
          for (const [a, b] of [
            [tl, tr],
            [tr, br],
            [br, bl],
            [bl, tl],
          ] as const) {
            const side = support(a, b, center);
            if (side.edge < (lenient ? 0.2 : 0.35) || side.contrast < (lenient ? -14 : -6)) break;
            sides.push(side);
          }
          if (sides.length < 4) continue;
          // Paper is lighter than whatever it lies on.
          const contrast = sides.reduce((sum, side) => sum + side.contrast, 0) / 4;
          if (contrast < (lenient ? -2 : 4)) continue;
          const edge = sides.reduce((sum, side) => sum + side.edge, 0) / 4;
          const score =
            edge * 0.8 + Math.min(area, 0.85) * 0.25 + (1 - a4err / 0.3) * 0.25 + Math.min(contrast, 40) / 200;
          if (!best || score > best.score) best = { quad, score };
        }
      }
    }
  }
  return best && best.score > (lenient ? 0.5 : 0.7) ? best.quad : null;
}

function intersect(a: Line, b: Line) {
  const det = COS[a.theta]! * SIN[b.theta]! - SIN[a.theta]! * COS[b.theta]!;
  if (Math.abs(det) < 1e-6) return null;
  return {
    x: (a.rho * SIN[b.theta]! - b.rho * SIN[a.theta]!) / det,
    y: (b.rho * COS[a.theta]! - a.rho * COS[b.theta]!) / det,
  };
}

function convex(points: Array<{ x: number; y: number }>) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % 4]!;
    const c = points[(i + 2) % 4]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    if (!sign) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** Degrees between two line normals, ignoring direction. */
function angleGap(a: number, b: number) {
  const diff = Math.abs(a - b) % THETA_STEPS;
  return Math.min(diff, THETA_STEPS - diff);
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Average corner movement between two quads, in frame fractions. */
export function quadDistance(a: SheetQuad, b: SheetQuad) {
  return a.reduce((sum, p, i) => sum + Math.hypot(p.x - b[i]!.x, p.y - b[i]!.y), 0) / 4;
}

export function blendQuad(prev: SheetQuad, next: SheetQuad, amount: number): SheetQuad {
  return prev.map((p, i) => ({
    x: p.x + (next[i]!.x - p.x) * amount,
    y: p.y + (next[i]!.y - p.y) * amount,
  })) as SheetQuad;
}

/** Shoelace area, as a fraction of the frame. */
export function quadArea(quad: SheetQuad) {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** A small inset rectangle, for when nothing was detected. */
export const DEFAULT_QUAD: SheetQuad = [
  { x: 0.08, y: 0.06 },
  { x: 0.92, y: 0.06 },
  { x: 0.92, y: 0.94 },
  { x: 0.08, y: 0.94 },
];

/** The whole image: tells the server a scanned page is already cropped, so it must not re-detect paper. */
export const FULL_PAGE_QUAD: SheetQuad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

type Pixels = { data: Uint8ClampedArray; width: number; height: number };

function homography(quad: SheetQuad, srcW: number, srcH: number, outW: number, outH: number) {
  const src = quad.map((p) => ({ x: p.x * (srcW - 1), y: p.y * (srcH - 1) }));
  const dest = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];
  return solveHomography(dest, src);
}

/** Coefficients mapping each `from` point onto its `to` point: x' = (h0x + h1y + h2) / (h6x + h7y + 1). */
function solveHomography(from: Corner[], to: Corner[]) {
  const m: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x: dx, y: dy } = from[i]!;
    const { x: sx, y: sy } = to[i]!;
    m.push([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy, sx]);
    m.push([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy, sy]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const diag = m[col]![col]!;
    if (Math.abs(diag) < 1e-9) return null;
    for (let j = col; j <= 8; j++) m[col]![j]! /= diag;
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const f = m[row]![col]!;
      for (let j = col; j <= 8; j++) m[row]![j]! -= f * m[col]![j]!;
    }
  }
  return m.map((row) => row[8]!);
}

/** Flattens the quad of `source` into an `outW × outH` RGBA page (white outside the photo). */
export function warpPixels(source: Pixels, quad: SheetQuad, outW: number, outH: number, smooth = false) {
  const out = new Uint8ClampedArray(outW * outH * 4);
  const h = homography(quad, source.width, source.height, outW, outH);
  if (!h) return null;
  const { data, width, height } = source;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const d = h[6]! * x + h[7]! * y + 1;
      const fx = (h[0]! * x + h[1]! * y + h[2]!) / d;
      const fy = (h[3]! * x + h[4]! * y + h[5]!) / d;
      const o = (y * outW + x) * 4;
      out[o + 3] = 255;
      if (fx < 0 || fy < 0 || fx > width - 1 || fy > height - 1) {
        out[o] = out[o + 1] = out[o + 2] = 255;
        continue;
      }
      if (!smooth) {
        const s = (Math.round(fy) * width + Math.round(fx)) * 4;
        out[o] = data[s]!;
        out[o + 1] = data[s + 1]!;
        out[o + 2] = data[s + 2]!;
        continue;
      }
      const x0 = Math.min(width - 2, Math.floor(fx));
      const y0 = Math.min(height - 2, Math.floor(fy));
      const ax = fx - x0;
      const ay = fy - y0;
      const s00 = (y0 * width + x0) * 4;
      const s10 = s00 + 4;
      const s01 = s00 + width * 4;
      const s11 = s01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = data[s00 + c]! + (data[s10 + c]! - data[s00 + c]!) * ax;
        const bottom = data[s01 + c]! + (data[s11 + c]! - data[s01 + c]!) * ax;
        out[o + c] = top + (bottom - top) * ay;
      }
    }
  }
  return out;
}

/**
 * Scanner "colour" look: stretches each channel so the paper reads white (cancels the warm cast
 * of indoor light) while keeping ink hues, which the registration reader needs.
 */
/** Straight-on phone photos stay within ~11° per corner and ~0.78 side ratio (edge-clipped sheets). */
const MAX_CORNER_SKEW_DEG = 18;
const MIN_SIDE_RATIO = 0.7;

/** True when the sheet outline is too far from a rectangle: the photo was taken at a steep angle. */
export function tooAngled(quad: SheetQuad, width: number, height: number) {
  const pts = quad.map((p) => ({ x: p.x * width, y: p.y * height }));
  const len = (a: Corner, b: Corner) => Math.hypot(a.x - b.x, a.y - b.y);
  const [tl, tr, br, bl] = pts as [Corner, Corner, Corner, Corner];
  const ratio = (a: number, b: number) => Math.min(a, b) / Math.max(a, b || 1);
  if (ratio(len(tl, tr), len(bl, br)) < MIN_SIDE_RATIO) return true;
  if (ratio(len(tl, bl), len(tr, br)) < MIN_SIDE_RATIO) return true;
  return pts.some((p, i) => {
    const a = pts[(i + 3) % 4]!;
    const b = pts[(i + 1) % 4]!;
    const cos = ((a.x - p.x) * (b.x - p.x) + (a.y - p.y) * (b.y - p.y)) / (len(a, p) * len(b, p) || 1);
    return Math.abs(90 - (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI) > MAX_CORNER_SKEW_DEG;
  });
}

/** How far the sheet's centre may sit from the frame centre, as a fraction of the frame. */
const MAX_CENTER_OFFSET = 0.12;

/** True when the phone is not held roughly over the middle of the sheet (a little off is fine). */
export function offCenter(quad: SheetQuad) {
  const cx = quad.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = quad.reduce((sum, p) => sum + p.y, 0) / 4;
  return Math.abs(cx - 0.5) > MAX_CENTER_OFFSET || Math.abs(cy - 0.5) > MAX_CENTER_OFFSET;
}

/** Sheets wider than this many pixels are measured pooled down, so detail has a similar scale. */
const SHARP_SHEET_W = 1000;
/** Below this the photo is too blurry to accept; sharp phone photos score about 15–26. */
export const MIN_SHARPNESS = 12;

/**
 * How crisp the printed detail on the sheet is, independent of lighting and contrast: fine-scale
 * edge energy over coarse-scale edge energy in the middle of the sheet. Focus or shake blur
 * removes the fine scale first, so the ratio drops. Read straight from the photo (no warp), so a
 * slightly wrong crop cannot stretch the page and look like blur.
 */
export function sheetSharpness(source: Pixels, quad: SheetQuad) {
  const xs = quad.map((p) => p.x * source.width);
  const ys = quad.map((p) => p.y * source.height);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.max(1, Math.round((x1 - x0) / SHARP_SHEET_W));
  const left = Math.max(0, Math.round(x0 + (x1 - x0) * 0.15));
  const top = Math.max(0, Math.round(y0 + (y1 - y0) * 0.15));
  const w = Math.floor((Math.min(source.width, Math.round(x1 - (x1 - x0) * 0.15)) - left) / k);
  const h = Math.floor((Math.min(source.height, Math.round(y1 - (y1 - y0) * 0.15)) - top) / k);
  if (w < 64 || h < 64) return 0;
  const { data } = source;
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const s = ((top + y * k + dy) * source.width + left + x * k + dx) * 4;
          sum += data[s]! * 0.299 + data[s + 1]! * 0.587 + data[s + 2]! * 0.114;
        }
      }
      gray[y * w + x] = sum / (k * k);
    }
  }
  const coarse = boxBlur(boxBlur(gray, w, h, 2), w, h, 2);
  let fine = 0;
  let wide = 0;
  for (let y = 4; y < h - 4; y++) {
    for (let x = 4; x < w - 4; x++) {
      const i = y * w + x;
      fine += (gray[i + 1]! - gray[i]!) ** 2 + (gray[i + w]! - gray[i]!) ** 2;
      wide += (coarse[i + 1]! - coarse[i]!) ** 2 + (coarse[i + w]! - coarse[i]!) ** 2;
    }
  }
  return wide > 0 ? fine / wide : 0;
}

function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / n;
      sum += src[y * w + Math.min(w - 1, x + r + 1)]! - src[y * w + Math.max(0, x - r)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / n;
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
    }
  }
  return out;
}

export function enhanceScan(pixels: Uint8ClampedArray) {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < pixels.length; i += 4) {
    hist[0]![pixels[i]!]!++;
    hist[1]![pixels[i + 1]!]!++;
    hist[2]![pixels[i + 2]!]!++;
  }
  const target = (pixels.length / 4) * 0.1;
  const gains = hist.map((h) => {
    let count = 0;
    for (let v = 255; v > 0; v--) {
      count += h[v]!;
      if (count >= target) return Math.min(2, 248 / Math.max(v, 64));
    }
    return 1;
  });
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i]! * gains[0]!;
    pixels[i + 1] = pixels[i + 1]! * gains[1]!;
    pixels[i + 2] = pixels[i + 2]! * gains[2]!;
  }
}
