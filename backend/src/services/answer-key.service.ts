import type { Prisma } from "../generated/prisma/client.js";
import { SchoolType } from "../generated/prisma/enums.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import type {
  AnswerKeyDetail,
  AnswerKeySummary,
} from "../repositories/answer-key.repository.js";
import * as programRepository from "../repositories/program.repository.js";
import * as schoolRepository from "../repositories/school.repository.js";
import type {
  ListAnswerKeysQuery,
  SaveAnswerKeyAnswersInput,
  UpdateAnswerKeyQuery,
  UploadAnswerKeyQuery,
} from "../schemas/answer-key.schema.js";
import {
  asAnswers,
  asExplanations,
  asSubjectRanges,
  diffCorrections,
  parseAnswerKeyPdf,
} from "../utils/answer-key-parse.js";
import { AppError } from "../utils/app-error.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { logger } from "../utils/logger.js";
import { readPdf, requirePdf, toPdfData } from "../utils/pdf.js";
import { answerKeyAccessFilter, type ContentActor } from "./content-access.js";
import { toSchoolRef, type SchoolAccountDto } from "./school.service.js";

const KIND = "answer-keys";

function toAnswerKeyDto(row: AnswerKeySummary | AnswerKeyDetail, forPortal = false) {
  const answers = asAnswers(row.answers);
  const explanations = asExplanations(row.explanations);
  const printedAnswers = asAnswers(row.printedAnswers);
  const printedExplanations = asExplanations(row.printedExplanations);
  const corrections =
    Object.keys(printedAnswers).length === 0
      ? []
      : diffCorrections(printedAnswers, answers, printedExplanations, explanations);
  return {
    id: row.id,
    program: row.programCode,
    programCode: row.programCode,
    type: row.type,
    pattern: row.pattern,
    testId: row.testId,
    testNumber: row.testNumber,
    classLevel: row.classLevel,
    fileName: row.fileName,
    fileSize: row.fileSize,
    published: row.published,
    answers: forPortal ? {} : answers,
    explanations: forPortal ? {} : explanations,
    printedAnswers: forPortal ? {} : printedAnswers,
    printedExplanations: forPortal ? {} : printedExplanations,
    corrections,
    subjectRanges: asSubjectRanges(row.subjectRanges),
    answerCount: Object.keys(answers).length,
    correctionCount: corrections.length,
    school: row.school && toSchoolRef(row.school),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ParsedJsonFields = {
  answers: Prisma.InputJsonValue;
  explanations: Prisma.InputJsonValue;
  printedAnswers: Prisma.InputJsonValue;
  printedExplanations: Prisma.InputJsonValue;
  subjectRanges: Prisma.InputJsonValue;
  pattern: "MAINS" | "ADVANCED";
};

async function parsedFromPdf(pdf: Buffer): Promise<ParsedJsonFields> {
  try {
    const parsed = await parseAnswerKeyPdf(pdf);
    if (Object.keys(parsed.answers).length === 0) {
      throw new AppError(422, "Could not read answers from this PDF");
    }
    return {
      answers: parsed.answers as Prisma.InputJsonValue,
      explanations: parsed.explanations as Prisma.InputJsonValue,
      printedAnswers: parsed.answers as Prisma.InputJsonValue,
      printedExplanations: parsed.explanations as Prisma.InputJsonValue,
      subjectRanges: parsed.subjectRanges as Prisma.InputJsonValue,
      pattern: parsed.pattern,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.warn({ err: error }, "Could not parse answer key PDF");
    throw new AppError(422, "Could not read answers from this PDF");
  }
}

async function withPrintedSnapshot(row: AnswerKeyDetail): Promise<AnswerKeyDetail> {
  if (Object.keys(asAnswers(row.printedAnswers)).length > 0) return row;
  const file = await answerKeyRepository.findAnswerKeyFile({ id: row.id });
  if (!file) return row;
  try {
    const parsed = await parseAnswerKeyPdf(Buffer.from(file.data));
    if (Object.keys(parsed.answers).length === 0) return row;
    return answerKeyRepository.updateAnswerKey(row.id, {
      printedAnswers: parsed.answers as Prisma.InputJsonValue,
      printedExplanations: parsed.explanations as Prisma.InputJsonValue,
    });
  } catch (error) {
    logger.warn({ err: error, id: row.id }, "Could not snapshot printed KEY");
    return row;
  }
}

const classLevelIssue = (message: string) =>
  new AppError(400, message, [{ path: ["classLevel"], message }]);

/** Test numbers may repeat. Test IDs may not — one key per ID. */
async function assertUniqueTestId(testId: string, exceptId?: string) {
  const existing = await answerKeyRepository.findAnswerKeyByTestId(testId, exceptId);
  if (existing) {
    throw new AppError(400, "This test ID is already used", [
      { path: ["testId"], message: "This test ID is already used. Test numbers can repeat; test IDs cannot." },
    ]);
  }
}

/**
 * REGULAR → any class in the catalog program range.
 * CUSTOMIZED → only classes enrolled for that school + program.
 */
async function assertProgramClass(
  type: SchoolType,
  programCode: string,
  classLevel: number,
  schoolId: string | null,
) {
  const program = await programRepository.findProgramByCode(programCode);
  if (!program) {
    throw new AppError(400, "Select a program", [
      { path: ["program"], message: "Select a program" },
    ]);
  }

  if (type === SchoolType.REGULAR) {
    if (classLevel < program.classFrom || classLevel > program.classTo) {
      throw classLevelIssue(
        `Class ${classLevel} is outside ${program.name} (${program.classFrom}–${program.classTo})`,
      );
    }
    return;
  }

  if (!schoolId) {
    throw new AppError(400, "Select a customized school", [
      { path: ["schoolId"], message: "Select a customized school" },
    ]);
  }

  const school = await schoolRepository.findSchoolById(schoolId);
  const offering = school?.schoolPrograms.find((row) => row.program.code === programCode);
  const levels = offering?.classes.map((cls) => cls.classLevel) ?? [];
  if (!levels.includes(classLevel)) {
    throw classLevelIssue(
      levels.length === 0
        ? `This school is not enrolled in ${program.name}`
        : `This school only has classes ${levels.sort((a, b) => a - b).join(", ")} for ${program.name}`,
    );
  }
}

/** Customized keys must point at a customized school; regular keys never have one. */
async function resolveSchoolId(type: SchoolType, schoolId?: string) {
  if (type === SchoolType.REGULAR) return null;

  const school = schoolId && (await schoolRepository.findSchoolById(schoolId));
  if (!school || school.type !== SchoolType.CUSTOMIZED) {
    throw new AppError(400, "Select a customized school", [
      { path: ["schoolId"], message: "Select a customized school" },
    ]);
  }
  return school.id;
}

/**
 * Regular schools get the regular keys for their programs; customized schools get only
 * the keys uploaded for them.
 */
function schoolAccessFilter(
  school: Pick<SchoolAccountDto, "id" | "type" | "programCodes">,
): Prisma.AnswerKeyWhereInput {
  return {
    programCode: { in: school.programCodes },
    ...(school.type === SchoolType.CUSTOMIZED
      ? { schoolId: school.id }
      : { type: SchoolType.REGULAR }),
  };
}

export async function listRecentAnswerKeys({
  limit,
  testNumber,
  program,
  type,
  schoolId,
}: ListAnswerKeysQuery) {
  const where: Prisma.AnswerKeyWhereInput[] = [
    { testNumber, type, ...(program ? { programCode: program } : {}) },
  ];
  if (schoolId) {
    const school = await schoolRepository.findSchoolById(schoolId);
    if (!school) return [];
    where.push(schoolAccessFilter({
      id: school.id,
      type: school.type,
      programCodes: school.schoolPrograms.map((row) => row.program.code),
    }));
  }
  return (await answerKeyRepository.findRecentAnswerKeys({ AND: where }, limit)).map((row) => toAnswerKeyDto(row));
}

/**
 * Distinct tests (and their program/class combos) available for a school via answer keys.
 * Used by the admin results upload flow: school → test → program/class → upload.
 */
export async function listSchoolTestsForResults(schoolId: string) {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");

  const programCodes = school.schoolPrograms.map((row) => row.program.code);
  const nameByCode = new Map(school.schoolPrograms.map((row) => [row.program.code, row.program.name]));

  const keys = await answerKeyRepository.findAnswerKeys(
    schoolAccessFilter({ id: school.id, type: school.type, programCodes }),
  );

  type ProgramBucket = { code: string; name: string; classLevels: Set<number> };
  type TestBucket = {
    testId: string;
    testNumber: number;
    programs: Map<string, ProgramBucket>;
  };

  const tests = new Map<string, TestBucket>();

  for (const key of keys) {
    const testKey = `${key.testId}\0${key.testNumber}`;
    let test = tests.get(testKey);
    if (!test) {
      test = { testId: key.testId, testNumber: key.testNumber, programs: new Map() };
      tests.set(testKey, test);
    }

    let program = test.programs.get(key.programCode);
    if (!program) {
      program = {
        code: key.programCode,
        name: nameByCode.get(key.programCode) ?? key.programCode,
        classLevels: new Set(),
      };
      test.programs.set(key.programCode, program);
    }
    program.classLevels.add(key.classLevel);
  }

  return [...tests.values()]
    .map(({ testId, testNumber, programs }) => ({
      testId,
      testNumber,
      programs: [...programs.values()]
        .map(({ code, name, classLevels }) => ({
          code,
          name,
          classLevels: [...classLevels].sort((a, b) => a - b),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.testNumber - a.testNumber || a.testId.localeCompare(b.testId));
}

export async function getAnswerKeyStats() {
  const [total, published] = await Promise.all([
    answerKeyRepository.countAnswerKeys(),
    answerKeyRepository.countAnswerKeys({ published: true }),
  ]);
  return { total, published };
}

export async function getAnswerKey(id: string) {
  const answerKey = await answerKeyRepository.findAnswerKeyById(id);
  if (!answerKey) throw new AppError(404, "Answer key not found");
  return toAnswerKeyDto(await withPrintedSnapshot(answerKey));
}

export async function uploadAnswerKey(
  { schoolId, fileName, program, ...meta }: UploadAnswerKeyQuery,
  body: unknown,
) {
  const pdf = requirePdf(body);
  const resolvedSchoolId = await resolveSchoolId(meta.type, schoolId);
  await assertProgramClass(meta.type, program, meta.classLevel, resolvedSchoolId);
  await assertUniqueTestId(meta.testId);

  const parsed = await parsedFromPdf(pdf);
  return toAnswerKeyDto(
    await answerKeyRepository.createAnswerKey({
      type: meta.type,
      testId: meta.testId,
      testNumber: meta.testNumber,
      classLevel: meta.classLevel,
      programCode: program,
      schoolId: resolvedSchoolId,
      ...toPdfData(pdf, fileName ?? "answer-key.pdf"),
      ...parsed,
    }),
  );
}

export async function updateAnswerKey(
  id: string,
  { schoolId, fileName, program, ...meta }: UpdateAnswerKeyQuery,
  body: unknown,
) {
  const pdf = readPdf(body);
  const resolvedSchoolId = await resolveSchoolId(meta.type, schoolId);
  await assertProgramClass(meta.type, program, meta.classLevel, resolvedSchoolId);
  await assertUniqueTestId(meta.testId, id);

  const parsed = pdf ? await parsedFromPdf(pdf) : {};
  const answerKey = await answerKeyRepository.updateAnswerKey(id, {
    type: meta.type,
    testId: meta.testId,
    testNumber: meta.testNumber,
    classLevel: meta.classLevel,
    programCode: program,
    schoolId: resolvedSchoolId,
    ...(pdf && toPdfData(pdf, fileName ?? "answer-key.pdf")),
    ...parsed,
  });
  // The key may have moved to another school, so tell every school.
  if (answerKey.published) notifyContentChanged({ kind: KIND, schoolId: null });
  return toAnswerKeyDto(answerKey);
}

function toContentActor(actor?: ContentActor | SchoolAccountDto): ContentActor | undefined {
  if (!actor) return undefined;
  if ("kind" in actor) return actor;
  return { kind: "school", school: actor };
}

export async function getAnswerKeyFile(id: string, actor?: ContentActor | SchoolAccountDto) {
  const contentActor = toContentActor(actor);
  const file = await answerKeyRepository.findAnswerKeyFile({
    id,
    ...(contentActor && answerKeyAccessFilter(contentActor)),
  });
  if (!file) throw new AppError(404, "Answer key not found");
  return file;
}

export async function listVisibleAnswerKeys(actor: ContentActor) {
  return (await answerKeyRepository.findAnswerKeys(answerKeyAccessFilter(actor))).map((row) =>
    toAnswerKeyDto(row, true),
  );
}

export async function countVisibleAnswerKeys(actor: ContentActor) {
  return answerKeyRepository.countAnswerKeys(answerKeyAccessFilter(actor));
}

/** @deprecated Prefer listVisibleAnswerKeys with a ContentActor. */
export async function listSchoolAnswerKeys(school: SchoolAccountDto) {
  return listVisibleAnswerKeys({ kind: "school", school });
}

export async function setAnswerKeyPublished(id: string, published: boolean) {
  const answerKey = await answerKeyRepository.setAnswerKeyPublished(id, published);
  if (!answerKey) throw new AppError(404, "Answer key not found");
  notifyContentChanged({ kind: KIND, schoolId: answerKey.school?.id ?? null });
  return toAnswerKeyDto(answerKey);
}

export async function deleteAnswerKey(id: string) {
  const { schoolId, published } = await answerKeyRepository.deleteAnswerKey(id);
  if (published) notifyContentChanged({ kind: KIND, schoolId });
}

/** Admin edits one question's option and explanation after parse. */
export async function saveAnswerKeyAnswers(id: string, input: SaveAnswerKeyAnswersInput) {
  const existing = await answerKeyRepository.findAnswerKeyById(id);
  if (!existing) throw new AppError(404, "Answer key not found");
  await withPrintedSnapshot(existing);

  const answers = asAnswers(input.answers);
  const explanations: Record<string, string> = {};
  for (const [question, text] of Object.entries(input.explanations)) {
    if (text.trim()) explanations[question] = text.trim();
  }
  const printedAnswers = input.printedAnswers
    ? asAnswers(input.printedAnswers)
    : asAnswers(existing.printedAnswers);
  const subjectRanges =
    input.subjectRanges.length > 0
      ? input.subjectRanges
      : asSubjectRanges(existing.subjectRanges);

  const answerKey = await answerKeyRepository.updateAnswerKey(id, {
    answers: answers as Prisma.InputJsonValue,
    explanations: explanations as Prisma.InputJsonValue,
    ...(Object.keys(printedAnswers).length > 0
      ? { printedAnswers: printedAnswers as Prisma.InputJsonValue }
      : {}),
    subjectRanges: subjectRanges as Prisma.InputJsonValue,
    ...(input.pattern ? { pattern: input.pattern } : {}),
  });
  notifyContentChanged({ kind: KIND, schoolId: answerKey.school?.id ?? null });
  const { rescoreOmScansForKey } = await import("./om-scan.service.js");
  await rescoreOmScansForKey(id);
  return toAnswerKeyDto(answerKey);
}

export async function getVisibleAnswerKey(id: string, actor: ContentActor) {
  const row = await answerKeyRepository.findVisibleAnswerKey(id, answerKeyAccessFilter(actor));
  if (!row) throw new AppError(404, "Answer key not found");
  return toAnswerKeyDto(await withPrintedSnapshot(row), true);
}

/** Re-read the stored PDF into the editor. Does not write until admin clicks Save. */
export async function reparseAnswerKey(id: string) {
  const file = await answerKeyRepository.findAnswerKeyFile({ id });
  if (!file) throw new AppError(404, "Answer key not found");
  const existing = await answerKeyRepository.findAnswerKeyById(id);
  if (!existing) throw new AppError(404, "Answer key not found");
  const parsed = await parseAnswerKeyPdf(Buffer.from(file.data));
  if (Object.keys(parsed.answers).length === 0) {
    throw new AppError(422, "Could not read answers from this PDF");
  }
  return toAnswerKeyDto({
    ...existing,
    answers: parsed.answers,
    printedAnswers: parsed.answers,
    explanations: existing.explanations,
    subjectRanges: parsed.subjectRanges,
    pattern: parsed.pattern,
  });
}
