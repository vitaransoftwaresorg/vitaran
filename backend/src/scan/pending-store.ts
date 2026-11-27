import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { copyFile, link, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { logger } from "../utils/logger.js";

/**
 * Stable on-disk root so PM2 reload / deploy does not wipe OMR batches.
 * Override with OMR_DATA_DIR on the VPS (e.g. /var/lib/vitaran/omr).
 */
export const OMR_TMP_ROOT = (() => {
  const fromEnv = process.env.OMR_DATA_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  if (process.env.NODE_ENV === "production") {
    return path.join(process.cwd(), "data", "omr");
  }
  // Local dev can keep using OS temp.
  return path.join(tmpdir(), "vitaran-omr");
})();

const UPLOADS = path.join(OMR_TMP_ROOT, "uploads");
const PENDING = path.join(OMR_TMP_ROOT, "pending");
const BATCHES = path.join(OMR_TMP_ROOT, "batches");

export type PendingImageKind = "sheet" | "raw" | "preview";

export async function ensureOmrTempDirs() {
  await Promise.all([
    mkdir(UPLOADS, { recursive: true }),
    mkdir(PENDING, { recursive: true }),
    mkdir(BATCHES, { recursive: true }),
  ]);
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

export async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(value));
  await rename(tmp, filePath).catch(async () => {
    await writeFile(filePath, await readFile(tmp));
    await rm(tmp, { force: true }).catch(() => undefined);
  });
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Sync load for OMR Maps after PM2 reload (hot path must stay sync). */
export function readJsonFileSync<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function batchMetaPath(batchId: string) {
  return path.join(BATCHES, batchId, "meta.json");
}

export function pendingMetaPath(previewId: string) {
  return path.join(PENDING, previewId, "meta.json");
}

export async function listBatchMetaFiles() {
  await ensureOmrTempDirs();
  const names = await readdir(BATCHES).catch(() => [] as string[]);
  return names.map((id) => ({ id, filePath: batchMetaPath(id) }));
}

export async function listPendingMetaFiles() {
  await ensureOmrTempDirs();
  const names = await readdir(PENDING).catch(() => [] as string[]);
  return names.map((id) => ({ id, filePath: pendingMetaPath(id) }));
}

/** Sync dirs + listing so API boot restores batches before the first request. */
export function ensureOmrTempDirsSync() {
  mkdirSync(UPLOADS, { recursive: true });
  mkdirSync(PENDING, { recursive: true });
  mkdirSync(BATCHES, { recursive: true });
}

export function listBatchMetaFilesSync() {
  ensureOmrTempDirsSync();
  try {
    return readdirSync(BATCHES).map((id) => ({ id, filePath: batchMetaPath(id) }));
  } catch {
    return [] as Array<{ id: string; filePath: string }>;
  }
}

export function listPendingMetaFilesSync() {
  ensureOmrTempDirsSync();
  try {
    return readdirSync(PENDING).map((id) => ({ id, filePath: pendingMetaPath(id) }));
  } catch {
    return [] as Array<{ id: string; filePath: string }>;
  }
}

/** Drop upload/pending files older than maxAgeMs (best-effort; never throws). */
export async function purgeStaleOmrTemp(maxAgeMs = 10 * 60 * 60 * 1000) {
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
