import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { SchoolType } from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import * as programRepository from "../repositories/program.repository.js";
import * as schoolClassRepository from "../repositories/school-class.repository.js";
import * as schoolRepository from "../repositories/school.repository.js";
import * as sectionRepository from "../repositories/section.repository.js";
import * as studentRepository from "../repositories/student.repository.js";
import { recordOmrResult } from "../services/result.service.js";
import * as studentService from "../services/student.service.js";
import { AppError } from "../utils/app-error.js";

/** Failed PDF page view — already upright (and often with marks table on top). */
export class SheetDisplayError extends AppError {
  readonly displayJpeg: Buffer;
  constructor(statusCode: number, message: string, displayJpeg: Buffer, details?: unknown) {
    super(statusCode, message, details);
    this.name = "SheetDisplayError";
    this.displayJpeg = displayJpeg;
  }
}
import { notifyContentChanged } from "../utils/content-events.js";
import { downloadFileName } from "../utils/download-file-name.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { asAnswers, asKeyTypeRanges } from "../utils/answer-key-parse.js";
import { logger } from "../utils/logger.js";
import { displaySectionName } from "../utils/section-label.js";
import { titleCase } from "../utils/title-case.js";
import { fileNameHasTestNumber } from "./pdf-file-name.js";
import { omrPdfPageCount, openOmrPdf } from "./pdf-pages.js";
import {
  batchMetaPath,
  listBatchMetaFilesSync,
  listPendingMetaFilesSync,
  loadBatchPageImage,
  loadPendingImage,
  pendingMetaPath,
  purgeStaleOmrTemp,
  readJsonFileSync,
  removeBatchDir,
  removeOmrPath,
  removePendingDir,
  replacePendingPreview,
  storeBatchPageImage,
  storePendingImages,
  writeJsonFile,
} from "./pending-store.js";
import { readQueued } from "./queue.js";
import type { BubbleMap } from "./detect.js";
import { markedSheetPreview } from "./marked-preview.js";
import {
  isPlausibleRoll,
  pickRollNo,
  pickTestId,
  ensureUprightSource,
  uprightOmrJpeg,
  type SheetCorners,
  type SheetRead,
} from "./read-sheet.js";
import { getObject, putObject } from "../services/object-storage.js";
import { parseExamPattern, type ExamPattern } from "./exam-pattern.js";
import { evaluatedImage, scoreWithKey, scoringFingerprint } from "./regrade.js";
import * as scanRepository from "./repository.js";
import { sheetFlags, type SheetScore } from "./score.js";

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
/**
 * Production: keep unsaved OMR sheets available across review and deploys.
 * Metadata is also written under OMR_DATA_DIR so PM2 reload does not wipe batches.
 */
const PREVIEW_TTL_MS = 12 * 60 * 60 * 1000;
/** Idle TTL refreshed on every poll / page finish / preview view. */
const PDF_BATCH_TTL_MS = 12 * 60 * 60 * 1000;

type PdfBatchItem = {
  page: number;
  previewId?: string;
  error?: string;
  /** Another page in this PDF that shares the same registration. */
  duplicateOf?: number;
  /** Registration that collided — client removes matching review sheets. */
  rollNo?: string;
  /**
   * True when a later page forced this previously successful sheet into
   * registration recovery (every duplicate sheet must be re-entered).
   */
  demoted?: boolean;
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
  /** Exam pattern for every page in this PDF batch. */
  examPattern: ExamPattern;
  items: PdfBatchItem[];
  finished: boolean;
  cancelled: boolean;
};

const pdfBatches = new Map<string, PdfBatch>();

function persistBatch(batch: PdfBatch) {
  void writeJsonFile(batchMetaPath(batch.id), batch).catch((error) => {
    logger.warn({ err: error, batchId: batch.id }, "Could not persist OMR PDF batch");
  });
}

function persistPending(previewId: string, row: Pending) {
  void writeJsonFile(pendingMetaPath(previewId), {
    expires: row.expires,
    context: row.context,
    school: row.school,
    key: row.key,
    identity: row.identity,
    answers: row.answers,
    flags: row.flags,
    score: row.score,
    examPattern: row.examPattern,
    confidence: row.confidence,
    diskDir: row.diskDir,
    sheetBytes: row.sheetBytes,
    bubbles: row.bubbles,
    fileName: row.fileName,
    studentId: row.studentId,
    needsIdentity: row.needsIdentity ?? false,
  }).catch((error) => {
    logger.warn({ err: error, previewId }, "Could not persist OMR preview");
  });
}

function touchBatch(batch: PdfBatch) {
  batch.expires = Date.now() + PDF_BATCH_TTL_MS;
  persistBatch(batch);
}

function touchPending(previewId: string, row: Pending) {
  row.expires = Date.now() + PREVIEW_TTL_MS;
  persistPending(previewId, row);
}

function loadBatchFromDisk(batchId: string): PdfBatch | null {
  const stored = readJsonFileSync<PdfBatch>(batchMetaPath(batchId));
  if (!stored?.id || stored.cancelled) return null;
  // Mid-read process death: keep finished pages, stop pretending the reader is still alive.
  if (!stored.finished) {
    stored.finished = true;
    stored.pdfPath = null;
  }
  pdfBatches.set(stored.id, stored);
  return stored;
}

function getPdfBatch(batchId: string) {
  return pdfBatches.get(batchId) ?? loadBatchFromDisk(batchId);
}

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
    const row = getPending(item.previewId);
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

/** Batches belong to the session that uploaded them (one school, one teacher, or admin operator). */
function ownerOf(context: ScanContext) {
  if (context.kind === "school") return `school:${context.school.id}`;
  if (context.kind === "teacher") return `teacher:${context.teacher.id}`;
  // Root + each employee get their own OMR PDF queue so devices can scan in parallel.
  return `admin:${context.adminId}`;
}

export type ScanContext =
  | { kind: "admin"; adminId: string }
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
    programCode: string;
    programName: string;
    schoolId: string;
    schoolName: string;
  };
  flags: Array<{ question: number; reason: string }>;
  subjectScores: SheetScore["subjectScores"];
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
  score: SheetScore;
  examPattern: ExamPattern;
  confidence: number;
  /** Sheet / raw / preview JPEGs live on disk under this directory (keeps 500-page batches off the heap). */
  diskDir: string;
  sheetBytes: number;
  bubbles?: BubbleMap;
  fileName: string;
  studentId: string | null;
  /**
   * Answers were scored at scan time, but registration / student is not bound yet.
   * Examiner enters reg (or empty + name); bindPendingIdentity — no re-read of bubbles.
   */
  needsIdentity?: boolean;
};

const pending = new Map<string, Pending>();

function loadPendingFromDisk(previewId: string): Pending | null {
  const stored = readJsonFileSync<Pending>(pendingMetaPath(previewId));
  if (!stored?.diskDir || !stored.expires) return null;
  if (stored.expires < Date.now()) {
    void removePendingDir(stored.diskDir);
    return null;
  }
  pending.set(previewId, stored);
  return stored;
}

function getPending(previewId: string) {
  return pending.get(previewId) ?? loadPendingFromDisk(previewId);
}

function hydrateOmrState() {
  try {
    const now = Date.now();
    for (const { id, filePath } of listBatchMetaFilesSync()) {
      const stored = readJsonFileSync<PdfBatch>(filePath);
      if (!stored?.id || stored.cancelled || stored.expires < now) {
        if (stored?.expires != null && stored.expires < now) void removeBatchDir(id);
        continue;
      }
      if (!stored.finished) {
        stored.finished = true;
        stored.pdfPath = null;
      }
      pdfBatches.set(stored.id, stored);
    }
    for (const { id, filePath } of listPendingMetaFilesSync()) {
      const stored = readJsonFileSync<Pending>(filePath);
      if (!stored?.diskDir || stored.expires < now) {
        if (stored?.diskDir) void removePendingDir(stored.diskDir);
        continue;
      }
      pending.set(id, stored);
    }
    logger.info(
      { batches: pdfBatches.size, previews: pending.size },
      "Restored OMR batches/previews from disk",
    );
  } catch (error) {
    logger.warn({ err: error }, "OMR disk hydrate failed");
  }
}

hydrateOmrState();

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

/**
 * For admin mixed-school PDF batches: pick the school / class / program that appear
 * most often among ready pending sheets (walk-in inherits the PDF majority).
 */
function majorityPlacementFromPending(context: ScanContext): {
  school: ScanSchool | null;
  classLevel: number | null;
  programCode: string | null;
} {
  const owner = ownerOf(context);
  const schoolCounts = new Map<string, { school: ScanSchool; n: number }>();
  const rows: Pending[] = [];
  for (const row of pending.values()) {
    if (row.expires < Date.now()) continue;
    if (ownerOf(row.context) !== owner) continue;
    rows.push(row);
    const cur = schoolCounts.get(row.school.id);
    if (cur) cur.n += 1;
    else schoolCounts.set(row.school.id, { school: row.school, n: 1 });
  }
  let bestSchool: { school: ScanSchool; n: number } | null = null;
  for (const row of schoolCounts.values()) {
    if (!bestSchool || row.n > bestSchool.n) bestSchool = row;
  }
  const school = bestSchool?.school ?? null;
  const inSchool = school ? rows.filter((row) => row.school.id === school.id) : rows;
  const classCounts = new Map<number, number>();
  const programCounts = new Map<string, number>();
  for (const row of inSchool) {
    classCounts.set(row.identity.classLevel, (classCounts.get(row.identity.classLevel) ?? 0) + 1);
    const code = row.key.programCode?.trim();
    if (code) programCounts.set(code, (programCounts.get(code) ?? 0) + 1);
  }
  let classLevel: number | null = null;
  let classN = 0;
  for (const [level, n] of classCounts) {
    if (n > classN) {
      classN = n;
      classLevel = level;
    }
  }
  let programCode: string | null = null;
  let programN = 0;
  for (const [code, n] of programCounts) {
    if (n > programN) {
      programN = n;
      programCode = code;
    }
  }
  return { school, classLevel, programCode };
}

function majoritySchoolFromPending(context: ScanContext): ScanSchool | null {
  return majorityPlacementFromPending(context).school;
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
          `Test ID ${testId} is for Class ${classes.join(", ")}, but ${who} is in Class ${student.classLevel}.`,
        );
      }
      const match = student.programCode
        ? sameClass.filter((key) => key.programCode === student.programCode)
        : sameClass;
      if (match.length === 0) {
        throw new AppError(
          422,
          `Test ID ${testId} belongs to a different program than ${who}.`,
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

/** Answer key for an unregistered walk-in — class/program come from the key (test ID). */
async function resolveWalkInKey(school: ScanSchool, testId: string) {
  const keys = await answerKeyRepository.findAnswerKeys({
    testId: { equals: testId.trim(), mode: "insensitive" },
  });
  const visible = keys
    .map((key) => ({ key, rank: rankKeyForSchool(key, school, undefined) }))
    .filter((row) => row.rank < 99)
    .sort((a, b) => a.rank - b.rank || Number(b.key.published) - Number(a.key.published))
    .map((row) => row.key);
  if (visible.length === 0) {
    throw new AppError(404, `No answer key for test ID ${testId} at ${school.name}`);
  }
  return visible[0]!;
}

async function loadScanSchool(id: string): Promise<ScanSchool> {
  const school = await schoolRepository.findSchoolById(id);
  if (!school) throw new AppError(404, "School not found");
  return { id: school.id, name: school.name, type: school.type };
}

function isNoStudentError(error: unknown) {
  return error instanceof AppError && /no student with registration number/i.test(error.message);
}

function ambiguousRollMatches(
  rows: Array<{
    id: string;
    name: string;
    rollNo: string;
    classLevel: number;
    school: { id: string; name: string };
    program: { name: string } | null;
    section: { name: string } | null;
  }>,
) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    rollNo: row.rollNo,
    classLevel: row.classLevel,
    sectionName: row.section?.name ?? null,
    programName: row.program?.name ?? null,
    schoolId: row.school.id,
    schoolName: row.school.name,
  }));
}

function throwAmbiguousRoll(
  rollNo: string,
  matched: Array<{
    id: string;
    name: string;
    rollNo: string;
    classLevel: number;
    school: { id: string; name: string };
    program: { name: string } | null;
    section: { name: string } | null;
  }>,
): never {
  throw new AppError(
    422,
    `Registration number ${rollNo} matches ${matched.length} students. Pick one or enter another registration.`,
    {
      code: "AMBIGUOUS_ROLL",
      rollNo,
      matches: ambiguousRollMatches(matched),
    },
  );
}

async function resolveStudent(
  school: ScanSchool | null,
  candidates: string[],
  preferredSchoolId?: string,
) {
  // Examiner picked a school when the same reg exists at more than one school.
  if (preferredSchoolId && !school) {
    const knownRolls = (await studentRepository.listSchoolRolls(preferredSchoolId)).map(
      (row) => row.rollNo,
    );
    const rollNo = pickRollNo(candidates, knownRolls);
    if (rollNo) {
      const enrolled = await studentRepository.findActiveStudentInSchool(preferredSchoolId, rollNo);
      if (enrolled) return enrolled;
    }
  }

  if (school) {
    const knownRolls = (await studentRepository.listSchoolRolls(school.id)).map((row) => row.rollNo);
    const rollNo = pickRollNo(candidates, knownRolls);
    if (!rollNo) {
      const typed = candidates.find((value) => isPlausibleRoll(value));
      throw new AppError(
        422,
        typed
          ? `No student with registration number ${typed} in this school.`
          : "Unable to read the registration number.",
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
  if (matched.length > 1) throwAmbiguousRoll(rollNo!, matched);
  if (!rollNo && !digits.length) {
    throw new AppError(
      422,
      "Unable to read the registration number.",
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
      programCode: row.answerKey.programCode,
      programName: row.programName || row.answerKey.programCode,
      schoolId: row.school.id,
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
      programCode: row.key.programCode,
      programName: row.identity.programName,
      schoolId: row.school.id,
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

/**
 * Exam pattern is set on the school class/section — OMR uses that instead of a scan-time picker.
 * Prefer the student's section; otherwise majority among sections at that class level; then whole class.
 */
async function resolveClassExamPattern(
  schoolId: string,
  classLevel: number,
  sectionId?: string | null,
): Promise<ExamPattern> {
  if (sectionId) {
    const section = await sectionRepository.findSectionById(sectionId);
    if (section && section.schoolId === schoolId) {
      return parseExamPattern(section.examPattern) ?? "MPCB";
    }
  }
  const sections = (await sectionRepository.listSectionsBySchool(schoolId)).filter(
    (row) => row.classLevel === classLevel,
  );
  if (sections.length > 0) {
    const counts = new Map<ExamPattern, number>();
    for (const section of sections) {
      const pattern = parseExamPattern(section.examPattern) ?? "MPCB";
      counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
    }
    let best: ExamPattern = "MPCB";
    let bestCount = 0;
    for (const [pattern, count] of counts) {
      if (count > bestCount) {
        best = pattern;
        bestCount = count;
      }
    }
    return best;
  }
  const whole = await schoolClassRepository.findSchoolClassByLevel(schoolId, classLevel);
  if (whole) return parseExamPattern(whole.examPattern) ?? "MPCB";
  return "MPCB";
}

export async function checkTestId(context: ScanContext, testId: string) {
  const value = testId.trim().toUpperCase();
  if (!value) throw new AppError(400, "Enter the test ID from the answer key.");
  const school = contextSchool(context);
  // Drafts with no saved answers are not usable for OMR — hide them from the check.
  const keys = (await answerKeyRepository.findAnswerKeys({})).filter(
    (key) =>
      key.testId?.trim().toUpperCase() === value &&
      keyHasAnswers(key) &&
      (!school || keyVisibleTo(key, school)),
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
      const owner = key.school?.name?.trim() || "Platform";
      const section = key.section?.name?.trim();
      return {
        testNumber: key.testNumber,
        classLevel: key.classLevel,
        programCode: key.programCode,
        programName: named !== key.programCode ? named : (catalog.get(key.programCode) ?? key.programCode),
        owner,
        sectionName: section || null,
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
  identity: { testId?: string; examPattern?: string } = {},
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
    const { testId, keys } = await checkTestId(context, identity.testId ?? "");
    const testNumber = keys[0]?.testNumber;
    if (
      testNumber != null &&
      !fileNameHasTestNumber(fileName, testNumber)
    ) {
      throw new AppError(
        400,
        `Rejected: file name must include Test ${testNumber}. This test ID is Test ${testNumber}. Upload a PDF whose name contains ${testNumber} by itself (e.g. “v school ${testNumber}.pdf” or “schoolsrk${testNumber}.pdf”). Your file “${fileName || "omr.pdf"}” does not match — a longer number like ${testNumber}6, a different number, or no number is not accepted.`,
      );
    }
    // Prefer pattern from the school's class for this test; per-sheet resolve still runs at score time.
    let examPattern = parseExamPattern(identity.examPattern);
    if (!examPattern) {
      const school = contextSchool(context);
      const classLevel = keys[0]?.classLevel;
      if (school && classLevel != null) {
        examPattern = await resolveClassExamPattern(school.id, classLevel);
      }
    }
    examPattern = examPattern ?? "MPCB";
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
      examPattern,
      items: [],
      finished: false,
      cancelled: false,
    };
    pdfBatches.set(batch.id, batch);
    persistBatch(batch);
    accepted = true;
    void readPdfBatch(context, batch);
    return { batchId: batch.id, pageCount, testId, examPattern };
  } catch (error) {
    if (!accepted) await removeOmrPath(pdfPath);
    throw error;
  }
}

/**
 * Thumbnail for failed / duplicate PDF pages.
 * Pass `alreadyUpright` when the buffer is a prepared sheet or evaluated preview
 * (marks table on top) — do not re-warp or it destroys the table and can flip the page.
 */
async function storePdfPageThumb(
  batchId: string,
  page: number,
  jpeg: Buffer,
  options: { alreadyUpright?: boolean } = {},
) {
  const thumb = await (async () => {
    try {
      const source = options.alreadyUpright
        ? jpeg
        : await uprightOmrJpeg(jpeg, { flat: true });
      return await sharp(source)
        .resize({ width: 900, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch {
      return undefined;
    }
  })();
  if (!thumb) return undefined;
  return storeBatchPageImage(batchId, page, thumb).catch(() => undefined);
}

/** Upright sheet JPEG when we cannot score (no answer key / school). */
async function failedPageDisplayJpeg(read: SheetRead): Promise<Buffer> {
  try {
    return await uprightOmrJpeg(read.jpeg, { flat: true });
  } catch {
    return read.jpeg;
  }
}

/**
 * Score answers now (marks table on the preview) and keep a pending that only needs
 * registration / walk-in binding — no second bubble read on save.
 */
async function storeNeedsIdentityPreview(input: {
  context: ScanContext;
  school: ScanSchool;
  key: ScanKey;
  read: SheetRead;
  image: Buffer;
  fileName: string;
  examPattern: ExamPattern;
  lean?: boolean;
  flat?: boolean;
  rollNo: string;
  studentName: string;
  identityError: AppError;
  details?: unknown;
}): Promise<never> {
  const { context, school, key, read, image, fileName, examPattern, lean, flat } = input;
  const score = scoreWithKey(read.answers, key, { examPattern });
  if (score.subjectScores.length === 0) {
    throw new SheetDisplayError(
      422,
      `Answer key for ${key.testId ?? "this test"} has no subjects for exam pattern ${examPattern}.`,
      await failedPageDisplayJpeg(read),
    );
  }
  const previewId = crypto.randomUUID();
  let preview = await previewImage(image, read, key.answers, score, key.keyTypeRanges);
  const raw = flat ? read.jpeg : await rawJpeg(image);
  if (lean) {
    preview = await sharp(preview)
      .resize({ width: 900, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
  const stored = await storePendingImages(previewId, {
    sheet: read.jpeg,
    raw,
    preview,
    rawSameAsSheet: flat === true,
  });
  const row: Pending = {
    expires: Date.now() + PREVIEW_TTL_MS,
    context,
    school,
    key,
    identity: {
      rollNo: input.rollNo,
      testId: key.testId ?? "",
      examDate: validDate(read.examDate) || null,
      studentName: input.studentName || read.printedName || "Unknown",
      classLevel: key.classLevel,
      sectionName: displaySectionName(null),
      programName: programNameOf(context, key),
    },
    answers: read.answers,
    flags: sheetFlags(score, read.flags),
    score,
    examPattern,
    confidence: read.confidence,
    diskDir: stored.dir,
    sheetBytes: stored.sheetBytes,
    bubbles: lean || !read.bubbles?.points.length ? undefined : read.bubbles,
    fileName: fileName || "omr.jpg",
    studentId: null,
    needsIdentity: true,
  };
  pending.set(previewId, row);
  persistPending(previewId, row);
  const baseDetails =
    input.details && typeof input.details === "object" && !Array.isArray(input.details)
      ? (input.details as Record<string, unknown>)
      : {};
  throw new SheetDisplayError(input.identityError.statusCode, input.identityError.message, preview, {
    ...baseDetails,
    code: "NEEDS_IDENTITY",
    previewId,
    rollNo: input.rollNo || undefined,
  });
}

async function rethrowWithDisplay(
  error: unknown,
  displayJpeg: Buffer,
): Promise<never> {
  if (error instanceof SheetDisplayError) throw error;
  if (error instanceof AppError) {
    throw new SheetDisplayError(error.statusCode, error.message, displayJpeg, error.details);
  }
  throw error;
}

/** Every sheet in a colliding group is a duplicate — none is kept as the “correct” OMR. */
const duplicateRollMessage = (rollNo: string, pages: number[]) => {
  const sorted = [...pages].sort((a, b) => a - b);
  const n = sorted.length;
  const pageList = sorted.join(", ");
  return `Duplicate registration number ${rollNo} — appears on ${n} sheet${n === 1 ? "" : "s"} (pages ${pageList}) — please enter the correct registration number for this sheet`;
};

/**
 * Demote a successful preview into registration recovery — keep the scored pending
 * (marks table + answers) so enter-reg only binds the student.
 */
async function demotePdfPreview(batch: PdfBatch, item: PdfBatchItem) {
  if (!item.previewId) return;
  const row = getPending(item.previewId);
  if (!row) {
    item.previewId = undefined;
    return;
  }
  row.needsIdentity = true;
  touchPending(item.previewId, row);
  if (!item.imagePath) {
    const sheetBuf =
      (await loadPendingImage(row.diskDir, "preview").catch(() => null)) ??
      (await loadPendingImage(row.diskDir, "sheet").catch(() => null)) ??
      (await loadPendingImage(row.diskDir, "raw").catch(() => null));
    if (sheetBuf) {
      item.imagePath = await storePdfPageThumb(batch.id, item.page, sheetBuf, {
        alreadyUpright: true,
      });
    }
  }
}

/** Mark every page that shares `rollNo` as a duplicate failure (all need enter-reg). */
async function markRollGroupDuplicates(batch: PdfBatch, rollNo: string, pages: number[]) {
  if (pages.length < 2) return;
  const message = duplicateRollMessage(rollNo, pages);
  const anchor = pages[0]!;
  for (const page of pages) {
    const item = batch.items.find((row) => row.page === page);
    if (!item) continue;
    await demotePdfPreview(batch, item);
    item.rollNo = rollNo;
    item.duplicateOf = page === anchor ? pages[1]! : anchor;
    item.demoted = true;
    item.error = message;
  }
}

/** After the PDF is fully read, any registration on 2+ sheets is a full duplicate group. */
async function finalizeDuplicateRolls(batch: PdfBatch) {
  const pagesByRoll = new Map<string, number[]>();
  for (const item of batch.items) {
    const roll = item.rollNo?.trim();
    if (!roll) continue;
    // Shared blank roll may appear on many different students — never flag as duplicates.
    if (studentService.isSharedBlankRoll(roll)) continue;
    // Only sheets that were read as this roll (success or already flagged duplicate).
    if (item.error && !item.demoted && !item.duplicateOf) continue;
    const list = pagesByRoll.get(roll) ?? [];
    list.push(item.page);
    pagesByRoll.set(roll, list);
  }
  for (const [rollNo, pages] of pagesByRoll) {
    if (pages.length >= 2) await markRollGroupDuplicates(batch, rollNo, pages);
  }
}

/** Reads pages one after another so live phone scans still get served between pages. */
async function readPdfBatch(context: ScanContext, batch: PdfBatch) {
  if (!batch.pdfPath) return;
  const reader = await openOmrPdf(batch.pdfPath, batch.fileName);
  /** Every page that read this registration (none is “the correct” copy). */
  const pagesByRoll = new Map<string, number[]>();
  try {
    for (let page = 1; page <= batch.pageCount && !batch.cancelled; page += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      let sheet: Awaited<ReturnType<typeof reader.render>> | null = null;
      try {
        sheet = await reader.render(page);
        // Batch test ID always wins — never OCR the sheet header for PDFs.
        const { previewId, scan } = await previewScan(context, sheet.jpeg, sheet.fileName, {
          testId: batch.testId,
          examPattern: batch.examPattern,
          flat: true,
          lean: true,
        });
        const rollNo = scan.rollNo;
        const priorPages = studentService.isSharedBlankRoll(rollNo)
          ? []
          : (pagesByRoll.get(rollNo) ?? []);
        const allPages = [...priorPages, page];
        if (!studentService.isSharedBlankRoll(rollNo)) {
          pagesByRoll.set(rollNo, allPages);
        }

        if (priorPages.length > 0) {
          // Collision: keep scored pending on this page; demote the whole group for re-bind.
          const item: PdfBatchItem = {
            page,
            previewId,
            rollNo,
            demoted: true,
            duplicateOf: priorPages[0],
            error: duplicateRollMessage(rollNo, allPages),
          };
          await demotePdfPreview(batch, item);
          batch.items.push(item);
          await markRollGroupDuplicates(batch, rollNo, allPages);
        } else {
          const row = getPending(previewId);
          if (row) touchPending(previewId, row);
          batch.items.push({ page, previewId, rollNo });
        }
      } catch (error) {
        if (!(error instanceof AppError)) logger.error({ err: error, page, batchId: batch.id }, "PDF page read failed");
        const details =
          error instanceof AppError && error.details && typeof error.details === "object"
            ? (error.details as { previewId?: string; rollNo?: string })
            : undefined;
        const previewId =
          typeof details?.previewId === "string" && /^[0-9a-f-]{36}$/i.test(details.previewId)
            ? details.previewId
            : undefined;
        let imagePath: string | undefined;
        if (error instanceof SheetDisplayError) {
          // Evaluated preview (marks table) when answers were scored before identity failed.
          imagePath = await storePdfPageThumb(batch.id, page, error.displayJpeg, {
            alreadyUpright: true,
          });
        } else if (sheet) {
          imagePath = await storePdfPageThumb(batch.id, page, sheet.jpeg);
        }
        batch.items.push({
          page,
          previewId,
          imagePath,
          rollNo: typeof details?.rollNo === "string" ? details.rollNo : undefined,
          error: error instanceof AppError ? error.message : "Could not read this page",
        });
      }
      touchBatch(batch);
    }
    if (!batch.cancelled) await finalizeDuplicateRolls(batch);
  } finally {
    batch.finished = true;
    await reader.close().catch(() => undefined);
    await removeOmrPath(batch.pdfPath);
    batch.pdfPath = null;
    if (batch.cancelled) await dropBatchFiles(batch);
    else persistBatch(batch);
  }
}

function ownPdfBatch(context: ScanContext, batchId: string) {
  purgeExpiredPdfBatches();
  const batch = getPdfBatch(batchId);
  if (!batch || batch.cancelled || batch.owner !== ownerOf(context)) {
    throw new AppError(410, "PDF batch expired. Upload the PDF again.");
  }
  touchBatch(batch);
  return batch;
}

function pdfBatchItemDto(item: PdfBatchItem) {
  const row = item.previewId ? getPending(item.previewId) : undefined;
  return {
    page: item.page,
    error: item.error,
    duplicateOf: item.duplicateOf,
    rollNo: item.rollNo,
    demoted: item.demoted,
    hasImage: Boolean(item.imagePath),
    /** Saved (or expired) sheets are no longer pending and are left out. */
    preview:
      row && item.previewId
        ? { previewId: item.previewId, scan: unsavedDto(item.previewId, row, false) }
        : undefined,
  };
}

/** Progress plus sheets finished from index `from` on, so the page only downloads new sheets. */
export function pdfBatchStatus(context: ScanContext, batchId: string, from = 0) {
  const batch = ownPdfBatch(context, batchId);
  return {
    batchId: batch.id,
    fileName: batch.fileName,
    testId: batch.testId,
    examPattern: batch.examPattern,
    pageCount: batch.pageCount,
    done: batch.items.length,
    finished: batch.finished,
    items: batch.items.slice(from).map(pdfBatchItemDto),
    // Pages demoted after the client already pulled them as successful previews.
    demotions: batch.items
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => Boolean(item.demoted && item.error) && index < from)
      .map(({ item }) => pdfBatchItemDto(item)),
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
    examPattern: latest.examPattern,
    pageCount: latest.pageCount,
    done: latest.items.length,
    finished: latest.finished,
  };
}

/** Stops reading and drops sheets that were not saved. */
export function dismissPdfBatch(context: ScanContext, batchId: string) {
  const batch = ownPdfBatch(context, batchId);
  batch.cancelled = true;
  persistBatch(batch);
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
  identity: {
    rollNo?: string;
    testId?: string;
    schoolId?: string;
    examPattern?: string;
    /** When set and the roll is not on the roster, save as a walk-in for the test ID's class. */
    studentName?: string;
    /** Walk-in section; omit → Section A (or whole-class when the school has no sections). */
    sectionId?: string;
    /** Walk-in class/program from PDF majority (fallback: answer key). */
    classLevel?: number;
    programCode?: string;
    flat?: boolean;
    /** Failed PDF thumb was already rotated at scan time — skip re-upright on save. */
    upright?: boolean;
    lean?: boolean;
    corners?: SheetCorners;
  } = {},
) {
  if (image.length > IMAGE_MAX) throw new AppError(413, "OMR image is too large (max 8 MB)");
  if (!identity.flat) void keepSample(image, fileName || "omr.jpg");
  const typedRoll = (identity.rollNo ?? "").replace(/\D/g, "");
  const typedTest = (identity.testId ?? "").trim();
  const walkInName = titleCase((identity.studentName ?? "").trim()).slice(0, 120);
  const walkInSectionId =
    typeof identity.sectionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.sectionId.trim())
      ? identity.sectionId.trim()
      : undefined;
  const walkInClassHint =
    typeof identity.classLevel === "number" &&
    Number.isInteger(identity.classLevel) &&
    identity.classLevel >= 1 &&
    identity.classLevel <= 12
      ? identity.classLevel
      : undefined;
  const walkInProgramHint =
    typeof identity.programCode === "string" && identity.programCode.trim()
      ? identity.programCode.trim().toUpperCase()
      : undefined;
  /** Client may omit this — resolved from the student's class/section after identity is known. */
  let examPattern = parseExamPattern(identity.examPattern);
  const preferredSchoolId =
    typeof identity.schoolId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.schoolId)
      ? identity.schoolId
      : undefined;
  // Empty reg + name is allowed — shared blank is empty string (not 0000000).
  const blankWalkIn =
    Boolean(walkInName) &&
    (typedRoll.length === 0 || studentService.isSharedBlankRoll(typedRoll));
  const effectiveRoll = blankWalkIn ? "" : typedRoll;
  // Failed-page save (typed reg or empty-reg walk-in): evaluate with current test key.
  const recoverySave = Boolean(identity.flat && (/^\d{7}$/.test(effectiveRoll) || blankWalkIn));
  let sheetImage = image;
  if (recoverySave && !identity.upright) {
    // Fast 0°/180° only — failed thumbs are usually already upright from scan.
    sheetImage = await ensureUprightSource(image, { flat: true });
  }
  const read = await readQueued(sheetImage, fileName, {
    // "" = empty-reg walk-in (skip bubbles). 7 digits = typed. undefined = read bubbles.
    rollNo: blankWalkIn ? "" : /^\d{7}$/.test(effectiveRoll) ? effectiveRoll : undefined,
    testId: typedTest,
    flat: identity.flat,
    corners: recoverySave ? undefined : identity.corners,
    alreadyUpright: recoverySave,
  });
  const sessionSchool = contextSchool(context);

  type Enrolled = Awaited<ReturnType<typeof resolveStudent>>;
  let enrolled: Enrolled | null = null;
  let identityError: AppError | null = null;
  // Empty reg + name → always create a new shared-blank student (do not match existing).
  const forceWalkIn = blankWalkIn;
  if (!forceWalkIn) {
    try {
      // Typed registration is authoritative — do not fall back to a different bubble read.
      enrolled = await resolveStudent(
        sessionSchool,
        typedRoll ? [typedRoll] : [read.rollNo, ...read.rollCandidates],
        preferredSchoolId,
      );
    } catch (error) {
      if (isNoStudentError(error) && walkInName) {
        // Continue into walk-in enrollment below.
      } else if (error instanceof AppError) {
        identityError = error;
      } else {
        const display = await failedPageDisplayJpeg(read);
        await rethrowWithDisplay(error, display);
      }
    }
  }

  const school: ScanSchool | null = enrolled
    ? (sessionSchool ?? {
        id: enrolled.school.id,
        name: enrolled.school.name,
        type: "type" in enrolled.school ? (enrolled.school.type as SchoolType) : SchoolType.REGULAR,
      })
    : sessionSchool ??
      (preferredSchoolId
        ? await loadScanSchool(preferredSchoolId)
        : majoritySchoolFromPending(context));

  if (!school) {
    throw new SheetDisplayError(
      422,
      identityError?.message ?? "Pick a school to save an unregistered student.",
      await failedPageDisplayJpeg(read),
      identityError?.details,
    );
  }

  const visibleKeys = (await answerKeyRepository.findAnswerKeys({})).filter((key) => keyVisibleTo(key, school));
  const known = visibleKeys.map((key) => key.testId?.trim() ?? "").filter(Boolean);
  // Entered test ID is authoritative — never fall back to OCR guesses.
  let testId: string;
  if (typedTest) {
    testId = known.find((id) => id.toUpperCase() === typedTest.toUpperCase()) ?? "";
    if (!testId) {
      const display = await failedPageDisplayJpeg(read);
      throw new SheetDisplayError(
        422,
        `No answer key for test ID ${typedTest} at ${school.name}.`,
        display,
      );
    }
  } else if (enrolled) {
    testId = pickTestId([read.testId, ...read.testCandidates], known, [
      typedRoll,
      enrolled.rollNo,
      read.rollNo,
      ...read.rollCandidates,
    ].filter(Boolean));
    if (!testId) {
      throw new SheetDisplayError(
        422,
        "Enter the test ID from the answer key, then scan again.",
        await failedPageDisplayJpeg(read),
      );
    }
  } else if (identityError) {
    throw new SheetDisplayError(
      422,
      "Enter the test ID from the answer key, then scan again.",
      await failedPageDisplayJpeg(read),
      identityError.details,
    );
  } else {
    throw new SheetDisplayError(
      422,
      "Enter the test ID from the answer key, then scan again.",
      await failedPageDisplayJpeg(read),
    );
  }

  let key!: ScanKey;
  let identityRoll: string;
  let identityName: string;
  let identityClass: number;
  let identitySection: string;
  let identityProgram: string;
  let studentId: string | null;

  if (enrolled) {
    try {
      const resolved = await resolveKey(school, [testId], {
        name: enrolled.name,
        rollNo: enrolled.rollNo,
        classLevel: enrolled.classLevel,
        programCode: enrolled.program?.code ?? null,
        sectionId: enrolled.sectionId ?? enrolled.section?.id ?? null,
      });
      key = resolved.key;
    } catch (error) {
      // Wrong class/program for this test — still score vs the test key; examiner rebinds reg later.
      if (error instanceof AppError) {
        identityError = error;
        enrolled = null;
      } else {
        const display = await failedPageDisplayJpeg(read);
        await rethrowWithDisplay(error, display);
      }
    }
  }

  if (enrolled) {
    identityRoll = enrolled.rollNo;
    identityName = enrolled.name || read.printedName;
    identityClass = enrolled.classLevel;
    identitySection = displaySectionName(enrolled.section?.name);
    identityProgram = enrolled.program?.name || programNameOf(context, key);
    studentId = enrolled.schoolId === school.id ? enrolled.id : null;
  } else if (walkInName.length >= 2) {
    // Empty reg allowed with name; otherwise require exactly 7 digits.
    if (
      typedRoll.length > 0 &&
      typedRoll.length !== 7 &&
      !studentService.isSharedBlankRoll(typedRoll)
    ) {
      throw new AppError(422, "Registration number must be 7 digits, or empty with a name");
    }
    const walkInRoll = effectiveRoll;
    key = await resolveWalkInKey(school, testId);
    // Class/program: PDF majority (client or pending), else answer key.
    const majority = majorityPlacementFromPending(context);
    const walkInClass = walkInClassHint ?? majority.classLevel ?? key.classLevel;
    const walkInProgram =
      walkInProgramHint ?? majority.programCode ?? key.programCode;
    // Section: examiner pick, else A (resolveWalkInSectionId). No sections → no dropdown / whole-class A.
    const createdDto = await studentService.createWalkInFromOmr({
      schoolId: school.id,
      name: walkInName,
      rollNo: walkInRoll,
      programCode: walkInProgram,
      classLevel: walkInClass,
      sectionId: walkInSectionId ?? null,
    });
    // Load by id — blank roll is shared, so roll lookup is ambiguous.
    const created = await studentRepository.findStudentById(createdDto.id);
    if (!created || created.status !== "ACTIVE") {
      throw new AppError(500, "Student was added but could not be loaded for this OMR.");
    }
    enrolled = created;
    ({ key } = await resolveKey(school, [testId], {
      name: created.name,
      rollNo: created.rollNo,
      classLevel: created.classLevel,
      programCode: created.program?.code ?? null,
      sectionId: created.sectionId ?? created.section?.id ?? null,
    }));
    identityRoll = created.rollNo;
    identityName = created.name || walkInName;
    identityClass = created.classLevel;
    identitySection = displaySectionName(created.section?.name);
    identityProgram = created.program?.name || programNameOf(context, key);
    studentId = created.id;
  } else if (identityError) {
    // Score now with the test-ID key; bind registration later without re-reading bubbles.
    const evalKey = await resolveWalkInKey(school, testId);
    const bubbleRoll = [typedRoll, read.rollNo, ...read.rollCandidates].find((roll) =>
      /^\d{7}$/.test(roll),
    );
    examPattern =
      examPattern ??
      (await resolveClassExamPattern(school.id, evalKey.classLevel));
    await storeNeedsIdentityPreview({
      context,
      school,
      key: evalKey,
      read,
      image,
      fileName,
      examPattern,
      lean: identity.lean,
      flat: identity.flat,
      rollNo: bubbleRoll || "",
      studentName: read.printedName || "",
      identityError,
      details: identityError.details,
    });
    throw new AppError(500, "OMR identity recovery store failed");
  } else {
    throw new AppError(422, "Enter the student name");
  }

  examPattern =
    (await resolveClassExamPattern(
      school.id,
      identityClass,
      enrolled?.sectionId ?? enrolled?.section?.id ?? null,
    )) ||
    examPattern ||
    "MPCB";

  const score = scoreWithKey(read.answers, key, { examPattern });
  if (score.subjectScores.length === 0) {
    throw new AppError(
      422,
      `Answer key for ${testId} has no subjects for exam pattern ${examPattern}.`,
    );
  }
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
      rollNo: identityRoll,
      testId: key.testId ?? testId,
      examDate: validDate(read.examDate) || null,
      studentName: identityName,
      classLevel: identityClass,
      sectionName: identitySection,
      programName: identityProgram,
    },
    answers: read.answers,
    flags: sheetFlags(score, read.flags),
    score,
    examPattern,
    confidence: read.confidence,
    diskDir: stored.dir,
    sheetBytes: stored.sheetBytes,
    // Large PDF batches skip bubble maps — re-mark isn't needed for review/save.
    bubbles: identity.lean || !read.bubbles?.points.length ? undefined : read.bubbles,
    fileName: fileName || "omr.jpg",
    studentId,
  };
  pending.set(previewId, row);
  persistPending(previewId, row);
  return { previewId, scan: unsavedDto(previewId, row, !identity.lean) };
}

/** The uploaded photo / PDF page, or the marked copy, of a sheet that is not saved yet. */
export async function getPreviewImage(context: ScanContext, previewId: string, kind: ScanImageKind) {
  const row = getPending(previewId);
  if (!row || row.expires < Date.now() || ownerOf(row.context) !== ownerOf(context)) {
    throw new AppError(404, "Scan expired. Scan again.");
  }
  touchPending(previewId, row);
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
  const row = getPending(previewId);
  if (!row || row.expires < Date.now()) {
    if (row) void removePendingDir(row.diskDir);
    pending.delete(previewId);
    throw new AppError(410, "Scan expired. Scan again.");
  }
  if (ownerOf(row.context) !== ownerOf(context)) {
    throw new AppError(403, "This preview belongs to another session");
  }
  const clean = rollNo.replace(/\D/g, "");
  if (!/^\d{7}$/.test(clean)) {
    throw new AppError(422, "Registration number must be 7 digits");
  }
  if (clean === row.identity.rollNo && row.studentId) {
    touchPending(previewId, row);
    return;
  }
  const enrolled = await resolveStudent(row.school, [clean]);
  const { key } = await resolveKey(row.school, [row.identity.testId], {
    name: enrolled.name,
    rollNo: enrolled.rollNo,
    classLevel: enrolled.classLevel,
    programCode: enrolled.program?.code ?? null,
    sectionId: enrolled.sectionId ?? enrolled.section?.id ?? null,
  });
  const nextPattern = await resolveClassExamPattern(
    row.school.id,
    enrolled.classLevel,
    enrolled.sectionId ?? enrolled.section?.id ?? null,
  );
  const keyChanged = key.id !== row.key.id;
  const patternChanged = nextPattern !== row.examPattern;
  if (keyChanged || patternChanged) {
    const readFlags = row.flags.filter((flag) => flag.reason !== "Un-attempted");
    if (row.bubbles) {
      const sheet = await loadPendingImage(row.diskDir, "sheet");
      const { score, image } = await evaluatedImage(sheet, row.bubbles, row.answers, key, {
        examPattern: nextPattern,
      });
      row.score = score;
      await replacePendingPreview(row.diskDir, image);
    } else {
      row.score = scoreWithKey(row.answers, key, { examPattern: nextPattern });
    }
    row.flags = sheetFlags(row.score, readFlags);
    row.key = { ...row.key, ...key };
    row.examPattern = nextPattern;
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
  row.needsIdentity = false;
  touchPending(previewId, row);
}

/**
 * Bind registration / walk-in name onto an already-scored pending — does not re-read bubbles.
 */
export async function bindPendingIdentity(
  context: ScanContext,
  previewId: string,
  identity: {
    rollNo?: string;
    studentName?: string;
    schoolId?: string;
    sectionId?: string;
    classLevel?: number;
    programCode?: string;
  } = {},
) {
  const row = getPending(previewId);
  if (!row || row.expires < Date.now()) {
    if (row) void removePendingDir(row.diskDir);
    pending.delete(previewId);
    throw new AppError(410, "Scan expired. Scan again.");
  }
  if (ownerOf(row.context) !== ownerOf(context)) {
    throw new AppError(403, "This preview belongs to another session");
  }

  const typedRoll = (identity.rollNo ?? "").replace(/\D/g, "");
  const walkInName = titleCase((identity.studentName ?? "").trim()).slice(0, 120);
  const blankWalkIn =
    Boolean(walkInName) &&
    (typedRoll.length === 0 || studentService.isSharedBlankRoll(typedRoll));
  const preferredSchoolId =
    typeof identity.schoolId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.schoolId)
      ? identity.schoolId
      : undefined;
  const walkInSectionId =
    typeof identity.sectionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.sectionId.trim())
      ? identity.sectionId.trim()
      : undefined;
  const walkInClassHint =
    typeof identity.classLevel === "number" &&
    Number.isInteger(identity.classLevel) &&
    identity.classLevel >= 1 &&
    identity.classLevel <= 12
      ? identity.classLevel
      : undefined;
  const walkInProgramHint =
    typeof identity.programCode === "string" && identity.programCode.trim()
      ? identity.programCode.trim().toUpperCase()
      : undefined;

  if (preferredSchoolId && preferredSchoolId !== row.school.id) {
    row.school = await loadScanSchool(preferredSchoolId);
  }

  type Enrolled = Awaited<ReturnType<typeof resolveStudent>>;
  let enrolled: Enrolled | null = null;

  if (blankWalkIn) {
    const majority = majorityPlacementFromPending(context);
    const walkInClass = walkInClassHint ?? majority.classLevel ?? row.key.classLevel;
    const walkInProgram =
      walkInProgramHint ?? majority.programCode ?? row.key.programCode;
    const createdDto = await studentService.createWalkInFromOmr({
      schoolId: row.school.id,
      name: walkInName,
      rollNo: "",
      programCode: walkInProgram,
      classLevel: walkInClass,
      sectionId: walkInSectionId ?? null,
    });
    const created = await studentRepository.findStudentById(createdDto.id);
    if (!created || created.status !== "ACTIVE") {
      throw new AppError(500, "Student was added but could not be loaded for this OMR.");
    }
    enrolled = created;
  } else {
    if (!/^\d{7}$/.test(typedRoll)) {
      throw new AppError(422, "Enter the 7-digit registration number, or leave it empty with a name");
    }
    try {
      enrolled = await resolveStudent(row.school, [typedRoll], preferredSchoolId);
    } catch (error) {
      if (!isNoStudentError(error) || walkInName.length < 2) throw error;
      const majority = majorityPlacementFromPending(context);
      const walkInClass = walkInClassHint ?? majority.classLevel ?? row.key.classLevel;
      const walkInProgram =
        walkInProgramHint ?? majority.programCode ?? row.key.programCode;
      const createdDto = await studentService.createWalkInFromOmr({
        schoolId: row.school.id,
        name: walkInName,
        rollNo: typedRoll,
        programCode: walkInProgram,
        classLevel: walkInClass,
        sectionId: walkInSectionId ?? null,
      });
      const created = await studentRepository.findStudentById(createdDto.id);
      if (!created || created.status !== "ACTIVE") {
        throw new AppError(500, "Student was added but could not be loaded for this OMR.");
      }
      enrolled = created;
    }
  }

  if (enrolled.schoolId !== row.school.id) {
    row.school = {
      id: enrolled.school.id,
      name: enrolled.school.name,
      type: "type" in enrolled.school ? (enrolled.school.type as SchoolType) : SchoolType.REGULAR,
    };
  }

  const { key } = await resolveKey(row.school, [row.identity.testId], {
    name: enrolled.name,
    rollNo: enrolled.rollNo,
    classLevel: enrolled.classLevel,
    programCode: enrolled.program?.code ?? null,
    sectionId: enrolled.sectionId ?? enrolled.section?.id ?? null,
  });
  const nextPattern = await resolveClassExamPattern(
    row.school.id,
    enrolled.classLevel,
    enrolled.sectionId ?? enrolled.section?.id ?? null,
  );
  const keyChanged = key.id !== row.key.id;
  const patternChanged = nextPattern !== row.examPattern;
  if (keyChanged || patternChanged) {
    const readFlags = row.flags.filter((flag) => flag.reason !== "Un-attempted");
    if (row.bubbles) {
      const sheet = await loadPendingImage(row.diskDir, "sheet");
      const { score, image } = await evaluatedImage(sheet, row.bubbles, row.answers, key, {
        examPattern: nextPattern,
      });
      row.score = score;
      await replacePendingPreview(row.diskDir, image);
    } else {
      row.score = scoreWithKey(row.answers, key, { examPattern: nextPattern });
    }
    row.flags = sheetFlags(row.score, readFlags);
    row.key = { ...row.key, ...key };
    row.examPattern = nextPattern;
  }
  row.identity = {
    ...row.identity,
    rollNo: enrolled.rollNo,
    studentName: enrolled.name || walkInName || row.identity.studentName,
    classLevel: enrolled.classLevel,
    sectionName: displaySectionName(enrolled.section?.name),
    programName: enrolled.program?.name || row.identity.programName,
  };
  row.studentId = enrolled.schoolId === row.school.id ? enrolled.id : null;
  row.needsIdentity = false;
  touchPending(previewId, row);
  return { previewId, scan: unsavedDto(previewId, row, false) };
}

/** Bind reg/name onto a failed PDF page that was already scored at scan time. */
export async function recoverPdfPage(
  context: ScanContext,
  batchId: string,
  page: number,
  identity: {
    rollNo?: string;
    studentName?: string;
    schoolId?: string;
    sectionId?: string;
    classLevel?: number;
    programCode?: string;
  },
) {
  const batch = ownPdfBatch(context, batchId);
  const item = batch.items.find((row) => row.page === page);
  if (!item) throw new AppError(404, `No page ${page} in this PDF batch`);
  if (!item.previewId) {
    throw new AppError(
      422,
      "This page has no scored OMR yet. Upload the sheet again to read the answers.",
    );
  }
  const result = await bindPendingIdentity(context, item.previewId, identity);
  item.error = undefined;
  item.demoted = undefined;
  item.duplicateOf = undefined;
  item.rollNo = result.scan.rollNo;
  touchBatch(batch);
  return result;
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
    const { score, image } = await evaluatedImage(sheet, row.bubbles, row.answers, current, {
      examPattern: row.examPattern,
    });
    row.score = score;
    await replacePendingPreview(row.diskDir, image);
  } else {
    row.score = scoreWithKey(row.answers, current, { examPattern: row.examPattern });
  }
  row.flags = sheetFlags(row.score, readFlags);
  row.key = { ...row.key, ...current };
}

async function saveScan(context: ScanContext, previewId: string) {
  const row = getPending(previewId);
  if (!row || row.expires < Date.now()) {
    if (row) void removePendingDir(row.diskDir);
    pending.delete(previewId);
    throw new AppError(410, "Scan expired. Scan again.");
  }
  if (ownerOf(row.context) !== ownerOf(context)) {
    throw new AppError(403, "This preview belongs to another session");
  }
  if (row.needsIdentity) {
    throw new AppError(422, "Enter the registration number (or name) before saving this sheet.");
  }
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
