/** sharp — image preprocessing before OpenCV / Tesseract reads the sheet. */
import sharp from "sharp";
import { AppError } from "../utils/app-error.js";
import { warpSheet, type Rgba } from "./detect.js";

export type Gray = { width: number; height: number; data: Buffer };

export async function asGray(image: Buffer): Promise<Gray> {
  const { data, info } = await sharp(image).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

function px(gray: Gray, x: number, y: number) {
  const sx = Math.max(0, Math.min(gray.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(gray.height - 1, Math.round(y)));
  return gray.data[sy * gray.width + sx] ?? 255;
}

/** Bright paper vs darker desk. Rejects blurry or empty frames before recognition. */
export function paperQuality(gray: Gray) {
  let sum = 0;
  let edge = 0;
  const step = 4;
  let count = 0;
  for (let y = 1; y < gray.height - 1; y += step) {
    for (let x = 1; x < gray.width - 1; x += step) {
      const v = px(gray, x, y);
      sum += v;
      edge += Math.abs(v - px(gray, x + 1, y)) + Math.abs(v - px(gray, x, y + 1));
      count += 1;
    }
  }
  const mean = sum / Math.max(1, count);
  const sharpness = edge / Math.max(1, count);
  if (mean < 70) return { ok: false as const, reason: "Too dark. Use even lighting." };
  if (sharpness < 4) return { ok: false as const, reason: "Image is blurry. Hold still until the sheet is sharp." };
  return { ok: true as const, mean, sharpness };
}

export type PreparedSheet = {
  jpeg: Buffer;
  rgba: Rgba;
};

export async function prepareSheet(
  image: Buffer,
  options: { flat?: boolean; corners?: [number, number][] } = {},
): Promise<PreparedSheet> {
  const oriented = await sharp(image).rotate().removeAlpha().toBuffer();
  if (!options.flat) {
    const quality = paperQuality(await asGray(oriented));
    if (!quality.ok) throw new AppError(422, quality.reason);
  }
  const rgba = await warpSheet(oriented, { flat: options.flat, corners: options.corners });
  const jpeg = await sharp(rgba.data, { raw: { width: rgba.width, height: rgba.height, channels: 4 } })
    .removeAlpha()
    .jpeg({ quality: 88 })
    .toBuffer();
  return { jpeg, rgba };
}
