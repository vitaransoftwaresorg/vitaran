import crypto from "node:crypto";
import sharp from "sharp";
import { SchoolType } from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import * as studentRepository from "../repositories/student.repository.js";
import { AppError } from "../utils/app-error.js";
import { notifyContentChanged } from "../utils/content-events.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { asAnswers } from "../utils/answer-key-parse.js";
import { readQueued } from "./queue.js";
import { pickRollNo, pickTestId } from "./read-sheet.js";
import * as scanRepository from "./repository.js";
import { scoreSheet } from "./score.js";

const IMAGE_MAX = 8 * 1024 * 1024;
const PREVIEW_TTL_MS = 10 * 60 * 1000;

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
  fileName: string;
  sheetImage: string;
  studentId: string | null;
};

const pending = new Map<string, Pending>();

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

async function resolveKey(school: ScanSchool | null, tests: string[], classLevel?: number) {
  let lastError: unknown;
  for (const testId of tests) {
    try {
      const keys = await answerKeyRepository.findAnswerKeys({
        testId: { equals: testId.trim(), mode: "insensitive" },
      });
      let visible = (school ? keys.filter((key) => keyVisibleTo(key, school)) : keys).sort(
        (a, b) => Number(b.published) - Number(a.published),
      );
      if (classLevel != null) {
        const sameClass = visible.filter((key) => key.classLevel === classLevel);
        if (sameClass.length) visible = sameClass;
      }
      if (visible.length === 0) {
        throw new AppError(404, `No answer key for test ID ${testId}${school ? ` at ${school.name}` : ""}`);
      }
      return { key: visible[0]!, school };
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

/** Phone camera and laptop upload both enter here: sharp → OpenCV bubbles + Tesseract header → zod, then evaluate against the answer key. */
export async function previewScan(
  context: ScanContext,
  image: Buffer,
  fileName: string,
  identity: { rollNo?: string; testId?: string } = {},
) {
  if (image.length > IMAGE_MAX) throw new AppError(413, "OMR image is too large (max 8 MB)");
  const typedRoll = (identity.rollNo ?? "").replace(/\D/g, "");
  const typedTest = (identity.testId ?? "").trim();
  const read = await readQueued(image, fileName, { rollNo: typedRoll, testId: typedTest });
  const sessionSchool = contextSchool(context);
  const enrolled = await resolveStudent(sessionSchool, [typedRoll, read.rollNo, ...read.rollCandidates]);
  const school: ScanSchool = sessionSchool ?? {
    id: enrolled.school.id,
    name: enrolled.school.name,
    type: "type" in enrolled.school ? (enrolled.school.type as SchoolType) : SchoolType.REGULAR,
  };
  const visibleKeys = (await answerKeyRepository.findAnswerKeys({})).filter((key) => keyVisibleTo(key, school));
  const known = visibleKeys.map((key) => key.testId?.trim() ?? "").filter(Boolean);
  const testId = pickTestId([typedTest, read.testId, ...read.testCandidates], known);
  if (!testId) {
    const handwritten = [typedTest, read.testId, ...read.testCandidates].find((value) => /^\d{1,12}$/.test(value));
    throw new AppError(
      422,
      handwritten
        ? `No answer key for test ID ${handwritten} at ${school.name}.`
        : "Could not read the test ID. Show the sheet header.",
    );
  }
  const { key } = await resolveKey(school, [testId], enrolled.classLevel);
  const score = scoreSheet(read.answers, key.answers, key.subjectRanges, {
    correctMarks: key.correctMarks,
    wrongMarks: key.wrongMarks,
  });
  const previewId = crypto.randomUUID();
  const sheetImage = `data:image/jpeg;base64,${(
    await sharp(image)
      .rotate()
      .resize({ width: 900, height: 1272, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
  ).toString("base64")}`;
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
      sectionName: enrolled.section?.name || "",
      programName: enrolled.program?.name || programNameOf(context, key),
    },
    answers: read.answers,
    flags: score.unattempted.map((question) => ({ question, reason: "Un-attempted" })),
    score,
    confidence: read.confidence,
    image: read.jpeg,
    fileName: fileName || "omr.jpg",
    sheetImage,
    studentId: enrolled.schoolId === school.id ? enrolled.id : null,
  };
  pending.set(previewId, row);
  return { previewId, scan: unsavedDto(previewId, row) };
}

export async function commitScan(context: ScanContext, previewId: string) {
  const row = pending.get(previewId);
  pending.delete(previewId);
  if (!row || row.expires < Date.now()) throw new AppError(410, "Scan expired. Scan again.");
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
    actor: context.kind,
    scannedById: context.kind === "teacher" ? context.teacher.id : null,
  });
  notifyContentChanged({ kind: "results", schoolId: row.school.id });
  return { scan: toDto(saved) };
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
