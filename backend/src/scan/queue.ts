import { Queue, QueueEvents, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";
import { readSheet, type SheetIdentity, type SheetRead } from "./read-sheet.js";
import type { ExtractedSheet } from "./schema.js";

const QUEUE_NAME = "omr-scan";

type ReadJob = { image: string; fileName: string; rollNo?: string; testId?: string };
type ReadOk = { ok: true; jpeg: string; sheet: ExtractedSheet };
type ReadFail = { ok: false; statusCode: number; message: string };
type ReadResult = ReadOk | ReadFail;

let redis: Redis | null = null;
let queue: Queue<ReadJob, ReadResult> | null = null;
let events: QueueEvents | null = null;
let worker: Worker<ReadJob, ReadResult> | null = null;

function connection() {
  if (!env.REDIS_URL) return null;
  if (redis) return redis;
  redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redis.on("error", (error: Error) => {
    logger.warn({ err: error }, "OMR Redis connection error");
  });
  return redis;
}

async function processRead(image: Buffer, fileName: string, identity?: SheetIdentity): Promise<ReadResult> {
  try {
    const read = await readSheet(image, identity);
    return { ok: true, jpeg: read.jpeg.toString("base64"), sheet: withoutJpeg(read) };
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn({ fileName, statusCode: error.statusCode }, error.message);
      return { ok: false, statusCode: error.statusCode, message: error.message };
    }
    throw error;
  }
}

function withoutJpeg(read: SheetRead): ExtractedSheet {
  return {
    rollNo: read.rollNo,
    rollCandidates: read.rollCandidates,
    printedName: read.printedName,
    testId: read.testId,
    testCandidates: read.testCandidates,
    examDate: read.examDate,
    answers: read.answers,
    flags: read.flags,
    markCount: read.markCount,
    confidence: read.confidence,
  };
}

function toSheetRead(result: ReadOk): SheetRead {
  return { ...result.sheet, jpeg: Buffer.from(result.jpeg, "base64") };
}

async function onJob(job: Job<ReadJob, ReadResult>) {
  return processRead(Buffer.from(job.data.image, "base64"), job.data.fileName, {
    rollNo: job.data.rollNo,
    testId: job.data.testId,
  });
}

export function startScanWorker() {
  const conn = connection();
  if (!conn || worker) return;
  queue = new Queue<ReadJob, ReadResult>(QUEUE_NAME, { connection: conn });
  events = new QueueEvents(QUEUE_NAME, { connection: conn.duplicate() });
  worker = new Worker<ReadJob, ReadResult>(QUEUE_NAME, onJob, { connection: conn, concurrency: 1 });
  worker.on("failed", (job, error) => {
    logger.warn({ jobId: job?.id, err: error }, "OMR job failed");
  });
}

export async function stopScanWorker() {
  await worker?.close();
  await events?.close();
  await queue?.close();
  worker = null;
  events = null;
  queue = null;
  if (redis) {
    await redis.quit().catch(() => undefined);
    redis = null;
  }
}

/** Live capture waits for the job. Many laptop uploads share this queue. */
export async function readQueued(image: Buffer, fileName: string, identity?: SheetIdentity): Promise<SheetRead> {
  const conn = connection();
  if (!conn || !queue || !events) {
    const result = await processRead(image, fileName, identity);
    if (!result.ok) throw new AppError(result.statusCode, result.message);
    return toSheetRead(result);
  }
  const job = await queue.add(
    "read",
    { image: image.toString("base64"), fileName, rollNo: identity?.rollNo, testId: identity?.testId },
    { removeOnComplete: 40, removeOnFail: 40 },
  );
  const result = (await job.waitUntilFinished(events)) as ReadResult;
  if (!result.ok) throw new AppError(result.statusCode, result.message);
  return toSheetRead(result);
}
