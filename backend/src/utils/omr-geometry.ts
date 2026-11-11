import sharp from "sharp";

export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export type Rgba = { width: number; height: number; data: Buffer };
export type Gray = { width: number; height: number; data: Buffer };

export const CANONICAL_WIDTH = 1000;
export const CANONICAL_HEIGHT = 1414;

export async function asRgba(input: Buffer): Promise<Rgba> {
  const { data, info } = await sharp(input)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

export async function asGray(input: Buffer): Promise<Gray> {
  const { data, info } = await sharp(input).rotate().greyscale().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

export function sampleGray(gray: Gray, x: number, y: number) {
  const sx = Math.max(0, Math.min(gray.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(gray.height - 1, Math.round(y)));
  return gray.data[sy * gray.width + sx] ?? 255;
}

export function fillRatio(gray: Gray, left: number, top: number, right: number, bottom: number, ink = 145) {
  const x0 = Math.max(0, Math.floor(left));
  const y0 = Math.max(0, Math.floor(top));
  const x1 = Math.min(gray.width, Math.ceil(right));
  const y1 = Math.min(gray.height, Math.ceil(bottom));
  if (x1 <= x0 || y1 <= y0) return 0;
  let dark = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * gray.width;
    for (let x = x0; x < x1; x++) {
      total += 1;
      if ((gray.data[row + x] ?? 255) < ink) dark += 1;
    }
  }
  return total ? dark / total : 0;
}

/** Variance of 3×3 Laplacian — blurry frames score low. */
export function sharpness(gray: Gray) {
  const stepX = Math.max(1, Math.floor(gray.width / 160));
  const stepY = Math.max(1, Math.floor(gray.height / 220));
  const values: number[] = [];
  for (let y = 2; y < gray.height - 2; y += stepY) {
    for (let x = 2; x < gray.width - 2; x += stepX) {
      const c = sampleGray(gray, x, y);
      const lap =
        sampleGray(gray, x - 1, y) +
        sampleGray(gray, x + 1, y) +
        sampleGray(gray, x, y - 1) +
        sampleGray(gray, x, y + 1) -
        4 * c;
      values.push(lap);
    }
  }
  if (values.length < 8) return 0;
  const mean = values.reduce((sum, n) => sum + n, 0) / values.length;
  return values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / values.length;
}

function pixelAt(rgba: Rgba, x: number, y: number) {
  const i = (y * rgba.width + x) * 4;
  return {
    r: rgba.data[i] ?? 0,
    g: rgba.data[i + 1] ?? 0,
    b: rgba.data[i + 2] ?? 0,
  };
}

function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const A4 = 1000 / 1414;

function quadFromMask(mask: Uint8Array, w: number, h: number) {
  let count = 0;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDiff = Infinity;
  let maxDiff = -Infinity;
  let tl = { x: 0, y: 0 };
  let tr = { x: w - 1, y: 0 };
  let br = { x: w - 1, y: h - 1 };
  let bl = { x: 0, y: h - 1 };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const sum = x + y;
      const diff = x - y;
      if (sum < minSum) {
        minSum = sum;
        tl = { x, y };
      }
      if (sum > maxSum) {
        maxSum = sum;
        br = { x, y };
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        tr = { x, y };
      }
      if (diff < minDiff) {
        minDiff = diff;
        bl = { x, y };
      }
    }
  }
  if (count < w * h * 0.12) return null;
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);
  const aspect = boxW / boxH;
  const a4err = aspect <= 1 ? Math.abs(aspect - A4) : Math.abs(aspect - 1 / A4);
  const fill = count / (w * h);
  const compact = count / (boxW * boxH);
  const header = minY / h < 0.12 ? 0.28 : minY / h < 0.2 ? 0.1 : -0.2;
  const score =
    (1 - Math.min(1, a4err / 0.28)) * (0.45 + compact * 0.55) * (0.2 + Math.min(fill, 0.8)) + header;
  return { tl, tr, br, bl, count, a4err, score, minY };
}

function largestBlob(light: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(w * h);
  const bestMask = new Uint8Array(w * h);
  let bestCount = 0;
  const stack: number[] = [];
  for (let start = 0; start < light.length; start++) {
    if (!light[start] || seen[start]) continue;
    const mask = new Uint8Array(w * h);
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    mask[start] = 1;
    let count = 0;
    while (stack.length) {
      const i = stack.pop()!;
      count += 1;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || !light[ni]) continue;
        seen[ni] = 1;
        mask[ni] = 1;
        stack.push(ni);
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestMask.set(mask);
    }
  }
  return bestCount ? bestMask : null;
}

/** Whole sheet, including dark print and the red logo. Desk stays out. */
export function findPaperQuad(rgba: Rgba): Quad | null {
  const scale = Math.max(rgba.width, rgba.height) > 900 ? Math.max(rgba.width, rgba.height) / 800 : 1;
  const w = Math.max(8, Math.round(rgba.width / scale));
  const h = Math.max(8, Math.round(rgba.height / scale));
  const lumaMap = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(rgba.height - 1, Math.round(y * scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(rgba.width - 1, Math.round(x * scale));
      const { r, g, b } = pixelAt(rgba, sx, sy);
      lumaMap[y * w + x] = luma(r, g, b);
    }
  }

  let best: ReturnType<typeof quadFromMask> | null = null;
  let loose: ReturnType<typeof quadFromMask> | null = null;
  const light = new Uint8Array(w * h);
  for (const thr of [90, 72, 55, 48]) {
    for (let i = 0; i < lumaMap.length; i++) light[i] = lumaMap[i]! > thr ? 1 : 0;
    const mask = largestBlob(light, w, h);
    if (!mask) continue;
    const next = quadFromMask(mask, w, h);
    if (!next) continue;
    if (!loose || next.score > loose.score) loose = next;
    if (next.a4err > 0.26) continue;
    if (!best || next.score > best.score) best = next;
  }
  best = best ?? loose;
  if (!best) return null;

  const toFull = (p: Point): Point => ({
    x: Math.max(0, Math.min(rgba.width - 1, p.x * scale)),
    y: Math.max(0, Math.min(rgba.height - 1, p.y * scale)),
  });
  return includeHeader(
    [toFull(best.tl), toFull(best.tr), toFull(best.br), toFull(best.bl)],
    rgba.width,
    rgba.height,
  );
}

/** Answer-grid-only crops miss the registration bubbles. Grow the quad up to the printed header. */
function includeHeader(quad: Quad, imgW: number, imgH: number): Quad {
  const [tl, tr, br, bl] = quad;
  const top = (tl.y + tr.y) / 2;
  const bot = (bl.y + br.y) / 2;
  const height = bot - top;
  if (height <= 1 || top <= imgH * 0.1 || height / imgH > 0.78) return quad;
  const up = 0.36 / 0.46;
  const down = 0.18 / 0.46;
  const clamp = (p: Point): Point => ({
    x: Math.max(0, Math.min(imgW - 1, p.x)),
    y: Math.max(0, Math.min(imgH - 1, p.y)),
  });
  return [
    clamp({ x: tl.x - (bl.x - tl.x) * up, y: tl.y - (bl.y - tl.y) * up }),
    clamp({ x: tr.x - (br.x - tr.x) * up, y: tr.y - (br.y - tr.y) * up }),
    clamp({ x: br.x + (br.x - tr.x) * down, y: br.y + (br.y - tr.y) * down }),
    clamp({ x: bl.x + (bl.x - tl.x) * down, y: bl.y + (bl.y - tl.y) * down }),
  ];
}

function solve8(a: number[][], b: number[]) {
  const n = 8;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row;
    }
    const swap = m[col]!;
    m[col] = m[pivot]!;
    m[pivot] = swap;
    const diag = m[col]![col]!;
    if (Math.abs(diag) < 1e-9) throw new Error("Sheet corners are degenerate");
    for (let j = col; j <= n; j++) m[col]![j]! /= diag;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = m[row]![col]!;
      for (let j = col; j <= n; j++) m[row]![j]! -= f * m[col]![j]!;
    }
  }
  return m.map((row) => row[n]!);
}

/** Maps destination rectangle pixels onto the source quad. */
export function destToSrcHomography(src: Quad, destW: number, destH: number) {
  const dest: Quad = [
    { x: 0, y: 0 },
    { x: destW - 1, y: 0 },
    { x: destW - 1, y: destH - 1 },
    { x: 0, y: destH - 1 },
  ];
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: dx, y: dy } = dest[i]!;
    const { x: sx, y: sy } = src[i]!;
    a.push([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]);
    b.push(sx);
    a.push([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]);
    b.push(sy);
  }
  const h = solve8(a, b);
  return [...h, 1];
}

export function applyHomography(h: number[], x: number, y: number): Point {
  const w = h[6]! * x + h[7]! * y + h[8]!;
  return {
    x: (h[0]! * x + h[1]! * y + h[2]!) / w,
    y: (h[3]! * x + h[4]! * y + h[5]!) / w,
  };
}

function sampleBilinear(rgba: Rgba, x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  if (x0 < 0 || y0 < 0 || x1 >= rgba.width || y1 >= rgba.height) return [255, 255, 255, 255];
  const fx = x - x0;
  const fy = y - y0;
  const mix = (c00: number, c10: number, c01: number, c11: number) =>
    c00 * (1 - fx) * (1 - fy) + c10 * fx * (1 - fy) + c01 * (1 - fx) * fy + c11 * fx * fy;
  const at = (px: number, py: number, c: number) => rgba.data[(py * rgba.width + px) * 4 + c] ?? 255;
  return [0, 1, 2, 3].map((c) => mix(at(x0, y0, c), at(x1, y0, c), at(x0, y1, c), at(x1, y1, c)));
}

export async function warpQuad(rgba: Rgba, quad: Quad, width = CANONICAL_WIDTH, height = CANONICAL_HEIGHT) {
  const h = destToSrcHomography(quad, width, height);
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = applyHomography(h, x, y);
      const pix = sampleBilinear(rgba, src.x, src.y);
      const i = (y * width + x) * 4;
      out[i] = pix[0]!;
      out[i + 1] = pix[1]!;
      out[i + 2] = pix[2]!;
      out[i + 3] = pix[3]!;
    }
  }
  const png = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const gray = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(luma(out[i * 4]!, out[i * 4 + 1]!, out[i * 4 + 2]!));
  }
  return { png, gray: { width, height, data: gray } satisfies Gray, rgba: { width, height, data: out } satisfies Rgba };
}

export type Blob = { x: number; y: number; area: number; minX: number; minY: number; maxX: number; maxY: number };

/** The crimson of the printed registration dots and logo; pen fills are blue/black, rings are pale. */
function isRegistrationInk(r: number, g: number, b: number) {
  return r > 50 && r > g * 2.2 + 15 && r > b * 1.25 && g < 90;
}

/** Crimson blobs: the printed registration dots (plus the logo, which callers filter by shape). */
export function findMagentaBlobs(rgba: Rgba, minArea = 18, maxArea = 2200): Blob[] {
  const { width, height, data } = rgba;
  const seen = new Uint8Array(width * height);
  const blobs: Blob[] = [];
  const mag = (i: number) => isRegistrationInk(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (seen[start] || !mag(start)) continue;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        const cx = i % width;
        const cy = (i / width) | 0;
        area += 1;
        sumX += cx;
        sumY += cy;
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
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (seen[ni] || !mag(ni)) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (area >= minArea && area <= maxArea) {
        blobs.push({
          x: sumX / area,
          y: sumY / area,
          area,
          minX,
          minY,
          maxX,
          maxY,
        });
      }
    }
  }
  return blobs.sort((a, b) => b.area - a.area);
}

export function quadQuality(quad: Quad, imageW: number, imageH: number, focus: number) {
  const [tl, tr, br, bl] = quad;
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const top = dist(tl, tr);
  const bottom = dist(bl, br);
  const left = dist(tl, bl);
  const right = dist(tr, br);
  const width = (top + bottom) / 2;
  const height = (left + right) / 2;
  if (width < 40 || height < 40) return { ok: false, reason: "Sheet too small in frame" };
  const aspect = width / height;
  // Full A4 sheet or a 1–100 bubble crop (landscape / square).
  if (aspect < 0.5 || aspect > 1.8) return { ok: false, reason: "Show questions 1–100, edge to edge" };
  const skew = Math.max(Math.abs(top - bottom) / width, Math.abs(left - right) / height);
  if (skew > 0.22) return { ok: false, reason: "Flatten the sheet; too much perspective" };
  const coverage = (width * height) / (imageW * imageH);
  if (coverage < 0.28) return { ok: false, reason: "Move closer until the sheet fills the frame" };
  if (focus < 18) return { ok: false, reason: "Image is blurry; hold still" };
  return { ok: true, reason: "locked", aspect, coverage, skew, focus };
}
