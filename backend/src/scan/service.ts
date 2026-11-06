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
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { asAnswers } from "../utils/answer-key-parse.js";
import { displaySectionName } from "../utils/section-label.js";
import { omrPageFromPdf, omrPdfPageCount } from "./pdf-pages.js";
import { readQueued } from "./queue.js";
import { markedSheetPreview } from "./marked-preview.js";
import { pickRollNo, pickTestId, type SheetRead } from "./read-sheet.js";
import * as scanRepository from "./repository.js";
import { onPaper, scoreSheet, type SheetScore } from "./score.js";

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
const PREVIEW_TTL_MS = 45 * 60 * 1000;
const PDF_BATCH_TTL_MS = 60 * 60 * 1000;

type PdfBatch = {
  expires: number;
  pdf: Buffer;
  fileName: string;
  pageCount: number;
  /** Forced test ID for every page — never OCR the header for this. */
  testId: string;
};

const pdfBatches = new Map<string, PdfBatch>();

function purgeExpiredPdfBatches() {
  const now = Date.now();
  for (const [id, batch] of pdfBatches) {
    if (batch.expires < now) pdfBatches.delete(id);
  }
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
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
  confidence: number;
  fileName: string;
  sheetImage?: string;
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  keyAnswers?: Record<string, string>;
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
  image: Buffer;
  rawImage: Buffer;
  previewImage: Buffer;
  fileName: string;
  sheetImage: string;
  studentId: string | null;
};

const pending = new Map<string, Pending>();

async function previewImage(image: Buffer, read: SheetRead, keyAnswers: unknown, score: SheetScore) {
  if (read.bubbles?.points.length) {
    try {
      return await markedSheetPreview(read.jpeg, read.bubbles, read.answers, keyAnswers, score.subjectScores);
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

function keyVisibleTo(key: ScanKey, school: ScanSchool) {
  if (school.type === SchoolType.CUSTOMIZED) {
    return key.type === SchoolType.CUSTOMIZED && key.school?.id === school.id;
  }
  return key.type === SchoolType.REGULAR;
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

type ScanStudent = { name: string; rollNo: string; classLevel: number; programCode: string | null };

/** The key must be for the student's class and program as stored in the database. */
async function resolveKey(school: ScanSchool | null, tests: string[], student: ScanStudent) {
  let lastError: unknown;
  for (const testId of tests) {
    try {
      const keys = await answerKeyRepository.findAnswerKeys({
        testId: { equals: testId.trim(), mode: "insensitive" },
      });
      const visible = (school ? keys.filter((key) => keyVisibleTo(key, school)) : keys).sort(
        (a, b) => Number(b.published) - Number(a.published),
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
      const typed = candidates.find((value) => /^\d{6,7}$/.test(value));
      throw new AppError(
        422,
        typed
          ? `No student with registration number ${typed} in this school.`
          : "Could not read the registration number. Fill the registration bubbles.",
      );
    }
    const enrolled = await studentRepository.findActiveStudentInSchool(school.id, rollNo);
    if (!enrolled) {
      throw new AppError(422, `No student with registration number ${rollNo} in this school.`);
    }
    return enrolled;
  }
  const digits = [...new Set(candidates.filter((value) => /^\d{6,7}$/.test(value)))];
  const hits = [];
  for (const roll of digits.length ? digits : [pickRollNo(candidates, [])]) {
    hits.push(...(await studentRepository.findActiveStudentsByRollNo(roll)));
  }
  const uniqueHits = [...new Map(hits.map((row) => [row.id, row])).values()];
  if (uniqueHits.length === 1) return uniqueHits[0]!;
  const rollNo = pickRollNo(candidates, uniqueHits.map((row) => row.rollNo));
  const matched = uniqueHits.filter((row) => row.rollNo.toUpperCase() === rollNo.toUpperCase());
  if (matched.length === 1) return matched[0]!;
  throw new AppError(422, `No student with registration number ${rollNo || candidates[0] || ""}.`);
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
    wrong: row.wrong,
    blank: row.blank,
    total: row.total,
    maxTotal: row.maxTotal,
    confidence: row.confidence,
    fileName: row.fileName,
    answers: asMarked((row.answers as Pending["answers"]) ?? {}),
    createdAt: row.createdAt.toISOString(),
  };
}

function unsavedDto(previewId: string, row: Pending): ScanDto {
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
    wrong: row.score.wrong,
    blank: row.score.blank,
    total: row.score.total,
    maxTotal: row.score.maxTotal,
    confidence: row.confidence,
    fileName: row.fileName,
    sheetImage: row.sheetImage,
    answers: asMarked(row.answers),
    keyAnswers: asAnswers(row.key.answers),
    createdAt: new Date().toISOString(),
  };
}

/** Entered test ID must match an answer key this school can use — checked before any sheet is read. */
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
 * Accept a multi-student OMR PDF without rasterizing every page.
 * Pages are rendered one-at-a-time via previewOmrPdfPage.
 */
export async function registerOmrPdf(
  context: ScanContext,
  pdf: Buffer,
  fileName: string,
  identity: { testId?: string } = {},
) {
  if (pdf.length > PDF_MAX) throw new AppError(413, "PDF is too large (max 500 MB)");
  if (!(identity.testId ?? "").trim()) throw new AppError(400, "Enter the test ID from the answer key before uploading");
  const { testId } = await checkTestId(context, identity.testId ?? "");
  purgeExpiredPdfBatches();
  const pageCount = await omrPdfPageCount(pdf);
  void keepSample(pdf, fileName || "omr.pdf");
  const batchId = crypto.randomUUID();
  pdfBatches.set(batchId, {
    expires: Date.now() + PDF_BATCH_TTL_MS,
    pdf,
    fileName: fileName || "omr.pdf",
    pageCount,
    testId,
  });
  return { batchId, pageCount, testId };
}

/** Render + score one page from a registered PDF batch. */
export async function previewOmrPdfPage(
  context: ScanContext,
  batchId: string,
  page: number,
  identity: { rollNo?: string; testId?: string } = {},
) {
  purgeExpiredPdfBatches();
  const batch = pdfBatches.get(batchId);
  if (!batch || batch.expires < Date.now()) {
    throw new AppError(410, "PDF batch expired. Upload the PDF again.");
  }
  if (!Number.isInteger(page) || page < 1 || page > batch.pageCount) {
    throw new AppError(400, `Page must be between 1 and ${batch.pageCount}`);
  }
  const sheet = await omrPageFromPdf(batch.pdf, page, batch.fileName);
  return previewScan(context, sheet.jpeg, sheet.fileName, {
    rollNo: identity.rollNo ?? "",
    // Batch test ID always wins — never OCR the sheet header for PDFs.
    testId: batch.testId || identity.testId || "",
    flat: true,
  });
}

/** Phone camera and laptop upload both enter here: sharp → OpenCV bubbles + Tesseract header → zod, then evaluate against the answer key. */
export async function previewScan(
  context: ScanContext,
  image: Buffer,
  fileName: string,
  identity: { rollNo?: string; testId?: string; flat?: boolean } = {},
) {
  if (image.length > IMAGE_MAX) throw new AppError(413, "OMR image is too large (max 8 MB)");
  if (!identity.flat) void keepSample(image, fileName || "omr.jpg");
  const typedRoll = (identity.rollNo ?? "").replace(/\D/g, "");
  const typedTest = (identity.testId ?? "").trim();
  const read = await readQueued(image, fileName, {
    rollNo: typedRoll,
    testId: typedTest,
    flat: identity.flat,
  });
  const sessionSchool = contextSchool(context);
  const enrolled = await resolveStudent(sessionSchool, [typedRoll, read.rollNo, ...read.rollCandidates]);
  const school: ScanSchool = sessionSchool ?? {
    id: enrolled.school.id,
    name: enrolled.school.name,
    type: "type" in enrolled.school ? (enrolled.school.type as SchoolType) : SchoolType.REGULAR,
  };
  const visibleKeys = (await answerKeyRepository.findAnswerKeys({})).filter((key) => keyVisibleTo(key, school));
  const known = visibleKeys.map((key) => key.testId?.trim() ?? "").filter(Boolean);
  // Entered test ID is authoritative — never fall back to OCR guesses.
  let testId = "";
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
  });
  const score = scoreSheet(read.answers, key.answers, key.subjectRanges, {
    correctMarks: key.correctMarks,
    wrongMarks: key.wrongMarks,
  });
  const previewId = crypto.randomUUID();
  const [preview, raw] = await Promise.all([previewImage(image, read, key.answers, score), rawJpeg(image)]);
  const sheetImage = `data:image/jpeg;base64,${preview.toString("base64")}`;
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
    flags: [
      ...score.unattempted
        .filter((question) => !read.flags.some((flag) => flag.question === question))
        .map((question) => ({ question, reason: "Un-attempted" })),
      ...read.flags.filter((flag) => onPaper(score, flag.question)),
    ].sort((a, b) => a.question - b.question),
    score,
    confidence: read.confidence,
    image: read.jpeg,
    rawImage: raw,
    previewImage: preview,
    fileName: fileName || "omr.jpg",
    sheetImage,
    studentId: enrolled.schoolId === school.id ? enrolled.id : null,
  };
  pending.set(previewId, row);
  return { previewId, scan: unsavedDto(previewId, row) };
}

export async function commitScan(context: ScanContext, previewId: string) {
  const row = pending.get(previewId);
  if (!row || row.expires < Date.now()) {
    pending.delete(previewId);
    throw new AppError(410, "Scan expired. Scan again.");
  }
  if (row.context.kind !== context.kind) throw new AppError(403, "This preview belongs to another session");
  const testId = row.identity.testId;
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
    fileSize: row.image.length,
    image: Uint8Array.from(row.image),
    rawImage: Uint8Array.from(row.rawImage),
    previewImage: Uint8Array.from(row.previewImage),
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
  pending.delete(previewId);
  notifyContentChanged({ kind: "results", schoolId: row.school.id });
  return { scan: toDto(saved) };
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

function pickImage(row: { image: Uint8Array; rawImage: Uint8Array | null; previewImage: Uint8Array | null }, kind: ScanImageKind) {
  return Buffer.from((kind === "raw" ? row.rawImage : row.previewImage) ?? row.image);
}

const safeName = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "omr";

export async function getScanImage(context: ScanContext, id: string, kind: ScanImageKind) {
  const own = contextSchool(context);
  const [row] = await scanRepository.findScanImages({ id, ...(own ? { schoolId: own.id } : {}) });
  if (!row) throw new AppError(404, "OMR not found");
  return {
    data: pickImage(row, kind),
    fileName: `${safeName(`${row.rollNo}-${row.studentName}-${row.testId}`)}-${kind === "raw" ? "omr" : "evaluated"}.jpg`,
  };
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
    const jpeg = await sharp(pickImage(row, kind)).jpeg({ quality: 82 }).toBuffer();
    const embedded = await pdf.embedJpg(jpeg);
    const scale = pageWidth / embedded.width;
    const page = pdf.addPage([pageWidth, embedded.height * scale]);
    page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: embedded.height * scale });
  }
  return {
    data: Buffer.from(await pdf.save()),
    fileName: `Class-${filter.classLevel}-Test-${filter.testNumber}-${kind === "raw" ? "omr" : "evaluated"}.pdf`,
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
