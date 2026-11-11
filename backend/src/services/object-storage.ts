import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const REF_PREFIX = "gcs://";

let client: Storage | null = null;

function storage() {
  if (!env.GCS_BUCKET) return null;
  client ??= new Storage(
    env.GCS_PROJECT_ID
      ? { projectId: env.GCS_PROJECT_ID }
      : undefined,
  );
  return { api: client, bucket: env.GCS_BUCKET };
}

/** True when Cloud Storage is configured for this process. */
export function objectStorageEnabled() {
  return Boolean(env.GCS_BUCKET);
}

function isObjectRef(value: Buffer | Uint8Array | null | undefined): value is Buffer | Uint8Array {
  if (!value || value.length < REF_PREFIX.length || value.length > 1024) return false;
  return Buffer.from(value).subarray(0, REF_PREFIX.length).toString("utf8") === REF_PREFIX;
}

function parseRef(value: Buffer | Uint8Array) {
  const text = Buffer.from(value).toString("utf8");
  if (!text.startsWith(REF_PREFIX)) return null;
  const rest = text.slice(REF_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

function toRef(bucket: string, key: string) {
  return Buffer.from(`${REF_PREFIX}${bucket}/${key}`, "utf8");
}

function safeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9._/-]+/g, "_").replace(/^\/+|\/+$/g, "").slice(0, 180) || "file";
}

/**
 * Persist bytes. With GCS configured, uploads the object and stores a short
 * `gcs://bucket/key` pointer in the Bytes column. Without GCS, returns the raw buffer (Postgres).
 */
export async function putObject(
  folder: string,
  data: Buffer | Uint8Array,
  options: { fileName?: string; contentType?: string; key?: string } = {},
) {
  const gcs = storage();
  const body = Buffer.from(data);
  if (!gcs) return body;

  const name = options.fileName ? safeSegment(options.fileName) : "bin";
  const key = options.key ?? `${safeSegment(folder)}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${name}`;
  await gcs.api.bucket(gcs.bucket).file(key).save(body, {
    resumable: false,
    contentType: options.contentType || "application/octet-stream",
    metadata: { cacheControl: "private, max-age=0" },
  });
  return toRef(gcs.bucket, key);
}

/** Resolve a Bytes column value to the real file (GCS fetch or inlined Postgres bytes). */
export async function getObject(value: Buffer | Uint8Array | null | undefined): Promise<Buffer | null> {
  if (!value) return null;
  const buf = Buffer.from(value);
  if (!isObjectRef(buf)) return buf;

  const ref = parseRef(buf);
  if (!ref) {
    logger.warn("Invalid GCS object pointer in database");
    return null;
  }
  const gcs = storage();
  const api = gcs?.api ?? new Storage();
  const [data] = await api.bucket(ref.bucket).file(ref.key).download();
  return data;
}

/** Drop a previous object when replacing or deleting a row that pointed at GCS. */
export async function deleteObject(value: Buffer | Uint8Array | null | undefined) {
  if (!value || !isObjectRef(value)) return;
  const ref = parseRef(value);
  if (!ref) return;
  try {
    const gcs = storage();
    const api = gcs?.api ?? new Storage();
    await api.bucket(ref.bucket).file(ref.key).delete({ ignoreNotFound: true });
  } catch (error) {
    logger.warn({ err: error }, "Could not delete GCS object");
  }
}

/** Replace stored bytes: delete the old GCS object (if any), then put the new one. */
export async function replaceObject(
  previous: Buffer | Uint8Array | null | undefined,
  folder: string,
  data: Buffer | Uint8Array,
  options: { fileName?: string; contentType?: string } = {},
) {
  const next = await putObject(folder, data, options);
  if (previous && isObjectRef(previous)) {
    const prevRef = parseRef(previous);
    const nextRef = isObjectRef(next) ? parseRef(next) : null;
    if (prevRef && (!nextRef || prevRef.key !== nextRef.key || prevRef.bucket !== nextRef.bucket)) {
      await deleteObject(previous);
    }
  }
  return next;
}
