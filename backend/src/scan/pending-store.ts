import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, link, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { logger } from "../utils/logger.js";

/** Shared temp root for OMR PDF uploads and unsaved sheet images (not the Node heap). */
export const OMR_TMP_ROOT = path.join(tmpdir(), "vitaran-omr");

const UPLOADS = path.join(OMR_TMP_ROOT, "uploads");
const PENDING = path.join(OMR_TMP_ROOT, "pending");
const BATCHES = path.join(OMR_TMP_ROOT, "batches");

export type PendingImageKind = "sheet" | "raw" | "preview";

export async function ensureOmrTempDirs() {
  await Promise.all([mkdir(UPLOADS, { recursive: true }), mkdir(PENDING, { recursive: true }), mkdir(BATCHES, { recursive: true })]);
}

export function omrUploadDir() {
  return UPLOADS;
}

export function newOmrUploadPath(ext = ".pdf") {
  return path.join(UPLOADS, `${randomUUID()}${ext.startsWith(".") ? ext : `.${ext}`}`);
}

export async function writeOmrUpload(bytes: Buffer, ext = ".pdf") {
  await ensureOmrTempDirs();
  const filePath = newOmrUploadPath(ext);
  await writeFile(filePath, bytes);
  return filePath;
}

/** Persist unsaved sheet images so a 500-page PDF does not pin hundreds of JPEGs in RAM. */
export async function storePendingImages(
  previewId: string,
  parts: { sheet: Buffer; raw: Buffer; preview: Buffer; rawSameAsSheet?: boolean },
) {
  await ensureOmrTempDirs();
  const dir = path.join(PENDING, previewId);
  await mkdir(dir, { recursive: true });
  const sheetPath = path.join(dir, "sheet.jpg");
  const rawPath = path.join(dir, "raw.jpg");
  const previewPath = path.join(dir, "preview.jpg");
  await writeFile(sheetPath, parts.sheet);
  if (parts.rawSameAsSheet) {
    try {
      await link(sheetPath, rawPath);
    } catch {
      await copyFile(sheetPath, rawPath);
    }
  } else {
    await writeFile(rawPath, parts.raw);
  }
  await writeFile(previewPath, parts.preview);
  return { dir, sheetBytes: parts.sheet.length };
}

export async function loadPendingImage(dir: string, kind: PendingImageKind) {
  return readFile(path.join(dir, `${kind}.jpg`));
}

export async function replacePendingPreview(dir: string, preview: Buffer) {
  await writeFile(path.join(dir, "preview.jpg"), preview);
}

export async function pendingImageSize(dir: string, kind: PendingImageKind = "sheet") {
  return (await stat(path.join(dir, `${kind}.jpg`))).size;
}

export async function removePendingDir(dir: string | undefined) {
  if (!dir) return;
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

export async function removeOmrPath(filePath: string | undefined | null) {
  if (!filePath) return;
  await rm(filePath, { force: true }).catch(() => undefined);
}

/** Failed PDF page thumbnail on disk (small JPEG). */
export async function storeBatchPageImage(batchId: string, page: number, image: Buffer) {
  await ensureOmrTempDirs();
  const dir = path.join(BATCHES, batchId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `p${page}.jpg`);
  await writeFile(filePath, image);
  return filePath;
}

export async function loadBatchPageImage(filePath: string) {
  return readFile(filePath);
}

export async function removeBatchDir(batchId: string) {
  await rm(path.join(BATCHES, batchId), { recursive: true, force: true }).catch(() => undefined);
}

/** Drop upload/pending files older than maxAgeMs (best-effort; never throws). */
export async function purgeStaleOmrTemp(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    await ensureOmrTempDirs();
    const cutoff = Date.now() - maxAgeMs;
    for (const root of [UPLOADS, PENDING, BATCHES]) {
      const names = await readdir(root).catch(() => [] as string[]);
      for (const name of names) {
        const full = path.join(root, name);
        const info = await stat(full).catch(() => null);
        if (!info || info.mtimeMs > cutoff) continue;
        await rm(full, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  } catch (error) {
    logger.warn({ err: error }, "OMR temp purge failed");
  }
}

export function isOmrTempPath(filePath: string) {
  return filePath.startsWith(OMR_TMP_ROOT) || existsSync(filePath);
}
