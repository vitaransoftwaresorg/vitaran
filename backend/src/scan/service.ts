import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { SchoolType } from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import * as programRepository from "../repositories/program.repository.js";
import * as studentRepository from "../repositories/student.repository.js";
import { recordOmrResult } from "../services/result.service.js";
import { AppError } from "../utils/app-error.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { downloadFileName } from "../utils/download-file-name.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { asAnswers, asKeyTypeRanges } from "../utils/answer-key-parse.js";
import { logger } from "../utils/logger.js";
import { displaySectionName } from "../utils/section-label.js";
import { omrPdfPageCount, openOmrPdf } from "./pdf-pages.js";
import {
  loadBatchPageImage,
  loadPendingImage,
  purgeStaleOmrTemp,
  removeBatchDir,
  removeOmrPath,
  removePendingDir,
  replacePendingPreview,
  storeBatchPageImage,
  storePendingImages,
} from "./pending-store.js";
import { readQueued } from "./queue.js";
import type { BubbleMap } from "./detect.js";
import { markedSheetPreview } from "./marked-preview.js";
import {
  isPlausibleRoll,
  pickRollNo,
  pickTestId,
  type SheetCorners,
  type SheetRead,
} from "./read-sheet.js";
import { getObject, putObject } from "../services/object-storage.js";
import { evaluatedImage, scoringFingerprint } from "./regrade.js";
import * as scanRepository from "./repository.js";
import { scoreSheet, sheetFlags, type SheetScore } from "./score.js";

void purgeStaleOmrTemp();

/** Dev only: keep uploads so detection can be tuned against real sheets. */
async function keepSample(bytes: Buffer, fileName: string) {
  if (process.env.NODE_ENV === "production") return;
  try {
    const dir = path.resolve(".omr-samples");
    await mkdir(dir, { recursive: true });
    const safe = fileName.replace(/[^\w.-]+/g, "_").slice(-80) || "sheet";
    await writeFile(path.join(dir, `${Date.now()}-${safe}`), bytes);
  } catch {
    // Sampling must never break a scan.
  }
}

const IMAGE_MAX = 8 * 1024 * 1024;
const PDF_MAX = 500 * 1024 * 1024;
const PREVIEW_TTL_MS = 30 * 60 * 1000;
/** Idle TTL from the last finished page (refreshed as each page completes). */
const PDF_BATCH_TTL_MS = 30 * 60 * 1000;

type PdfBatchItem = {
  page: number;
  previewId?: string;
  error?: string;
  /** Same registration number as an earlier page in this PDF; that page is kept. */
  duplicateOf?: number;
  /** Failed pages keep a small on-disk JPEG so the examiner can see why. */
  imagePath?: string;
};

type PdfBatch = {
  id: string;
  owner: string;
  createdAt: number;
  expires: number;
  /** On-disk PDF path — kept only while pages are still being read. */
  pdfPath: string | null;
  fileName: string;
  pageCount: number;
  /** Forced test ID for every page — never OCR the header for this. */
  testId: string;
  items: PdfBatchItem[];
  finished: boolean;
  cancelled: boolean;
};

const pdfBatches = new Map<string, PdfBatch>();

function purgeExpiredPdfBatches() {
  const now = Date.now();
  for (const [id, batch] of pdfBatches) {
    if (batch.expires >= now) continue;
    batch.cancelled = true;
    void dropBatchFiles(batch);
    pdfBatches.delete(id);
  }
  for (const [previewId, row] of pending) {
    if (row.expires >= now) continue;
    void removePendingDir(row.diskDir);
    pending.delete(previewId);
  }
}

function dropBatchPreviews(batch: PdfBatch) {
  for (const item of batch.items) {
    if (!item.previewId) continue;
    const row = pending.get(item.previewId);
    if (row) void removePendingDir(row.diskDir);
    pending.delete(item.previewId);
  }
}

async function dropBatchFiles(batch: PdfBatch) {
  dropBatchPreviews(batch);
  await removeOmrPath(batch.pdfPath);
  batch.pdfPath = null;
  await removeBatchDir(batch.id);
}

/** Batches belong to the session that uploaded them (one school, one teacher, or admin). */
function ownerOf(context: ScanContext) {
  if (context.kind === "school") return `school:${context.school.id}`;
  if (context.kind === "teacher") return `teacher:${context.teacher.id}`;
  return "admin";
}

export type ScanContext =
  | { kind: "admin" }
  | { kind: "school"; school: SchoolAccountDto }
  | { kind: "teacher"; teacher: TeacherAccountDto };

type ScanSchool = { id: string; name: string; type: SchoolType };

type ScanKey = Awaited<ReturnType<typeof answerKeyRepository.findAnswerKeys>>[number];

export type ScanDto = {
  id: string;
  previewId?: string;
  testId: string;
  testNumber: number;
  rollNo: string;
  examDate: string | null;
  student: {
    id: string;
    name: string;
    rollNo: string;
    classLevel: number;
    sectionName: string | null;
    programName: string;
    schoolName: string;
  };
  flags: Array<{ question: number; reason: string }>;
  subjectScores: ReturnType<typeof scoreSheet>["subjectScores"];
  correct: number;
  partial: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
  confidence: number;
  fileName: string;
  sheetImage?: string;
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  keyAnswers?: Record<string, string>;
  /** Per-range Normal vs MCQ scoring — drives partial-credit display. */
  keyTypeRanges?: Array<{
    from: number;
    to: number;
    type: "normal" | "mcq";
    correctMarks: number;
    wrongMarks: number;
  }>;
  createdAt: string;
};

type Pending = {
  expires: number;
  context: ScanContext;
  school: ScanSchool;
  key: ScanKey;
  identity: {
    rollNo: string;
    testId: string;
    examDate: string | null;
    studentName: string;
    classLevel: number;
    sectionName: string;
    programName: string;
  };
  answers: Record<string, "A" | "B" | "C" | "D" | Array<"A" | "B" | "C" | "D">>;
  flags: ScanDto["flags"];
  score: ReturnType<typeof scoreSheet>;
  confidence: number;
  /** Sheet / raw / preview JPEGs live on disk under this directory (keeps 500-page batches off the heap). */
  diskDir: string;
  sheetBytes: number;
  bubbles?: BubbleMap;
  fileName: string;
  studentId: string | null;
};

const pending = new Map<string, Pending>();

async function previewImage(
  image: Buffer,
  read: SheetRead,
  keyAnswers: unknown,
  score: SheetScore,
  keyTypeRanges: unknown = [],
) {
  if (read.bubbles?.points.length) {
    try {
      return await markedSheetPreview(
        read.jpeg,
        read.bubbles,
        read.answers,
        keyAnswers,
        score.subjectScores,
        keyTypeRanges,
      );
    } catch {
      // Fall back to the plain photo below.
    }
  }
  return sharp(image)
    .rotate()
    .resize({ width: 900, height: 1272, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

/** Uploaded photo / PDF page kept as-is apart from orientation, capped so phone photos stay small. */
function rawJpeg(image: Buffer) {
  return sharp(image)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time) || time > Date.now() + 24 * 60 * 60 * 1000) return "";
  return value;
}

function contextSchool(context: ScanContext): ScanSchool | null {
  if (context.kind === "school") return { id: context.school.id, name: context.school.name, type: context.school.type };
  if (context.kind === "teacher") return { id: context.teacher.school.id, name: context.teacher.school.name, type: context.teacher.school.type };
  return null;
}

function programNameOf(context: ScanContext, key: ScanKey) {
  const programs =
    context.kind === "school"
      ? context.school.schoolPrograms
      : context.kind === "teacher"
        ? context.teacher.school.schoolPrograms
        : [];
  return programs.find((row) => row.programCode === key.programCode)?.programName ?? key.programCode;
}

type ScanStudent = {
  name: string;
  rollNo: string;
  classLevel: number;
  programCode: string | null;
  sectionId?: string | null;
};

function keyHasAnswers(key: ScanKey) {
  return Object.keys(asAnswers(key.answers)).length > 0;
}

/**
 * OMR key order: school section key → school-wide key → our (platform) key.
 * Blank / draft school keys are skipped so grading falls back to the platform key.
 */
function rankKeyForSchool(key: ScanKey, school: ScanSchool, sectionId: string | null | undefined) {
  const schoolOverride = key.school?.id === school.id;
  if (schoolOverride && !keyHasAnswers(key)) return 99;
  if (schoolOverride && sectionId && key.sectionId === sectionId) return 0;
  if (schoolOverride && !key.sectionId) return 1;
  if (!key.school && key.type === SchoolType.REGULAR) return 2;
  if (school.type === SchoolType.CUSTOMIZED && key.type === SchoolType.CUSTOMIZED && key.school?.id === school.id) {
    return keyHasAnswers(key) ? 1 : 99;
  }
  return 99;
}

/** True when this key can grade a sheet for the school (school override or our platform key). */
function keyVisibleTo(key: ScanKey, school: ScanSchool) {
  return rankKeyForSchool(key, school, undefined) < 99;
}

/** The key must be for the student's class and program as stored in the database. */
async function resolveKey(school: ScanSchool | null, tests: string[], student: ScanStudent) {
  let lastError: unknown;
  for (const testId of tests) {
    try {
      const keys = await answerKeyRepository.findAnswerKeys({
        testId: { equals: testId.trim(), mode: "insensitive" },
      });
      const visible = (
        school
          ? keys
              .map((key) => ({ key, rank: rankKeyForSchool(key, school, student.sectionId) }))
              .filter((row) => row.rank < 99)
              .sort((a, b) => a.rank - b.rank || Number(b.key.published) - Number(a.key.published))
              .map((row) => row.key)
          : keys.filter((key) => !key.school).sort((a, b) => Number(b.published) - Number(a.published))
      );
      if (visible.length === 0) {
        throw new AppError(404, `No answer key for test ID ${testId}${school ? ` at ${school.name}` : ""}`);
      }
      const who = `${student.name || student.rollNo} (${student.rollNo})`;
      const sameClass = visible.filter((key) => key.classLevel === student.classLevel);
      if (sameClass.length === 0) {
        const classes = [...new Set(visible.map((key) => key.classLevel))].sort((a, b) => a - b);
        throw new AppError(
          422,
          `Test ID ${testId} is for Class ${classes.join(", ")}, but ${who} is in Class ${student.classLevel}. Check the test ID or the student's class.`,
        );
      }
      const match = student.programCode
        ? sameClass.filter((key) => key.programCode === student.programCode)
        : sameClass;
      if (match.length === 0) {
        throw new AppError(
          422,
          `Test ID ${testId} belongs to a different program than ${who}. Check the test ID or the student's program.`,
        );
      }
      return { key: match[0]!, school };
    } catch (error) {
      lastError = error;
      if (!(error instanceof AppError) || error.statusCode >= 500) throw error;
    }
  }
  throw lastError ?? new AppError(404, "No published answer key for this sheet");
}

async function resolveStudent(school: ScanSchool | null, candidates: string[]) {
  if (school) {
    const knownRolls = (await studentRepository.listSchoolRolls(school.id)).map((row) => row.rollNo);
    const rollNo = pickRollNo(candidates, knownRolls);
    if (!rollNo) {
      const typed = candidates.find((value) => isPlausibleRoll(value));
      throw new AppError(
        422,
        typed
          ? `No student with registration number ${typed} in this school.`
          : "Unable to read the registration number. Fill exactly one bubble in each of the 7 columns.",
      );
    }
    const enrolled = await studentRepository.findActiveStudentInSchool(school.id, rollNo);
    if (!enrolled) {
      throw new AppError(422, `No student with registration number ${rollNo} in this school.`);
    }
    return enrolled;
  }
  const digits = [...new Set(candidates.filter(isPlausibleRoll))];
  const hits = [];
  for (const roll of digits.length ? digits : [pickRollNo(candidates, [])].filter(Boolean)) {
    hits.push(...(await studentRepository.findActiveStudentsByRollNo(roll)));
  }
  const uniqueHits = [...new Map(hits.map((row) => [row.id, row])).values()];
  if (uniqueHits.length === 1) return uniqueHits[0]!;
  const rollNo = pickRollNo(candidates, uniqueHits.map((row) => row.rollNo));
  const matched = uniqueHits.filter((row) => row.rollNo.toUpperCase() === rollNo.toUpperCase());
  if (matched.length === 1) return matched[0]!;
  if (!rollNo && !digits.length) {
    throw new AppError(
      422,
      "Unable to read the registration number. Fill exactly one bubble in each of the 7 columns.",
    );
  }
  throw new AppError(422, `No student with registration number ${rollNo || digits[0] || ""}.`);
}

function asMarked(answers: Pending["answers"]): Record<string, Array<"A" | "B" | "C" | "D">> {
  const out: Record<string, Array<"A" | "B" | "C" | "D">> = {};
  for (const [question, value] of Object.entries(answers)) {
    const marked = (Array.isArray(value) ? value : value ? [value] : []).filter(
      (option): option is "A" | "B" | "C" | "D" => option === "A" || option === "B" || option === "C" || option === "D",
    );
    if (marked.length) out[question] = marked;
  }
  return out;
}

function toDto(row: scanRepository.OmScanRow, previewId?: string): ScanDto {
  const examDate = row.examDate ? row.examDate.toISOString().slice(0, 10) : null;
  return {
    id: row.id,
    previewId,
    testId: row.testId,
    testNumber: row.answerKey.testNumber,
    rollNo: row.rollNo,
    examDate,
    student: {
      id: row.id,
      name: row.studentName || row.rollNo,
      rollNo: row.rollNo,
      classLevel: row.classLevel,
      sectionName: row.sectionName,
      programName: row.programName || row.answerKey.programCode,
      schoolName: row.school.name,
    },
    flags: Array.isArray(row.flags) ? (row.flags as ScanDto["flags"]) : [],
    subjectScores: row.subjectScores as ScanDto["subjectScores"],
    correct: row.correct,
    partial: partialFromSubjectScores(row.subjectScores),
    wrong: row.wrong,
    blank: row.blank,
    total: row.total,
    maxTotal: row.maxTotal,
    confidence: row.confidence,
    fileName: row.fileName,
    answers: asMarked((row.answers as Pending["answers"]) ?? {}),
    keyAnswers: asAnswers(row.answerKey.answers),
    keyTypeRanges: asKeyTypeRanges(row.answerKey.keyTypeRanges),
    createdAt: row.createdAt.toISOString(),
  };
}

function partialFromSubjectScores(scores: unknown) {
  if (!Array.isArray(scores)) return 0;
  return scores.reduce((sum: number, row) => {
    if (!row || typeof row !== "object") return sum;
    const value = (row as { partial?: unknown }).partial;
    return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

function unsavedDto(previewId: string, row: Pending, _embedImage = true): ScanDto {
  return {
    id: previewId,
    previewId,
    testId: row.identity.testId,
    testNumber: row.key.testNumber,
    rollNo: row.identity.rollNo,
    examDate: row.identity.examDate,
    student: {
      id: previewId,
      name: row.identity.studentName || row.identity.rollNo,
      rollNo: row.identity.rollNo,
      classLevel: row.identity.classLevel,
      sectionName: row.identity.sectionName || null,
      programName: row.identity.programName,
      schoolName: row.school.name,
    },
    flags: row.flags,
    subjectScores: row.score.subjectScores,
    correct: row.score.correct,
    partial: row.score.partial,
    wrong: row.score.wrong,
    blank: row.score.blank,
    total: row.score.total,
    maxTotal: row.score.maxTotal,
    confidence: row.confidence,
    fileName: row.fileName,
    // PDF batch polls omit base64 — embedding hundreds of JPEGs OOMs the API.
    sheetImage: undefined,
    answers: asMarked(row.answers),
    keyAnswers: asAnswers(row.key.answers),
    keyTypeRanges: asKeyTypeRanges(row.key.keyTypeRanges),
    createdAt: new Date().toISOString(),
  };
}

/** Entered test ID must match an answer key this school can use — checked before any sheet is read. */
/**
 * Live phone/PDF evaluation for this test ID (pending previews or an unfinished PDF batch).
 * Used to lock answer-key edits while sheets are being scored.
 */
export function isOmrEvaluationActiveForTestId(testId: string) {
  const needle = testId.trim().toUpperCase();
  if (!needle) return false;
  purgeExpiredPdfBatches();
  for (const batch of pdfBatches.values()) {
    if (batch.cancelled || batch.finished) continue;
    if (batch.testId.trim().toUpperCase() === needle) return true;
  }
  for (const row of pending.values()) {
    if (row.identity.testId.trim().toUpperCase() === needle) return true;
  }
  return false;
}

export async function checkTestId(context: ScanContext, testId: string) {
  const value = testId.trim().toUpperCase();
  if (!value) throw new AppError(400, "Enter the test ID from the answer key.");
  const school = contextSchool(context);
  const keys = (await answerKeyRepository.findAnswerKeys({})).filter(
    (key) => key.testId?.trim().toUpperCase() === value && (!school || keyVisibleTo(key, school)),
  );
  if (!keys.length) {
    throw new AppError(
      404,
      school ? `No answer key for test ID ${value} at ${school.name}.` : `No answer key for test ID ${value}.`,
    );
  }
  const catalog = new Map((await programRepository.findPrograms()).map((program) => [program.code, program.name]));
  return {
    testId: keys[0]!.testId!.trim(),
    keys: keys.map((key) => {
      const named = programNameOf(context, key);
      return {
        testNumber: key.testNumber,
        classLevel: key.classLevel,
        programCode: key.programCode,
        programName: named !== key.programCode ? named : (catalog.get(key.programCode) ?? key.programCode),
      };
    }),
  };
}

/**
 * Accept a multi-student OMR PDF (already on disk) and start reading every page.
 * The upload returns at once; progress and finished sheets come from pdfBatchStatus.
 */
export async function registerOmrPdf(
  context: ScanContext,
  pdfPath: string,
  fileName: string,
  identity: { testId?: string } = {},
  fileSize = 0,
) {
  if (fileSize > PDF_MAX) {
    await removeOmrPath(pdfPath);
    throw new AppError(413, "PDF is too large (max 500 MB)");
  }
  if (!(identity.testId ?? "").trim()) {
    await removeOmrPath(pdfPath);
    throw new AppError(400, "Enter the test ID from the answer key before uploading");
  }
  let accepted = false;
  try {
    const { testId } = await checkTestId(context, identity.testId ?? "");
    purgeExpiredPdfBatches();
    const owner = ownerOf(context);
    const active = [...pdfBatches.values()].find(
      (batch) => batch.owner === owner && !batch.cancelled && !batch.finished,
    );
    if (active) {
      throw new AppError(
        409,
        "A PDF is already being read for this account. Wait for it to finish, or dismiss it, then upload again.",
      );
    }
    const pageCount = await omrPdfPageCount(pdfPath);
    const batch: PdfBatch = {
      id: crypto.randomUUID(),
      owner,
      createdAt: Date.now(),
      expires: Date.now() + PDF_BATCH_TTL_MS,
      pdfPath,
      fileName: fileName || "omr.pdf",
      pageCount,
      testId,
      items: [],
      finished: false,
      cancelled: false,
    };
    pdfBatches.set(batch.id, batch);
    accepted = true;
    void readPdfBatch(context, batch);
    return { batchId: batch.id, pageCount, testId };
  } catch (error) {
    if (!accepted) await removeOmrPath(pdfPath);
    throw error;
  }
}

/** Thumbnail kept for failed / duplicate PDF pages so the examiner can enter a registration. */
async function storePdfPageThumb(batchId: string, page: number, jpeg: Buffer) {
  const thumb = await sharp(jpeg)
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer()
    .catch(() => undefined);
  if (!thumb) return undefined;
  return storeBatchPageImage(batchId, page, thumb).catch(() => undefined);
}

/** Reads pages one after another so live phone scans still get served between pages. */
async function readPdfBatch(context: ScanContext, batch: PdfBatch) {
  if (!batch.pdfPath) return;
  const reader = await openOmrPdf(batch.pdfPath, batch.fileName);
  const pageOfRoll = new Map<string, number>();
  try {
    for (let page = 1; page <= batch.pageCount && !batch.cancelled; page += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      let sheet: Awaited<ReturnType<typeof reader.render>> | null = null;
      try {
        sheet = await reader.render(page);
        // Batch test ID always wins — never OCR the sheet header for PDFs.
        const { previewId, scan } = await previewScan(context, sheet.jpeg, sheet.fileName, {
          testId: batch.testId,
          flat: true,
          lean: true,
        });
        const firstPage = pageOfRoll.get(scan.rollNo);
        if (firstPage != null) {
          // Keep a page image so the examiner can enter the correct registration (same as unread-roll recovery).
          const imagePath = await storePdfPageThumb(batch.id, page, sheet.jpeg);
          const dup = pending.get(previewId);
          if (dup) void removePendingDir(dup.diskDir);
          pending.delete(previewId);
          batch.items.push({
            page,
            duplicateOf: firstPage,
            imagePath,
            error: `Same registration number as page ${firstPage}`,
          });
        } else {
          pageOfRoll.set(scan.rollNo, page);
          const row = pending.get(previewId);
          if (row) row.expires = Date.now() + PDF_BATCH_TTL_MS;
          batch.items.push({ page, previewId });
        }
      } catch (error) {
        if (!(error instanceof AppError)) logger.error({ err: error, page, batchId: batch.id }, "PDF page read failed");
        const imagePath = sheet ? await storePdfPageThumb(batch.id, page, sheet.jpeg) : undefined;
        batch.items.push({
          page,
          imagePath,
          error: error instanceof AppError ? error.message : "Could not read this page",
        });
      }
      batch.expires = Date.now() + PDF_BATCH_TTL_MS;
    }
  } finally {
    batch.finished = true;
    await reader.close().catch(() => undefined);
    await removeOmrPath(batch.pdfPath);
    batch.pdfPath = null;
    if (batch.cancelled) await dropBatchFiles(batch);
  }
}

function ownPdfBatch(context: ScanContext, batchId: string) {
  purgeExpiredPdfBatches();
  const batch = pdfBatches.get(batchId);
  if (!batch || batch.cancelled || batch.owner !== ownerOf(context)) {
    throw new AppError(410, "PDF batch expired. Upload the PDF again.");
  }
  return batch;
}

/** Progress plus sheets finished from index `from` on, so the page only downloads new sheets. */
export function pdfBatchStatus(context: ScanContext, batchId: string, from = 0) {
  const batch = ownPdfBatch(context, batchId);
  return {
    batchId: batch.id,
    fileName: batch.fileName,
    testId: batch.testId,
    pageCount: batch.pageCount,
    done: batch.items.length,
    finished: batch.finished,
    items: batch.items.slice(from).map((item) => {
      const row = item.previewId ? pending.get(item.previewId) : undefined;
      return {
        page: item.page,
        error: item.error,
        duplicateOf: item.duplicateOf,
        hasImage: Boolean(item.imagePath),
        /** Saved (or expired) sheets are no longer pending and are left out. */
        preview: row && item.previewId
          ? { previewId: item.previewId, scan: unsavedDto(item.previewId, row, false) }
          : undefined,
      };
    }),
  };
}

/** The rendered page of a PDF page that could not be read. */
export async function getPdfBatchPageImage(context: ScanContext, batchId: string, page: number) {
  const batch = ownPdfBatch(context, batchId);
  const imagePath = batch.items.find((item) => item.page === page)?.imagePath;
  if (!imagePath) throw new AppError(404, `No image kept for page ${page}`);
  const data = await loadBatchPageImage(imagePath);
  return {
    data,
    fileName: downloadFileName([batch.fileName.replace(/\.pdf$/i, ""), `p${page}`], "jpg"),
  };
}

/** Latest PDF this session uploaded, so leaving the page and coming back picks it up again. */
export function activePdfBatch(context: ScanContext) {
  purgeExpiredPdfBatches();
  const owner = ownerOf(context);
  const latest = [...pdfBatches.values()]
    .filter((batch) => batch.owner === owner && !batch.cancelled)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!latest) return null;
  return {
    batchId: latest.id,
    fileName: latest.fileName,
    testId: latest.testId,
    pageCount: latest.pageCount,
    done: latest.items.length,
    finished: latest.finished,
  };
}

/** Stops reading and drops sheets that were not saved. */
export function dismissPdfBatch(context: ScanContext, batchId: string) {
  const batch = ownPdfBatch(context, batchId);
  batch.cancelled = true;
  // Unfinished batches are cleaned in readPdfBatch's finally (PDF still needed until the reader closes).
  if (batch.finished) void dropBatchFiles(batch);
  pdfBatches.delete(batch.id);
  return { batchId: batch.id };
}

/** Phone camera and laptop upload both enter here: sharp → OpenCV bubbles + Tesseract header → zod, then evaluate against the answer key. */
export async function previewScan(
  context: ScanContext,
  image: Buffer,
  fileName: string,
  identity: { rollNo?: string; testId?: string; flat?: boolean; lean?: boolean; corners?: SheetCorners } = {},
) {
  if (image.length > IMAGE_MAX) throw new AppError(413, "OMR image is too large (max 8 MB)");
  if (!identity.flat) void keepSample(image, fileName || "omr.jpg");
  const typedRoll = (identity.rollNo ?? "").replace(/\D/g, "");
  const typedTest = (identity.testId ?? "").trim();
  const read = await readQueued(image, fileName, {
    rollNo: typedRoll,
    testId: typedTest,
    flat: identity.flat,
    corners: identity.corners,
  });
  const sessionSchool = contextSchool(context);
  // Typed registration is authoritative — do not fall back to a different bubble read.
  const enrolled = await resolveStudent(
    sessionSchool,
    typedRoll ? [typedRoll] : [read.rollNo, ...read.rollCandidates],
  );
  const school: ScanSchool = sessionSchool ?? {
    id: enrolled.school.id,
    name: enrolled.school.name,
    type: "type" in enrolled.school ? (enrolled.school.type as SchoolType) : SchoolType.REGULAR,
  };
  const visibleKeys = (await answerKeyRepository.findAnswerKeys({})).filter((key) => keyVisibleTo(key, school));
  const known = visibleKeys.map((key) => key.testId?.trim() ?? "").filter(Boolean);
  // Entered test ID is authoritative — never fall back to OCR guesses.
  let testId: string;
  if (typedTest) {
    testId = known.find((id) => id.toUpperCase() === typedTest.toUpperCase()) ?? "";
    if (!testId) {
      throw new AppError(422, `No answer key for test ID ${typedTest} at ${school.name}.`);
    }
  } else {
    testId = pickTestId([read.testId, ...read.testCandidates], known, [
      typedRoll,
      enrolled.rollNo,
      read.rollNo,
      ...read.rollCandidates,
    ].filter(Boolean));
    if (!testId) {
      throw new AppError(422, "Enter the test ID from the answer key, then scan again.");
    }
  }
  const { key } = await resolveKey(school, [testId], {
    name: enrolled.name,
    rollNo: enrolled.rollNo,
    classLevel: enrolled.classLevel,
    programCode: enrolled.program?.code ?? null,
    sectionId: enrolled.sectionId ?? enrolled.section?.id ?? null,
  });
  const score = scoreSheet(
    read.answers,
    key.answers,
    key.subjectRanges,
    {
      correctMarks: key.correctMarks,
      wrongMarks: key.wrongMarks,
    },
    key.keyTypeRanges,
  );
  const previewId = crypto.randomUUID();
  let preview = await previewImage(image, read, key.answers, score, key.keyTypeRanges);
  // PDF batch pages already are flat JPEGs — reuse the same buffer instead of a second full copy.
  const raw = identity.flat ? read.jpeg : await rawJpeg(image);
  if (identity.lean) {
    preview = await sharp(preview)
      .resize({ width: 900, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
  const stored = await storePendingImages(previewId, {
    sheet: read.jpeg,
    raw,
    preview,
    rawSameAsSheet: identity.flat === true,
  });
  const row: Pending = {
    expires: Date.now() + PREVIEW_TTL_MS,
    context,
    school,
    key,
    identity: {
      rollNo: enrolled.rollNo,
      testId: key.testId ?? testId,
      examDate: validDate(read.examDate) || null,
      studentName: enrolled.name || read.printedName,
      classLevel: enrolled.classLevel,
      sectionName: displaySectionName(enrolled.section?.name),
      programName: enrolled.program?.name || programNameOf(context, key),
    },
    answers: read.answers,
    flags: sheetFlags(score, read.flags),
    score,
    confidence: read.confidence,
    diskDir: stored.dir,
    sheetBytes: stored.sheetBytes,
    // Large PDF batches skip bubble maps — re-mark isn't needed for review/save.
    bubbles: identity.lean || !read.bubbles?.points.length ? undefined : read.bubbles,
    fileName: fileName || "omr.jpg",
    studentId: enrolled.schoolId === school.id ? enrolled.id : null,
  };
  pending.set(previewId, row);
  return { previewId, scan: unsavedDto(previewId, row, !identity.lean) };
}

/** The uploaded photo / PDF page, or the marked copy, of a sheet that is not saved yet. */
export async function getPreviewImage(context: ScanContext, previewId: string, kind: ScanImageKind) {
  const row = pending.get(previewId);
  if (!row || row.expires < Date.now() || ownerOf(row.context) !== ownerOf(context)) {
    throw new AppError(404, "Scan expired. Scan again.");
  }
  const data = await loadPendingImage(row.diskDir, kind === "raw" ? "raw" : "preview");
  return {
    data,
    fileName: downloadFileName(
      [row.identity.studentName, row.identity.rollNo, kind === "raw" ? "omr" : "evaluated"],
      "jpg",
    ),
  };
}

export async function commitScan(
  context: ScanContext,
  previewId: string,
  options: { rollNo?: string } = {},
) {
  if (options.rollNo) await rebindPendingRoll(context, previewId, options.rollNo);
  const { scan, schoolId } = await saveScan(context, previewId);
  notifyContentChanged({ kind: "results", schoolId });
  return { scan };
}

/** Point a pending preview at another enrolled student (manual registration on review). */
async function rebindPendingRoll(context: ScanContext, previewId: string, rollNo: string) {
  const row = pending.get(previewId);
  if (!row || row.expires < Date.now()) {
    if (row) void removePendingDir(row.diskDir);
    pending.delete(previewId);
    throw new AppError(410, "Scan expired. Scan again.");
  }
  if (row.context.kind !== context.kind) throw new AppError(403, "This preview belongs to another session");
  const clean = rollNo.replace(/\D/g, "");
  if (!/^\d{7}$/.test(clean)) {
    throw new AppError(422, "Registration number must be 7 digits");
  }
  if (clean === row.identity.rollNo && row.studentId) return;
  const enrolled = await resolveStudent(row.school, [clean]);
  const { key } = await resolveKey(row.school, [row.identity.testId], {
    name: enrolled.name,
    rollNo: enrolled.rollNo,
    classLevel: enrolled.classLevel,
    programCode: enrolled.program?.code ?? null,
    sectionId: enrolled.sectionId ?? enrolled.section?.id ?? null,
  });
  if (key.id !== row.key.id) {
    const readFlags = row.flags.filter((flag) => flag.reason !== "Un-attempted");
    if (row.bubbles) {
      const sheet = await loadPendingImage(row.diskDir, "sheet");
      const { score, image } = await evaluatedImage(sheet, row.bubbles, row.answers, key);
      row.score = score;
      await replacePendingPreview(row.diskDir, image);
    } else {
      row.score = scoreSheet(
        row.answers,
        key.answers,
        key.subjectRanges,
        {
          correctMarks: key.correctMarks,
          wrongMarks: key.wrongMarks,
        },
        key.keyTypeRanges,
      );
    }
    row.flags = sheetFlags(row.score, readFlags);
    row.key = { ...row.key, ...key };
  }
  row.identity = {
    ...row.identity,
    rollNo: enrolled.rollNo,
    studentName: enrolled.name || row.identity.studentName,
    classLevel: enrolled.classLevel,
    sectionName: displaySectionName(enrolled.section?.name),
    programName: enrolled.program?.name || row.identity.programName,
  };
  row.studentId = enrolled.schoolId === row.school.id ? enrolled.id : null;
}

/** Most sheets "Save all" sends in one request; the page sends a big batch in chunks for progress. */
export const COMMIT_MANY_MAX = 25;

/** Saves sheets one after another (results rows are updated per sheet), reporting each one. */
export async function commitScans(context: ScanContext, previewIds: string[]) {
  const results: Array<{ previewId: string; ok: true; scan: ScanDto } | { previewId: string; ok: false; message: string }> = [];
  const schools = new Set<string>();
  for (const previewId of previewIds) {
    try {
      const { scan, schoolId } = await saveScan(context, previewId);
      schools.add(schoolId);
      results.push({ previewId, ok: true, scan });
    } catch (error) {
      if (!(error instanceof AppError)) logger.error({ err: error, previewId }, "OMR save failed");
      results.push({ previewId, ok: false, message: error instanceof AppError ? error.message : "Could not save this scan" });
    }
  }
  for (const schoolId of schools) notifyContentChanged({ kind: "results", schoolId });
  return { results };
}

/** The key changed (an objection was accepted, or the admin edited it) after this sheet was read. */
async function useCurrentKey(row: Pending) {
  const current = await answerKeyRepository.findAnswerKeyById(row.key.id);
  if (!current) throw new AppError(410, "This answer key was removed. Scan again.");
  if (scoringFingerprint(current) === scoringFingerprint(row.key)) return;
  const readFlags = row.flags.filter((flag) => flag.reason !== "Un-attempted");
  if (row.bubbles) {
    const sheet = await loadPendingImage(row.diskDir, "sheet");
    const { score, image } = await evaluatedImage(sheet, row.bubbles, row.answers, current);
    row.score = score;
    await replacePendingPreview(row.diskDir, image);
  } else {
    row.score = scoreSheet(
      row.answers,
      current.answers,
      current.subjectRanges,
      {
        correctMarks: current.correctMarks,
        wrongMarks: current.wrongMarks,
      },
      current.keyTypeRanges,
    );
  }
  row.flags = sheetFlags(row.score, readFlags);
  row.key = { ...row.key, ...current };
}

async function saveScan(context: ScanContext, previewId: string) {
  const row = pending.get(previewId);
  if (!row || row.expires < Date.now()) {
    if (row) void removePendingDir(row.diskDir);
    pending.delete(previewId);
    throw new AppError(410, "Scan expired. Scan again.");
  }
  if (row.context.kind !== context.kind) throw new AppError(403, "This preview belongs to another session");
  await useCurrentKey(row);
  const testId = row.identity.testId;
  const folder = `omr/${row.school.id}/${testId}/${row.identity.rollNo}`;
  const [sheetBuf, rawBuf, previewBuf] = await Promise.all([
    loadPendingImage(row.diskDir, "sheet"),
    loadPendingImage(row.diskDir, "raw"),
    loadPendingImage(row.diskDir, "preview"),
  ]);
  const [image, rawImage, previewImage] = await Promise.all([
    putObject(`${folder}/sheet`, sheetBuf, { fileName: "sheet.jpg", contentType: "image/jpeg" }),
    putObject(`${folder}/raw`, rawBuf, { fileName: "raw.jpg", contentType: "image/jpeg" }),
    putObject(`${folder}/evaluated`, previewBuf, { fileName: "evaluated.jpg", contentType: "image/jpeg" }),
  ]);
  const saved = await scanRepository.upsertOmScan(row.school.id, row.identity.rollNo, testId, row.identity.classLevel, {
    schoolId: row.school.id,
    studentId: row.studentId,
    studentName: row.identity.studentName,
    classLevel: row.identity.classLevel,
    sectionName: row.identity.sectionName || null,
    programName: row.identity.programName,
    answerKeyId: row.key.id,
    testId,
    rollNo: row.identity.rollNo,
    examDate: row.identity.examDate ? new Date(`${row.identity.examDate}T00:00:00Z`) : null,
    answers: row.answers as Prisma.InputJsonValue,
    flags: row.flags as Prisma.InputJsonValue,
    subjectScores: row.score.subjectScores as Prisma.InputJsonValue,
    correct: row.score.correct,
    wrong: row.score.wrong,
    blank: row.score.blank,
    total: row.score.total,
    maxTotal: row.score.maxTotal,
    confidence: row.confidence,
    fileName: row.fileName,
    fileSize: row.sheetBytes,
    image: Uint8Array.from(image),
    rawImage: Uint8Array.from(rawImage),
    previewImage: Uint8Array.from(previewImage),
    actor: context.kind,
    scannedById: context.kind === "teacher" ? context.teacher.id : null,
  });
  await recordOmrResult({
    schoolId: row.school.id,
    programCode: row.key.programCode,
    testId,
    testNumber: row.key.testNumber,
    classLevel: row.identity.classLevel,
    name: row.identity.studentName,
    rollNo: row.identity.rollNo,
    sectionName: row.identity.sectionName || null,
    subjects: row.score.subjectScores.map(({ subject, total, maxTotal }) => ({ subject, total, maxTotal })),
    total: row.score.total,
    maxTotal: row.score.maxTotal,
  });
  void removePendingDir(row.diskDir);
  pending.delete(previewId);
  return { scan: toDto(saved), schoolId: row.school.id };
}

function scopedSchoolId(context: ScanContext, schoolId: string) {
  const own = contextSchool(context);
  if (own && own.id !== schoolId) throw new AppError(404, "OMR not found");
  return schoolId;
}

export async function listClassScans(context: ScanContext, filter: scanRepository.ClassScanFilter) {
  const rows = await scanRepository.findClassScans({ ...filter, schoolId: scopedSchoolId(context, filter.schoolId) });
  return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
}

export type ScanImageKind = "preview" | "raw";

async function pickImage(row: { image: Uint8Array; rawImage: Uint8Array | null; previewImage: Uint8Array | null }, kind: ScanImageKind) {
  const stored = (kind === "raw" ? row.rawImage : row.previewImage) ?? row.image;
  const data = await getObject(stored);
  if (!data) throw new AppError(404, "OMR image not found");
  return data;
}

export async function getScanImage(context: ScanContext, id: string, kind: ScanImageKind) {
  const own = contextSchool(context);
  const [row] = await scanRepository.findScanImages({ id, ...(own ? { schoolId: own.id } : {}) });
  if (!row) throw new AppError(404, "OMR not found");
  return {
    data: await pickImage(row, kind),
    fileName: downloadFileName(
      [row.studentName, row.rollNo, row.testId, kind === "raw" ? "omr" : "evaluated"],
      "jpg",
    ),
  };
}

/** Full saved scan (answers + key) for results / student OMR viewer — not the review page. */
export async function getScan(context: ScanContext, id: string) {
  const own = contextSchool(context);
  const rows = await scanRepository.findOmScans({ id, ...(own ? { schoolId: own.id } : {}) });
  const row = rows[0];
  if (!row) throw new AppError(404, "OMR not found");
  return toDto(row);
}

/** Every saved OMR of one class in rank order, one sheet per PDF page. */
export async function getClassScansPdf(
  context: ScanContext,
  filter: scanRepository.ClassScanFilter,
  kind: ScanImageKind,
) {
  const rows = await scanRepository.findClassScanImages({ ...filter, schoolId: scopedSchoolId(context, filter.schoolId) });
  if (!rows.length) throw new AppError(404, "No OMR sheets saved for this class yet");
  const pdf = await PDFDocument.create();
  const pageWidth = 595;
  for (const row of rows) {
    const jpeg = await sharp(await pickImage(row, kind)).jpeg({ quality: 82 }).toBuffer();
    const embedded = await pdf.embedJpg(jpeg);
    const scale = pageWidth / embedded.width;
    const page = pdf.addPage([pageWidth, embedded.height * scale]);
    page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: embedded.height * scale });
  }
  return {
    data: Buffer.from(await pdf.save()),
    fileName: downloadFileName(
      [
        "OMR",
        filter.program,
        `Class-${filter.classLevel}`,
        `Test-${filter.testNumber}`,
        kind === "raw" ? "sheets" : "evaluated",
      ],
      "pdf",
    ),
  };
}

export async function listScans(context: ScanContext) {
  const where =
    context.kind === "admin"
      ? {}
      : context.kind === "school"
        ? { schoolId: context.school.id }
        : { schoolId: context.teacher.schoolId };
  const rows = await scanRepository.findOmScans(where);
  return rows.map((row) => toDto(row));
}
