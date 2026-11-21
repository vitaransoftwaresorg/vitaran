import type { Prisma } from "../generated/prisma/client.js";
import { SchoolType } from "../generated/prisma/enums.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import type {
  AnswerKeyDetail,
  AnswerKeySummary,
} from "../repositories/answer-key.repository.js";
import * as programRepository from "../repositories/program.repository.js";
import * as schoolRepository from "../repositories/school.repository.js";
import * as sectionRepository from "../repositories/section.repository.js";
import type {
  ListAnswerKeysQuery,
  SaveAnswerKeyAnswersInput,
  UpdateAnswerKeyQuery,
  UploadAnswerKeyQuery,
} from "../schemas/answer-key.schema.js";
import {
  asAnswers,
  asExplanations,
  asKeyTypeRanges,
  asSubjectRanges,
  defaultSubjectRanges,
  diffCorrections,
  parseAnswerKeyPdf,
  type ParsedAnswerKey,
} from "../utils/answer-key-parse.js";
import { isOmrEvaluationActiveForTestId } from "../scan/service.js";
import { isRegradeRunningForKey, regradeScansForKey, scoringFingerprint } from "../scan/regrade.js";
import { AppError } from "../utils/app-error.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { downloadFileName } from "../utils/download-file-name.js";
import { enteredTestId } from "../utils/test-id.js";
import { renderAnswerKeyPdf } from "./answer-key.pdf.js";
import { buildAnswerKeyAccessFilter, type ContentActor } from "./content-access.js";
import { getObject } from "./object-storage.js";
import { loadVitaranLogo } from "./rank-card.render.js";
import { toSchoolRef, type SchoolAccountDto } from "./school.service.js";
import * as settingsService from "./settings.service.js";

const KIND = "answer-keys";

/** Regular catalog keys for the public site — never school-customized keys. */
const PUBLIC_ANSWER_KEY_FILTER: Prisma.AnswerKeyWhereInput = {
  type: SchoolType.REGULAR,
  schoolId: null,
};

/** Openable public keys (PDF / answers) must be published. */
const PUBLIC_ANSWER_KEY_LIVE_FILTER: Prisma.AnswerKeyWhereInput = {
  published: true,
  type: SchoolType.REGULAR,
  schoolId: null,
};

async function assertAnswerKeysPublic() {
  const { answerKeysPublic } = await settingsService.getAppSettings();
  if (!answerKeysPublic) {
    throw new AppError(403, "Answer keys are private. Sign in to view them.");
  }
}

let programNameCache: Map<string, string> | null = null;

async function programNamesByCode() {
  if (!programNameCache) {
    const rows = await programRepository.findPrograms();
    programNameCache = new Map(rows.map((row) => [row.code, row.name]));
  }
  return programNameCache;
}

async function answerKeyDto(row: AnswerKeySummary | AnswerKeyDetail, forPortal = false) {
  const names = await programNamesByCode();
  return toAnswerKeyDto(row, forPortal, names.get(row.programCode) ?? null);
}

async function answerKeyDtos(rows: Array<AnswerKeySummary | AnswerKeyDetail>, forPortal = false) {
  const names = await programNamesByCode();
  return rows.map((row) => toAnswerKeyDto(row, forPortal, names.get(row.programCode) ?? null));
}

function toAnswerKeyDto(
  row: AnswerKeySummary | AnswerKeyDetail,
  forPortal = false,
  programName: string | null = null,
) {
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
    programName,
    type: row.type,
    testId: enteredTestId(row.testId),
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
    keyTypeRanges: asKeyTypeRanges(row.keyTypeRanges),
    correctMarks: row.correctMarks ?? 4,
    wrongMarks: row.wrongMarks ?? 0,
    answerCount: Object.keys(answers).length,
    correctionCount: corrections.length,
    school: row.school && toSchoolRef(row.school),
    sectionId: row.sectionId ?? null,
    section: row.section
      ? { id: row.section.id, name: row.section.name, classLevel: row.section.classLevel }
      : null,
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
};

const classLevelIssue = (message: string) =>
  new AppError(400, message, [{ path: ["classLevel"], message }]);

/**
 * Platform keys: one shared key per test ID.
 * School/section keys may reuse that same test ID (OMR prefers the school key).
 */
async function assertUniqueTestId(
  testId: string | undefined,
  exceptId?: string,
  scope?: { schoolId: string; sectionId: string | null },
) {
  if (!testId) return;
  const existing = scope
    ? await answerKeyRepository.findSchoolAnswerKeyByTestId(
        testId,
        scope.schoolId,
        scope.sectionId,
        exceptId,
      )
    : await answerKeyRepository.findPlatformAnswerKeyByTestId(testId, exceptId);
  if (existing) {
    throw new AppError(400, "This test ID is already used", [
      {
        path: ["testId"],
        message: scope
          ? "This test ID is already used by another school key for this section."
          : "This test ID is already used. Test numbers can repeat; test IDs cannot.",
      },
    ]);
  }
}

/**
 * Live check for the admin form.
 * Platform keys: unique among platform keys only (school keys may reuse the ID).
 * School keys: unique among that school/section only (may match the platform key).
 */
export async function checkAnswerKeyTestId(testId: string, exceptId?: string) {
  const current = exceptId ? await answerKeyRepository.findAnswerKeyById(exceptId) : null;
  const scope = current?.schoolId
    ? { schoolId: current.schoolId, sectionId: current.sectionId ?? null }
    : undefined;
  const existing = scope
    ? await answerKeyRepository.findSchoolAnswerKeyByTestId(
        testId,
        scope.schoolId,
        scope.sectionId,
        exceptId,
      )
    : await answerKeyRepository.findPlatformAnswerKeyByTestId(testId, exceptId);
  return {
    testId,
    available: !existing,
    usedBy: existing
      ? {
          id: existing.id,
          program: existing.programCode,
          type: existing.type,
          classLevel: existing.classLevel,
          testNumber: existing.testNumber,
          school: existing.school?.name ?? null,
        }
      : null,
  };
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
  // Section school keys live under School Keys — keep them out of the main drive.
  const where: Prisma.AnswerKeyWhereInput[] = [
    { testNumber, type, sectionId: null, ...(program ? { programCode: program } : {}) },
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
  const filter = { AND: where };
  // Cap only when requested — admin drive needs the full set so folder
  // counts match the dashboard total.
  const rows = limit
    ? await answerKeyRepository.findRecentAnswerKeys(filter, limit)
    : await answerKeyRepository.findAnswerKeys(filter);
  return answerKeyDtos(rows);
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
    const testId = enteredTestId(key.testId);
    if (!testId) continue;
    const testKey = `${testId}\0${key.testNumber}`;
    let test = tests.get(testKey);
    if (!test) {
      test = { testId, testNumber: key.testNumber, programs: new Map() };
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
  // Unsaved editor shells (empty answers) are drafts — not counted until Save.
  const [total, published] = await Promise.all([
    answerKeyRepository.countSavedAnswerKeys(false),
    answerKeyRepository.countSavedAnswerKeys(true),
  ]);
  return { total, published };
}

/** Empty drafts created before the default rose from 1 → 4 still store 1; bump them on open. */
async function promoteEmptyDraftCorrectMarks<T extends AnswerKeySummary | AnswerKeyDetail>(row: T): Promise<T> {
  if (Object.keys(asAnswers(row.answers)).length > 0) return row;
  if ((row.correctMarks ?? 1) !== 1) return row;
  return (await answerKeyRepository.updateAnswerKey(row.id, { correctMarks: 4 })) as T;
}

export async function getAnswerKey(id: string) {
  const answerKey = await answerKeyRepository.findAnswerKeyById(id);
  if (!answerKey) throw new AppError(404, "Answer key not found");
  return answerKeyDto(await promoteEmptyDraftCorrectMarks(answerKey));
}

function emptyKeyFile() {
  return { fileName: "Answer key", fileSize: 0, data: Buffer.alloc(0) };
}

async function blankKeyFields(programCode: string): Promise<ParsedJsonFields & { correctMarks: number; wrongMarks: number }> {
  const program = await programRepository.findProgramByCode(programCode);
  return {
    answers: {} as Prisma.InputJsonValue,
    explanations: {} as Prisma.InputJsonValue,
    printedAnswers: {} as Prisma.InputJsonValue,
    printedExplanations: {} as Prisma.InputJsonValue,
    subjectRanges: defaultSubjectRanges(program?.subjects ?? []) as Prisma.InputJsonValue,
    correctMarks: 4,
    wrongMarks: 0,
  };
}

export async function uploadAnswerKey({ schoolId, program, ...meta }: UploadAnswerKeyQuery) {
  const resolvedSchoolId = await resolveSchoolId(meta.type, schoolId);
  await assertProgramClass(meta.type, program, meta.classLevel, resolvedSchoolId);
  await assertUniqueTestId(meta.testId);

  // Reopen an unsaved draft for this slot instead of creating another empty row.
  const draft = await answerKeyRepository.findDraftAnswerKey({
    programCode: program,
    testNumber: meta.testNumber,
    classLevel: meta.classLevel,
    type: meta.type,
    schoolId: resolvedSchoolId,
  });
  if (draft) return answerKeyDto(await promoteEmptyDraftCorrectMarks(draft));

  const created = await answerKeyRepository.createAnswerKey({
    type: meta.type,
    ...(meta.testId ? { testId: meta.testId } : {}),
    testNumber: meta.testNumber,
    classLevel: meta.classLevel,
    programCode: program,
    schoolId: resolvedSchoolId,
    ...emptyKeyFile(),
    ...(await blankKeyFields(program)),
  });
  // Draft shells stay admin-only until answers are saved (and usually published).
  notifyContentChanged({
    kind: KIND,
    schoolId: created.school?.id ?? null,
    adminOnly: true,
  });
  return answerKeyDto(created);
}

export async function updateAnswerKey(id: string, { schoolId, program, ...meta }: UpdateAnswerKeyQuery) {
  const existing = await answerKeyRepository.findAnswerKeyById(id);
  if (!existing) throw new AppError(404, "Answer key not found");
  const resolvedSchoolId = await resolveSchoolId(meta.type, schoolId);
  await assertProgramClass(meta.type, program, meta.classLevel, resolvedSchoolId);
  await assertUniqueTestId(
    meta.testId,
    id,
    resolvedSchoolId
      ? { schoolId: resolvedSchoolId, sectionId: existing.sectionId ?? null }
      : undefined,
  );

  const answerKey = await answerKeyRepository.updateAnswerKey(id, {
    type: meta.type,
    ...(meta.testId ? { testId: meta.testId } : {}),
    testNumber: meta.testNumber,
    classLevel: meta.classLevel,
    programCode: program,
    schoolId: resolvedSchoolId,
  });
  // The key may have moved to another school, so tell every school.
  notifyContentChanged({ kind: KIND, schoolId: null, adminOnly: !answerKey.published });
  return answerKeyDto(answerKey);
}

/**
 * List platform answer keys for a school section (or whole class) and any school override.
 * OMR uses the school key when present, otherwise the platform ("our") key.
 */
export async function listSchoolSectionKeyBoard(input: {
  schoolId: string;
  sectionId?: string;
  classLevel?: number;
}) {
  const school = await schoolRepository.findSchoolById(input.schoolId);
  if (!school) throw new AppError(404, "School not found");

  let classLevel = input.classLevel;
  let programCode: string | undefined;
  let sectionId: string | null = null;
  let sectionName: string | null = null;

  if (input.sectionId) {
    const section = await sectionRepository.findSectionById(input.sectionId);
    if (!section || section.schoolId !== input.schoolId) {
      throw new AppError(404, "Section not found");
    }
    classLevel = section.classLevel;
    programCode = section.program.code;
    sectionId = section.id;
    sectionName = section.name;
  } else if (classLevel != null) {
    const offering = school.schoolPrograms.find((row) =>
      row.classes.some((cls) => cls.classLevel === classLevel),
    );
    programCode = offering?.program.code;
  } else {
    throw new AppError(400, "Select a section or class");
  }

  if (classLevel == null || !programCode) {
    throw new AppError(400, "This class has no program enrollment");
  }

  const platformKeys = await answerKeyRepository.findAnswerKeys({
    schoolId: null,
    type: SchoolType.REGULAR,
    programCode,
    classLevel,
    sectionId: null,
  });
  const schoolKeys = await answerKeyRepository.findAnswerKeys({
    schoolId: school.id,
    sectionId,
    classLevel,
    programCode,
  });
  const schoolByTest = new Map(
    schoolKeys
      .filter((key) => key.testId)
      .map((key) => [key.testId!.toLowerCase(), key]),
  );
  const schoolBySlot = new Map(
    schoolKeys.map((key) => [`${key.testNumber}:${key.classLevel}`, key]),
  );

  const items = await Promise.all(
    platformKeys
      .filter((key) => Object.keys(asAnswers(key.answers)).length > 0 || enteredTestId(key.testId))
      .map(async (platform) => {
        const override =
          (platform.testId && schoolByTest.get(platform.testId.toLowerCase())) ||
          schoolBySlot.get(`${platform.testNumber}:${platform.classLevel}`) ||
          null;
        return {
          platform: await answerKeyDto(platform),
          schoolKey: override ? await answerKeyDto(override) : null,
        };
      }),
  );

  items.sort((a, b) => a.platform.testNumber - b.platform.testNumber);

  return {
    school: toSchoolRef(school),
    sectionId,
    sectionName,
    classLevel,
    programCode,
    items,
  };
}

/**
 * Create (or reopen) a blank school/section key linked to the platform test ID.
 * Answers start empty — admin enters them. OMR uses this key only once answers exist;
 * otherwise it falls back to the platform key.
 */
export async function ensureSchoolSectionKey(input: {
  platformKeyId: string;
  schoolId: string;
  sectionId?: string | null;
}) {
  const platform = await answerKeyRepository.findAnswerKeyById(input.platformKeyId);
  if (!platform || platform.schoolId) {
    throw new AppError(404, "Platform answer key not found");
  }
  if (!enteredTestId(platform.testId)) {
    throw new AppError(400, "Assign a test ID on the platform answer key first");
  }

  const school = await schoolRepository.findSchoolById(input.schoolId);
  if (!school) throw new AppError(404, "School not found");

  let sectionId: string | null = input.sectionId ?? null;
  if (sectionId) {
    const section = await sectionRepository.findSectionById(sectionId);
    if (!section || section.schoolId !== school.id) {
      throw new AppError(404, "Section not found");
    }
    if (section.classLevel !== platform.classLevel) {
      throw new AppError(400, `This section is Class ${section.classLevel}, but the key is Class ${platform.classLevel}`);
    }
  }

  const existing =
    (await answerKeyRepository.findSchoolAnswerKeyByTestId(
      platform.testId!,
      school.id,
      sectionId,
    )) ||
    (await answerKeyRepository.findSchoolSectionAnswerKeySlot({
      schoolId: school.id,
      sectionId,
      programCode: platform.programCode,
      testNumber: platform.testNumber,
      classLevel: platform.classLevel,
    }));

  if (existing) {
    // Older creates copied platform answers — strip unedited clones so the editor starts blank.
    const schoolAnswers = asAnswers(existing.answers);
    const platformAnswers = asAnswers(platform.answers);
    const stillClone =
      Object.keys(schoolAnswers).length > 0 &&
      JSON.stringify(schoolAnswers) === JSON.stringify(platformAnswers);
    if (stillClone) {
      const cleared = await answerKeyRepository.updateAnswerKey(existing.id, {
        answers: {} as Prisma.InputJsonValue,
        explanations: {} as Prisma.InputJsonValue,
        printedAnswers: {} as Prisma.InputJsonValue,
        printedExplanations: {} as Prisma.InputJsonValue,
        fileName: "School key",
        fileSize: 0,
      });
      return answerKeyDto(cleared);
    }
    return answerKeyDto(await promoteEmptyDraftCorrectMarks(existing));
  }

  const created = await answerKeyRepository.createAnswerKey({
    type: school.type,
    schoolId: school.id,
    sectionId,
    testId: platform.testId,
    testNumber: platform.testNumber,
    classLevel: platform.classLevel,
    programCode: platform.programCode,
    fileName: "School key",
    fileSize: 0,
    data: Buffer.alloc(0),
    answers: {} as Prisma.InputJsonValue,
    explanations: {} as Prisma.InputJsonValue,
    printedAnswers: {} as Prisma.InputJsonValue,
    printedExplanations: {} as Prisma.InputJsonValue,
    // Keep paper layout / marks from the platform key; answers stay blank.
    subjectRanges: (platform.subjectRanges ?? []) as Prisma.InputJsonValue,
    keyTypeRanges: (platform.keyTypeRanges ?? []) as Prisma.InputJsonValue,
    correctMarks: platform.correctMarks,
    wrongMarks: platform.wrongMarks,
    published: false,
  });
  notifyContentChanged({ kind: KIND, schoolId: school.id, adminOnly: true });
  return answerKeyDto(await promoteEmptyDraftCorrectMarks(created));
}

export async function listVisibleAnswerKeys(actor: ContentActor) {
  return answerKeyDtos(
    await answerKeyRepository.findAnswerKeys(await buildAnswerKeyAccessFilter(actor)),
    true,
  );
}

export async function countVisibleAnswerKeys(actor: ContentActor) {
  return answerKeyRepository.countAnswerKeys(await buildAnswerKeyAccessFilter(actor));
}

/** @deprecated Prefer listVisibleAnswerKeys with a ContentActor. */
export async function listSchoolAnswerKeys(school: SchoolAccountDto) {
  return listVisibleAnswerKeys({ kind: "school", school });
}

export async function setAnswerKeyPublished(id: string, published: boolean) {
  if (published) {
    const existing = await answerKeyRepository.findAnswerKeyById(id);
    if (!existing) throw new AppError(404, "Answer key not found");
    if (!enteredTestId(existing.testId)) {
      throw new AppError(400, "Enter the test ID before publishing", [
        { path: ["testId"], message: "Enter the test ID before publishing" },
      ]);
    }
  }
  const answerKey = await answerKeyRepository.setAnswerKeyPublished(id, published);
  if (!answerKey) throw new AppError(404, "Answer key not found");
  notifyContentChanged({ kind: KIND, schoolId: answerKey.school?.id ?? null });
  return answerKeyDto(answerKey);
}

export async function deleteAnswerKey(id: string) {
  const { schoolId, published } = await answerKeyRepository.deleteAnswerKey(id);
  notifyContentChanged({ kind: KIND, schoolId, adminOnly: !published });
}

function testIdScope(existing: AnswerKeyDetail) {
  return existing.schoolId
    ? { schoolId: existing.schoolId, sectionId: existing.sectionId ?? null }
    : undefined;
}

const OMR_LOCK_MESSAGE =
  "OMR evaluation is ongoing for this test ID. Editing is locked until scanning finishes.";
const OMR_REGRADE_MESSAGE =
  "OMR sheets are being re-marked for this key. Editing is locked until that finishes.";

function omrLockForKey(existing: AnswerKeyDetail, nextTestId?: string) {
  const testIds = [enteredTestId(existing.testId), enteredTestId(nextTestId)].filter(Boolean);
  const scanning = testIds.some((testId) => isOmrEvaluationActiveForTestId(testId));
  const regrading = isRegradeRunningForKey(existing.id);
  const locked = scanning || regrading;
  return {
    locked,
    scanning,
    regrading,
    testId: enteredTestId(existing.testId) || null,
    message: locked ? (scanning ? OMR_LOCK_MESSAGE : OMR_REGRADE_MESSAGE) : null,
  };
}

/** Lock platform + school keys that share this test ID while sheets are being scored. */
export async function getAnswerKeyOmrStatus(id: string) {
  const existing = await answerKeyRepository.findAnswerKeyById(id);
  if (!existing) throw new AppError(404, "Answer key not found");
  return omrLockForKey(existing);
}

function assertAnswerKeyEditable(existing: AnswerKeyDetail, nextTestId?: string) {
  const status = omrLockForKey(existing, nextTestId);
  if (status.locked) {
    throw new AppError(423, status.message ?? OMR_LOCK_MESSAGE);
  }
}

export async function setAnswerKeyTestId(id: string, testId: string) {
  const existing = await answerKeyRepository.findAnswerKeyById(id);
  if (!existing) throw new AppError(404, "Answer key not found");
  assertAnswerKeyEditable(existing, testId);
  if (testId !== existing.testId) {
    await assertUniqueTestId(testId, id, testIdScope(existing));
  }
  const answerKey = await answerKeyRepository.updateAnswerKey(id, { testId });
  notifyContentChanged({ kind: KIND, schoolId: answerKey.school?.id ?? null });
  return answerKeyDto(answerKey);
}

/**
 * Parse answers from a PDF in memory only — never stores the file.
 * Used by the key editor Import flow.
 */
export async function parseAnswerKeyPdfImport(pdf: Buffer): Promise<ParsedAnswerKey> {
  if (!pdf.length) throw new AppError(400, "Choose a PDF answer key to import");
  try {
    const parsed = await parseAnswerKeyPdf(pdf);
    if (Object.keys(parsed.answers).length === 0) {
      throw new AppError(400, "No answers found in this PDF. Use a typed key list or a printed KEY grid.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      400,
      error instanceof Error ? error.message : "Could not read answers from this PDF",
    );
  }
}

/** Admin edits one question's option and explanation after parse. */
export async function saveAnswerKeyAnswers(id: string, input: SaveAnswerKeyAnswersInput) {
  const existing = await answerKeyRepository.findAnswerKeyById(id);
  if (!existing) throw new AppError(404, "Answer key not found");

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
  const keyTypeRanges = asKeyTypeRanges(input.keyTypeRanges);

  const nextTestId = (input.testId ?? existing.testId)?.trim() || "";
  if (!nextTestId) {
    throw new AppError(400, "Enter the test ID", [
      { path: ["testId"], message: "Enter the test ID" },
    ]);
  }
  assertAnswerKeyEditable(existing, nextTestId);
  if (nextTestId !== existing.testId) {
    await assertUniqueTestId(nextTestId, id, testIdScope(existing));
  }

  const answerKey = await answerKeyRepository.updateAnswerKey(id, {
    answers: answers as Prisma.InputJsonValue,
    explanations: explanations as Prisma.InputJsonValue,
    ...(Object.keys(printedAnswers).length > 0
      ? { printedAnswers: printedAnswers as Prisma.InputJsonValue }
      : {}),
    subjectRanges: subjectRanges as Prisma.InputJsonValue,
    keyTypeRanges: keyTypeRanges as Prisma.InputJsonValue,
    testId: nextTestId,
    correctMarks: input.correctMarks,
    wrongMarks: input.wrongMarks,
  });
  notifyContentChanged({ kind: KIND, schoolId: answerKey.school?.id ?? null });
  if (scoringFingerprint(answerKey) !== scoringFingerprint(existing)) regradeScansForKey(id);
  return answerKeyDto(answerKey);
}

/** Branded, printable answer key with Vitaran and the viewer's school logo. */
export async function getAnswerKeyPdf(id: string, actor: ContentActor) {
  const row = await answerKeyRepository.findVisibleAnswerKey(
    id,
    await buildAnswerKeyAccessFilter(actor),
  );
  if (!row) throw new AppError(404, "Answer key not found");
  const answers = asAnswers(row.answers);
  if (Object.keys(answers).length === 0) throw new AppError(404, "No answers published for this test yet");

  const school = actor.kind === "school" ? actor.school : actor.teacher.school;
  const programName =
    school.schoolPrograms.find((program) => program.programCode === row.programCode)?.programName ??
    (await programRepository.findProgramByCode(row.programCode))?.name ??
    row.programCode;
  const [logo, vitaran] = await Promise.all([schoolRepository.findSchoolLogo(school.id), loadVitaranLogo()]);
  const testId = enteredTestId(row.testId);

  const data = await renderAnswerKeyPdf(
    {
      schoolName: school.name,
      programName: programName === school.name ? `Class ${row.classLevel}` : programName,
      testNumber: row.testNumber,
      testId: testId ?? null,
      classLevel: row.classLevel,
      correctMarks: row.correctMarks ?? 4,
      wrongMarks: row.wrongMarks ?? 0,
      publishedAt: row.publishedAt ?? row.updatedAt,
      answers,
      explanations: asExplanations(row.explanations),
      subjectRanges: asSubjectRanges(row.subjectRanges),
    },
    { vitaran, school: logo?.logoData ? await getObject(logo.logoData) : null },
  );
  return {
    fileName: downloadFileName(
      ["Answer-Key", programName, `Class-${row.classLevel}`, `Test-${row.testNumber}`, testId],
      "pdf",
    ),
    data,
  };
}

export async function getVisibleAnswerKey(id: string, actor: ContentActor) {
  const found = await answerKeyRepository.findVisibleAnswerKey(
    id,
    await buildAnswerKeyAccessFilter(actor),
  );
  const row = found ? await promoteEmptyDraftCorrectMarks(found) : found;
  if (!row) throw new AppError(404, "Answer key not found");
  return answerKeyDto(row);
}

/** Public site: list regular answer keys (unpublished shown as Not Published, not openable). */
export async function listPublicAnswerKeys() {
  await assertAnswerKeysPublic();
  return (await answerKeyDtos(await answerKeyRepository.findAnswerKeys(PUBLIC_ANSWER_KEY_FILTER), true)).filter(
    (row) => (row.answerCount ?? 0) > 0,
  );
}

export async function getPublicAnswerKey(id: string) {
  await assertAnswerKeysPublic();
  const row = await answerKeyRepository.findVisibleAnswerKey(id, PUBLIC_ANSWER_KEY_FILTER);
  if (!row) throw new AppError(404, "Answer key not found");
  if (Object.keys(asAnswers(row.answers)).length === 0) {
    throw new AppError(404, "Answer key not found");
  }
  return answerKeyDto(row);
}

/** Admin printable PDF — school branding when the key belongs to a school. */
export async function getAdminAnswerKeyPdf(id: string) {
  const row = await answerKeyRepository.findAnswerKeyById(id);
  if (!row) throw new AppError(404, "Answer key not found");
  const answers = asAnswers(row.answers);
  if (Object.keys(answers).length === 0) throw new AppError(404, "No answers published for this test yet");

  const programName =
    (await programRepository.findProgramByCode(row.programCode))?.name ?? row.programCode;
  const schoolName = row.school?.name ?? "Vitaran Learning";
  const [vitaran, logo] = await Promise.all([
    loadVitaranLogo(),
    row.school ? schoolRepository.findSchoolLogo(row.school.id) : Promise.resolve(null),
  ]);
  const testId = enteredTestId(row.testId);

  const data = await renderAnswerKeyPdf(
    {
      schoolName,
      programName: programName === schoolName ? `Class ${row.classLevel}` : programName,
      testNumber: row.testNumber,
      testId: testId ?? null,
      classLevel: row.classLevel,
      correctMarks: row.correctMarks ?? 4,
      wrongMarks: row.wrongMarks ?? 0,
      publishedAt: row.publishedAt ?? row.updatedAt,
      answers,
      explanations: asExplanations(row.explanations),
      subjectRanges: asSubjectRanges(row.subjectRanges),
    },
    { vitaran, school: logo?.logoData ? await getObject(logo.logoData) : null },
  );
  return {
    fileName: downloadFileName(
      ["Answer-Key", programName, `Class-${row.classLevel}`, `Test-${row.testNumber}`, testId],
      "pdf",
    ),
    data,
  };
}

/** Public branded PDF (Vitaran logo only — no school branding). */
export async function getPublicAnswerKeyPdf(id: string) {
  await assertAnswerKeysPublic();
  const row = await answerKeyRepository.findVisibleAnswerKey(id, PUBLIC_ANSWER_KEY_LIVE_FILTER);
  if (!row) throw new AppError(404, "Answer key not found");
  const answers = asAnswers(row.answers);
  if (Object.keys(answers).length === 0) throw new AppError(404, "No answers published for this test yet");

  const program =
    (await programRepository.findProgramByCode(row.programCode))?.name ?? row.programCode;
  const vitaran = await loadVitaranLogo();
  const testId = enteredTestId(row.testId);
  const data = await renderAnswerKeyPdf(
    {
      schoolName: "Vitaran Learning",
      programName: program,
      testNumber: row.testNumber,
      testId: testId ?? null,
      classLevel: row.classLevel,
      correctMarks: row.correctMarks ?? 4,
      wrongMarks: row.wrongMarks ?? 0,
      publishedAt: row.publishedAt ?? row.updatedAt,
      answers,
      explanations: asExplanations(row.explanations),
      subjectRanges: asSubjectRanges(row.subjectRanges),
    },
    { vitaran, school: null },
  );
  return {
    fileName: downloadFileName(
      ["Answer-Key", program, `Class-${row.classLevel}`, `Test-${row.testNumber}`, testId],
      "pdf",
    ),
    data,
  };
}
