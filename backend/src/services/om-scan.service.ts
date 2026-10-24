import sharp from "sharp";
import type { Prisma } from "../generated/prisma/client.js";
import { SchoolType, type Subject } from "../generated/prisma/enums.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import * as omScanRepository from "../repositories/om-scan.repository.js";
import type { OmScanSummary } from "../repositories/om-scan.repository.js";
import * as studentRepository from "../repositories/student.repository.js";
import { AppError } from "../utils/app-error.js";
import {
  asAnswers,
  asExplanations,
  asMarkedSelections,
  asSubjectRanges,
  formatMarked,
  type KeyAnswer,
} from "../utils/answer-key-parse.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { readOmrSheet } from "../utils/omr-sheet.js";
import { scoreOmrAnswers, scoreQuestion, wrongPenaltyFor, type SubjectScore } from "../utils/omr-score.js";
import { assignedSubjects, isClassTeacherOf } from "./content-access.js";
import type { TeacherAccountDto } from "./teacher.service.js";

const KIND = "results";
const IMAGE_MAX = 8 * 1024 * 1024;

export type OmScanDto = {
  id: string;
  testId: string;
  testNumber: number;
  rollNo: string;
  /** Class teacher has pushed this class's results for this test to students and subject teachers. */
  released: boolean;
  /** YYYY-MM-DD as entered by the teacher; null for scans made before it was recorded. */
  examDate: string | null;
  student: {
    id: string;
    name: string;
    rollNo: string;
    classLevel: number;
    sectionName: string | null;
    programCode: string;
    programName: string;
  };
  answers: Record<string, string>;
  flags: Array<{ question: number; reason: string }>;
  subjectScores: SubjectScore[];
  correct: number;
  wrong: number;
  blank: number;
  partial: number;
  total: number;
  maxTotal: number;
  rank: number | null;
  classSize: number | null;
  /** Class teacher: every subject. Subject teacher: only assigned subjects. */
  view: "class" | "subject";
  fileName: string;
  createdAt: string;
  updatedAt: string;
  /** Student-only: their bubble vs the key, with the explanation. */
  review?: OmQuestionReview[];
};

export type OmQuestionReview = {
  question: number;
  marked: string | null;
  key: KeyAnswer | null;
  result: "OK" | "PARTIAL" | "WRONG" | "BLANK" | "INVALID" | "BONUS";
  marks: number;
  explanation: string;
  subject: Subject | null;
};

type StudentSlot = {
  programCode: string;
  programId: string;
  classLevel: number;
  sectionId: string | null;
};

function studentSlot(row: OmScanSummary): StudentSlot {
  return {
    programCode: row.student.program.code,
    programId: row.student.programId,
    classLevel: row.student.classLevel,
    sectionId: row.student.sectionId,
  };
}

const WHOLE_CLASS = "class";

function sectionKeyOf(sectionId: string | null) {
  return sectionId ?? WHOLE_CLASS;
}

function releaseKey(testId: string, programId: string, classLevel: number, sectionKey: string) {
  return [testId, programId, classLevel, sectionKey].join(":");
}

function rowReleaseKey(row: OmScanSummary) {
  return releaseKey(row.testId, row.student.programId, row.student.classLevel, sectionKeyOf(row.student.sectionId));
}

async function releasedKeys(schoolId: string, testIds?: string[]) {
  const rows = await omScanRepository.findOmResultReleases({
    schoolId,
    published: true,
    ...(testIds ? { testId: { in: testIds } } : {}),
  });
  return new Set(rows.map((row) => releaseKey(row.testId, row.programId, row.classLevel, row.sectionKey)));
}

function toDto(row: OmScanSummary, view: "class" | "subject" = "class", released = false): OmScanDto {
  return {
    id: row.id,
    testId: row.testId,
    testNumber: row.answerKey.testNumber,
    rollNo: row.rollNo,
    released,
    examDate: row.examDate ? row.examDate.toISOString().slice(0, 10) : null,
    student: {
      id: row.student.id,
      name: row.student.name,
      rollNo: row.student.rollNo,
      classLevel: row.student.classLevel,
      sectionName: row.student.section?.name ?? null,
      programCode: row.student.program.code,
      programName: row.student.program.name,
    },
    answers: Object.fromEntries(
      Object.entries(asMarkedSelections(row.answers)).map(([question, options]) => [question, formatMarked(options)]),
    ),
    flags: Array.isArray(row.flags) ? (row.flags as OmScanDto["flags"]) : [],
    subjectScores: row.subjectScores as SubjectScore[],
    correct: row.correct,
    wrong: row.wrong,
    blank: row.blank,
    partial: (row.subjectScores as SubjectScore[]).reduce((sum, band) => sum + (band.partial ?? 0), 0),
    total: row.total,
    maxTotal: row.maxTotal,
    rank: row.rank,
    classSize: row.classSize,
    view,
    fileName: row.fileName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function clipToSubjects(dto: OmScanDto, subjects: Subject[]): OmScanDto {
  const subjectScores = dto.subjectScores.filter((row) => subjects.includes(row.subject));
  const questions = new Set(
    subjectScores.flatMap((row) => {
      const ids: number[] = [];
      for (let question = row.from; question <= row.to; question++) ids.push(question);
      return ids;
    }),
  );
  const answers = Object.fromEntries(
    Object.entries(dto.answers).filter(([question]) => questions.has(Number(question))),
  );
  return {
    ...dto,
    view: "subject",
    answers,
    flags: dto.flags.filter((row) => questions.has(row.question)),
    subjectScores,
    correct: subjectScores.reduce((sum, row) => sum + row.correct, 0),
    wrong: subjectScores.reduce((sum, row) => sum + row.wrong, 0),
    blank: subjectScores.reduce((sum, row) => sum + row.blank, 0),
    partial: subjectScores.reduce((sum, row) => sum + (row.partial ?? 0), 0),
    total: subjectScores.reduce((sum, row) => sum + row.total, 0),
    maxTotal: subjectScores.reduce((sum, row) => sum + row.maxTotal, 0),
    rank: null,
    classSize: null,
  };
}

/** Class teacher sees every scan first; subject teachers only once the class teacher releases it. */
function projectForTeacher(row: OmScanSummary, teacher: TeacherAccountDto, released: Set<string>): OmScanDto | null {
  const student = studentSlot(row);
  const isReleased = released.has(rowReleaseKey(row));
  if (isClassTeacherOf(teacher, student)) return toDto(row, "class", isReleased);
  if (!isReleased) return null;
  const subjects = assignedSubjects(teacher, student);
  if (subjects.length === 0) return null;
  return clipToSubjects(toDto(row, "subject", true), subjects);
}

function assignRanks(items: OmScanDto[]): OmScanDto[] {
  const groups = new Map<string, OmScanDto[]>();
  for (const row of items) {
    const key = [
      row.testId,
      row.student.programCode,
      String(row.student.classLevel),
      row.view,
      row.view === "class" ? (row.student.sectionName ?? "") : row.subjectScores.map((s) => s.subject).sort().join(","),
    ].join(":");
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const ranked: OmScanDto[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => b.total - a.total || a.rollNo.localeCompare(b.rollNo));
    sorted.forEach((row, index) => {
      ranked.push({ ...row, rank: index + 1, classSize: sorted.length });
    });
  }
  return ranked.sort((a, b) => a.rollNo.localeCompare(b.rollNo));
}

async function jpegPreview(image: Buffer) {
  return sharp(image)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}

async function recomputeRanks(schoolId: string, testId: string, classLevel: number) {
  const rows = await omScanRepository.findOmScans({
    schoolId,
    testId,
    student: { classLevel },
  });
  const classSize = rows.length;
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.rollNo.localeCompare(b.rollNo));
  await Promise.all(
    sorted.map((row, index) =>
      omScanRepository.updateOmScan(row.id, { rank: index + 1, classSize }),
    ),
  );
}

function applyScore(
  score: ReturnType<typeof scoreOmrAnswers>,
): Pick<
  Prisma.OmScanUncheckedCreateInput,
  "subjectScores" | "correct" | "wrong" | "blank" | "total" | "maxTotal"
> {
  return {
    subjectScores: score.subjectScores as Prisma.InputJsonValue,
    correct: score.correct,
    wrong: score.wrong,
    blank: score.blank,
    total: score.total,
    maxTotal: score.maxTotal,
  };
}

export type OmScanIdentity = { rollNo: string; testId: string; examDate: string };

export type OmScanTarget = {
  student: {
    name: string;
    rollNo: string;
    classLevel: number;
    sectionName: string | null;
    programCode: string;
    programName: string;
  };
  test: {
    testId: string;
    testNumber: number;
    classLevel: number;
    programCode: string;
    questions: number;
  };
  /** Set when this student already has a scan for this test; a new scan replaces it. */
  previous: { total: number; maxTotal: number; scannedAt: string } | null;
};

/**
 * The teacher types roll no and test ID; everything else (program, class, section, test number)
 * comes from the roster and the published key, so nothing is read from handwriting.
 */
async function resolveTarget(teacher: TeacherAccountDto, identity: Pick<OmScanIdentity, "rollNo" | "testId">) {
  const [student, keys] = await Promise.all([
    studentRepository.findActiveStudentInSchool(teacher.schoolId, identity.rollNo),
    answerKeyRepository.findAnswerKeys({
      testId: { equals: identity.testId.trim(), mode: "insensitive" },
      published: true,
      ...(teacher.school.type === SchoolType.CUSTOMIZED
        ? { schoolId: teacher.schoolId }
        : { type: SchoolType.REGULAR }),
    }),
  ]);
  if (!student) throw new AppError(404, `No active student with roll no ${identity.rollNo.trim()} in your school`);
  const key = keys[0];
  if (!key) throw new AppError(404, `No published answer key for test ID ${identity.testId.trim()}`);
  if (
    !isClassTeacherOf(teacher, {
      programCode: student.program.code,
      programId: student.programId,
      classLevel: student.classLevel,
      sectionId: student.sectionId,
    })
  ) {
    const section = student.section?.name ? `-${student.section.name}` : "";
    throw new AppError(403, `Only the class teacher of class ${student.classLevel}${section} can scan ${student.name}'s sheet`);
  }
  if (key.programCode !== student.program.code || key.classLevel !== student.classLevel) {
    throw new AppError(
      422,
      `Test ${key.testId} is for ${key.programCode} class ${key.classLevel}; ${student.name} is in ${student.program.code} class ${student.classLevel}`,
    );
  }
  return { student, key };
}

function keyQuestionCount(key: { answers: unknown; subjectRanges: unknown }) {
  const ranges = asSubjectRanges(key.subjectRanges);
  return ranges.length ? Math.max(...ranges.map((row) => row.to)) : Object.keys(asAnswers(key.answers)).length;
}

export async function previewOmScanTarget(
  teacher: TeacherAccountDto,
  identity: Pick<OmScanIdentity, "rollNo" | "testId">,
): Promise<OmScanTarget> {
  const { student, key } = await resolveTarget(teacher, identity);
  const previous = await omScanRepository.findOmScanId(student.id, key.testId);
  return {
    student: {
      name: student.name,
      rollNo: student.rollNo,
      classLevel: student.classLevel,
      sectionName: student.section?.name ?? null,
      programCode: student.program.code,
      programName: student.program.name,
    },
    test: {
      testId: key.testId,
      testNumber: key.testNumber,
      classLevel: key.classLevel,
      programCode: key.programCode,
      questions: keyQuestionCount(key),
    },
    previous: previous
      ? { total: previous.total, maxTotal: previous.maxTotal, scannedAt: previous.updatedAt.toISOString() }
      : null,
  };
}

export async function scanOmrSheet(
  teacher: TeacherAccountDto,
  identity: OmScanIdentity,
  image: Buffer,
  fileName: string,
) {
  if (image.length > IMAGE_MAX) throw new AppError(413, "OMR image is too large (max 8 MB)");

  const { student, key } = await resolveTarget(teacher, identity);
  const read = await readOmrSheet(image, { identity: false });
  if (!read.ok) throw new AppError(422, read.reason);

  const score = scoreOmrAnswers(read.answers, key.answers, key.subjectRanges, {
    wrongPenalty: wrongPenaltyFor(teacher.school.type),
  });
  const preview = await jpegPreview(image);
  const saved = await omScanRepository.upsertOmScan(student.id, key.testId, {
    schoolId: teacher.schoolId,
    studentId: student.id,
    answerKeyId: key.id,
    testId: key.testId,
    rollNo: student.rollNo,
    examDate: new Date(`${identity.examDate}T00:00:00Z`),
    answers: read.answers as Prisma.InputJsonValue,
    flags: read.flags as Prisma.InputJsonValue,
    ...applyScore(score),
    fileName: fileName || "omr.jpg",
    fileSize: preview.length,
    image: preview,
    scannedById: teacher.id,
  });
  await recomputeRanks(teacher.schoolId, key.testId, student.classLevel);
  notifyContentChanged({ kind: KIND, schoolId: teacher.schoolId });
  const peers = await listTeacherOmScans(teacher, key.testId);
  const scan = peers.find((row) => row.id === saved.id);
  if (!scan) throw new AppError(403, "You are not assigned to this student's class");
  return {
    scan,
    read: {
      rollNo: student.rollNo,
      testId: key.testId,
      studentName: student.name,
      examDate: identity.examDate,
      markCount: read.markCount,
      flags: read.flags,
    },
  };
}

export async function rescoreOmScansForKey(answerKeyId: string) {
  const key = await answerKeyRepository.findAnswerKeyById(answerKeyId);
  if (!key) return 0;
  const rows = await omScanRepository.findOmScansForKey(answerKeyId);
  if (rows.length === 0) return 0;
  for (const row of rows) {
    const score = scoreOmrAnswers(row.answers, key.answers, key.subjectRanges, {
      wrongPenalty: wrongPenaltyFor(row.school.type),
    });
    await omScanRepository.updateOmScan(row.id, applyScore(score));
  }
  const ranked = await omScanRepository.findOmScans({ answerKeyId });
  const groups = new Map<string, { schoolId: string; classLevel: number }>();
  for (const row of ranked) {
    groups.set(`${row.schoolId}:${row.student.classLevel}`, {
      schoolId: row.schoolId,
      classLevel: row.student.classLevel,
    });
  }
  for (const group of groups.values()) {
    await recomputeRanks(group.schoolId, key.testId, group.classLevel);
  }
  notifyContentChanged({ kind: KIND, schoolId: key.school?.id ?? null });
  return rows.length;
}

export async function listTeacherOmScans(teacher: TeacherAccountDto, testId?: string) {
  const [rows, released] = await Promise.all([
    omScanRepository.findOmScans({
      schoolId: teacher.schoolId,
      ...(testId ? { testId } : {}),
    }),
    releasedKeys(teacher.schoolId, testId ? [testId] : undefined),
  ]);
  return assignRanks(rows.flatMap((row) => {
    const dto = projectForTeacher(row, teacher, released);
    return dto ? [dto] : [];
  }));
}

export type OmScanViewer = { kind: "admin" } | { kind: "teacher"; teacher: TeacherAccountDto } | { kind: "released" };

/** Scans for one test that this viewer may see: admin all, class teacher their class, others released only. */
export async function findVisibleOmScans(schoolId: string, testId: string, viewer: OmScanViewer) {
  const rows = await omScanRepository.findOmScans({ schoolId, testId });
  if (viewer.kind === "admin") return rows;
  const released = await releasedKeys(schoolId, [testId]);
  return rows.filter(
    (row) =>
      released.has(rowReleaseKey(row)) ||
      (viewer.kind === "teacher" && isClassTeacherOf(viewer.teacher, studentSlot(row))),
  );
}

export type OmResultReleaseDto = {
  testId: string;
  testNumber: number;
  programId: string;
  programName: string;
  classLevel: number;
  sectionId: string | null;
  sectionName: string | null;
  scanned: number;
  published: boolean;
  publishedAt: string | null;
};

/** One row per (test × class the teacher is class teacher of) that has at least one scan. */
export async function listOmResultReleases(teacher: TeacherAccountDto): Promise<OmResultReleaseDto[]> {
  const [rows, releases] = await Promise.all([
    omScanRepository.findOmScans({ schoolId: teacher.schoolId }),
    omScanRepository.findOmResultReleases({ schoolId: teacher.schoolId }),
  ]);
  const releaseByKey = new Map(
    releases.map((row) => [releaseKey(row.testId, row.programId, row.classLevel, row.sectionKey), row]),
  );
  const slots = new Map<string, OmResultReleaseDto>();
  for (const row of rows) {
    if (!isClassTeacherOf(teacher, studentSlot(row))) continue;
    const key = rowReleaseKey(row);
    const existing = slots.get(key);
    if (existing) {
      existing.scanned += 1;
      continue;
    }
    const release = releaseByKey.get(key);
    slots.set(key, {
      testId: row.testId,
      testNumber: row.answerKey.testNumber,
      programId: row.student.programId,
      programName: row.student.program.name,
      classLevel: row.student.classLevel,
      sectionId: row.student.sectionId,
      sectionName: row.student.section?.name ?? null,
      scanned: 1,
      published: release?.published ?? false,
      publishedAt: release?.publishedAt?.toISOString() ?? null,
    });
  }
  return [...slots.values()].sort((a, b) => b.testNumber - a.testNumber || a.testId.localeCompare(b.testId));
}

export async function setOmResultRelease(
  teacher: TeacherAccountDto,
  input: { testId: string; programId: string; classLevel: number; sectionId: string | null; published: boolean },
) {
  const slot = teacher.classTeacherSections.find(
    (row) =>
      row.programId === input.programId &&
      row.classLevel === input.classLevel &&
      (row.kind === "section" ? row.sectionId === input.sectionId : input.sectionId == null),
  );
  if (!slot) throw new AppError(403, "Only the class teacher of this class can publish its results");
  await omScanRepository.upsertOmResultRelease(
    {
      schoolId: teacher.schoolId,
      testId: input.testId,
      programId: input.programId,
      classLevel: input.classLevel,
      sectionKey: sectionKeyOf(input.sectionId),
    },
    input.published,
    teacher.id,
  );
  notifyContentChanged({ kind: KIND, schoolId: teacher.schoolId });
  const releases = await listOmResultReleases(teacher);
  return (
    releases.find(
      (row) =>
        row.testId === input.testId &&
        row.programId === input.programId &&
        row.classLevel === input.classLevel &&
        row.sectionId === input.sectionId,
    ) ?? null
  );
}

function buildReview(
  answers: Record<string, string>,
  flags: OmScanDto["flags"],
  keyAnswers: Record<string, KeyAnswer>,
  explanations: Record<string, string>,
  ranges: ReturnType<typeof asSubjectRanges>,
  wrongPenalty: number,
): OmQuestionReview[] {
  const last = Math.max(0, ...ranges.map((row) => row.to), ...Object.keys(keyAnswers).map(Number));
  const flagByQ = new Map(flags.map((row) => [row.question, row.reason]));
  const markedByQ = asMarkedSelections(answers);
  const review: OmQuestionReview[] = [];
  for (let question = 1; question <= last; question++) {
    const got = markedByQ[String(question)] ?? [];
    const key = keyAnswers[String(question)] ?? null;
    const invalid = flagByQ.get(question);
    const scored = key
      ? scoreQuestion(got, key, wrongPenalty)
      : { marked: got, marks: 0, result: got.length > 0 ? ("WRONG" as const) : ("BLANK" as const) };
    const range = ranges.find((row) => question >= row.from && question <= row.to);
    review.push({
      question,
      marked: formatMarked(got) || null,
      key,
      result: invalid ? "INVALID" : scored.result,
      marks: invalid ? 0 : scored.marks,
      explanation: explanations[String(question)] ?? "",
      subject: range?.subject ?? null,
    });
  }
  return review;
}

/** Students only see tests their class teacher has published. */
export async function listStudentOmScans(studentId: string) {
  const rows = await omScanRepository.findOmScans({ studentId });
  const schoolId = rows[0]?.schoolId;
  if (!schoolId) return [];
  const released = await releasedKeys(schoolId, rows.map((row) => row.testId));
  return rows.filter((row) => released.has(rowReleaseKey(row))).map((row) => toDto(row, "class", true));
}

/** One test only, and only the signed-in student's own sheet, once published. */
export async function getStudentOmScanReview(studentId: string, testId: string): Promise<OmScanDto> {
  const row = await omScanRepository.findOmScan({ studentId, testId });
  if (!row) throw new AppError(404, "No OMR result for this test yet");
  const released = await releasedKeys(row.schoolId, [row.testId]);
  if (!released.has(rowReleaseKey(row))) throw new AppError(404, "No OMR result for this test yet");
  const dto = toDto(row, "class", true);
  const key = await answerKeyRepository.findAnswerKeyById(row.answerKeyId);
  if (!key) return { ...dto, review: [] };
  return {
    ...dto,
    review: buildReview(
      dto.answers,
      dto.flags,
      asAnswers(key.answers),
      asExplanations(key.explanations),
      asSubjectRanges(key.subjectRanges),
      wrongPenaltyFor(row.school.type),
    ),
  };
}

export async function getTeacherOmScan(teacher: TeacherAccountDto, id: string) {
  const row = await omScanRepository.findOmScan({ id, schoolId: teacher.schoolId });
  const dto = row ? projectForTeacher(row, teacher, await releasedKeys(teacher.schoolId, [row.testId])) : null;
  if (!dto) throw new AppError(404, "Scan not found");
  const peers = await listTeacherOmScans(teacher, dto.testId);
  return peers.find((peer) => peer.id === dto.id) ?? dto;
}
