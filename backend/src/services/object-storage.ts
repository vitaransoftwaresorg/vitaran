import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const GCS_REF_PREFIX = "gcs://";
const S3_REF_PREFIX = "s3://";

type ObjectRef = { scheme: "gcs" | "s3"; bucket: string; key: string };

let gcsClient: Storage | null = null;
let s3Client: S3Client | null = null;

function gcsConfigured() {
  return Boolean(env.GCS_BUCKET);
}

function s3Configured() {
  return Boolean(
    env.S3_BUCKET &&
      env.S3_ENDPOINT &&
      env.S3_ACCESS_KEY &&
      env.S3_SECRET_KEY,
  );
}

function gcsStorage() {
  if (!env.GCS_BUCKET) return null;
  gcsClient ??= new Storage(
    env.GCS_PROJECT_ID ? { projectId: env.GCS_PROJECT_ID } : undefined,
  );
  return { api: gcsClient, bucket: env.GCS_BUCKET };
}

function s3Storage() {
  if (!s3Configured()) return null;
  s3Client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION || "us-east-1",
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY!,
      secretAccessKey: env.S3_SECRET_KEY!,
    },
  });
  return { api: s3Client, bucket: env.S3_BUCKET! };
}

/** Active object backend: prefer SeaweedFS/S3 on VPS, else GCS, else Postgres bytes. */
export function objectStorageMode(): "s3" | "gcs" | "postgres" {
  if (s3Configured()) return "s3";
  if (gcsConfigured()) return "gcs";
  return "postgres";
}

/** True when object storage (S3 or GCS) is configured for this process. */
export function objectStorageEnabled() {
  return objectStorageMode() !== "postgres";
}

function isObjectRef(
  value: Buffer | Uint8Array | null | undefined,
): value is Buffer | Uint8Array {
  if (!value || value.length < 6 || value.length > 1024) return false;
  const text = Buffer.from(value).subarray(0, 6).toString("utf8");
  return text.startsWith(GCS_REF_PREFIX) || text.startsWith(S3_REF_PREFIX);
}

function parseRef(value: Buffer | Uint8Array): ObjectRef | null {
  const text = Buffer.from(value).toString("utf8");
  const scheme = text.startsWith(S3_REF_PREFIX)
    ? "s3"
    : text.startsWith(GCS_REF_PREFIX)
      ? "gcs"
      : null;
  if (!scheme) return null;
  const prefix = scheme === "s3" ? S3_REF_PREFIX : GCS_REF_PREFIX;
  const rest = text.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  return { scheme, bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

function toRef(scheme: "gcs" | "s3", bucket: string, key: string) {
  const prefix = scheme === "s3" ? S3_REF_PREFIX : GCS_REF_PREFIX;
  return Buffer.from(`${prefix}${bucket}/${key}`, "utf8");
}

function safeSegment(value: string) {
  return (
    value
      .replace(/[^A-Za-z0-9._/-]+/g, "_")
      .replace(/^\/+|\/+$/g, "")
      .slice(0, 180) || "file"
  );
}

async function streamToBuffer(
  body: AsyncIterable<Uint8Array> | ReadableStream | undefined,
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  // AWS SDK v3 may return a web stream or Node async iterable.
  if (Symbol.asyncIterator in Object(body)) {
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/**
 * Persist bytes. With S3/GCS configured, uploads the object and stores a short
 * `s3://` or `gcs://` pointer in the Bytes column. Otherwise returns the raw buffer (Postgres).
 */
export async function putObject(
  folder: string,
  data: Buffer | Uint8Array,
  options: { fileName?: string; contentType?: string; key?: string } = {},
) {
  const body = Buffer.from(data);
  const name = options.fileName ? safeSegment(options.fileName) : "bin";
  const key =
    options.key ??
    `${safeSegment(folder)}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${name}`;
  const contentType = options.contentType || "application/octet-stream";

  const s3 = s3Storage();
  if (s3) {
    await s3.api.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "private, max-age=0",
      }),
    );
    return toRef("s3", s3.bucket, key);
  }

  const gcs = gcsStorage();
  if (!gcs) return body;

  await gcs.api.bucket(gcs.bucket).file(key).save(body, {
    resumable: false,
    contentType,
    metadata: { cacheControl: "private, max-age=0" },
  });
  return toRef("gcs", gcs.bucket, key);
}

/** Resolve a Bytes column value to the real file (S3/GCS fetch or inlined Postgres bytes). */
export async function getObject(
  value: Buffer | Uint8Array | null | undefined,
): Promise<Buffer | null> {
  if (!value) return null;
  const buf = Buffer.from(value);
  if (!isObjectRef(buf)) return buf;

  const ref = parseRef(buf);
  if (!ref) {
    logger.warn("Invalid object pointer in database");
    return null;
  }

  if (ref.scheme === "s3") {
    const s3 = s3Storage()?.api ?? new S3Client({});
    const out = await s3.send(
      new GetObjectCommand({ Bucket: ref.bucket, Key: ref.key }),
    );
    return streamToBuffer(out.Body as AsyncIterable<Uint8Array> | undefined);
  }

  const gcs = gcsStorage();
  const api = gcs?.api ?? new Storage();
  const [data] = await api.bucket(ref.bucket).file(ref.key).download();
  return data;
}

/** Drop a previous object when replacing or deleting a row that pointed at S3/GCS. */
export async function deleteObject(
  value: Buffer | Uint8Array | null | undefined,
) {
  if (!value || !isObjectRef(value)) return;
  const ref = parseRef(value);
  if (!ref) return;
  try {
    if (ref.scheme === "s3") {
      const s3 = s3Storage()?.api ?? new S3Client({});
      await s3.send(
        new DeleteObjectCommand({ Bucket: ref.bucket, Key: ref.key }),
      );
      return;
    }
    const gcs = gcsStorage();
    const api = gcs?.api ?? new Storage();
    await api.bucket(ref.bucket).file(ref.key).delete({ ignoreNotFound: true });
  } catch (error) {
    logger.warn({ err: error }, "Could not delete object storage object");
  }
}

/** Replace stored bytes: delete the old object (if any), then put the new one. */
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
    if (
      prevRef &&
      (!nextRef ||
        prevRef.key !== nextRef.key ||
        prevRef.bucket !== nextRef.bucket ||
        prevRef.scheme !== nextRef.scheme)
    ) {
      await deleteObject(previous);
    }
  }
  return next;
}
