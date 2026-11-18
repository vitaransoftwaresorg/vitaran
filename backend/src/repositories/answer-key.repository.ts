import { prisma } from "../config/database.js";
import { Prisma } from "../generated/prisma/client.js";

/** Everything except the file bytes. */
export const answerKeySummarySelect = {
  id: true,
  programCode: true,
  type: true,
  testId: true,
  testNumber: true,
  classLevel: true,
  fileName: true,
  fileSize: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  answers: true,
  explanations: true,
  printedAnswers: true,
  printedExplanations: true,
  subjectRanges: true,
  correctMarks: true,
  wrongMarks: true,
  school: { select: { id: true, name: true, code: true } },
} satisfies Prisma.AnswerKeySelect;

export const answerKeyDetailSelect = {
  ...answerKeySummarySelect,
  answers: true,
  explanations: true,
  subjectRanges: true,
} satisfies Prisma.AnswerKeySelect;

export type AnswerKeySummary = Prisma.AnswerKeyGetPayload<{
  select: typeof answerKeySummarySelect;
}>;

export type AnswerKeyDetail = Prisma.AnswerKeyGetPayload<{
  select: typeof answerKeyDetailSelect;
}>;

export function findRecentAnswerKeys(where: Prisma.AnswerKeyWhereInput, limit: number) {
  return prisma.answerKey.findMany({
    where,
    select: answerKeySummarySelect,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export function findAnswerKeys(where: Prisma.AnswerKeyWhereInput) {
  return prisma.answerKey.findMany({
    where,
    select: answerKeySummarySelect,
    orderBy: [{ updatedAt: "desc" }, { classLevel: "asc" }, { testNumber: "asc" }],
  });
}

export function countAnswerKeys(where?: Prisma.AnswerKeyWhereInput) {
  return prisma.answerKey.count({ where });
}

/**
 * Keys that still have no saved answers (opened editor, never saved).
 * Used so drafts are not counted as real answer keys on the dashboard.
 */
export async function countSavedAnswerKeys(publishedOnly = false) {
  const rows = publishedOnly
    ? await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM answer_keys
        WHERE published = true
          AND answers IS NOT NULL
          AND answers::text <> 'null'
          AND answers::text <> '{}'
      `
    : await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM answer_keys
        WHERE answers IS NOT NULL
          AND answers::text <> 'null'
          AND answers::text <> '{}'
      `;
  return Number(rows[0]?.count ?? 0);
}

/** Reuse an unsaved shell for the same program / test / class / school. */
export function findDraftAnswerKey(slot: {
  programCode: string;
  testNumber: number;
  classLevel: number;
  type: Prisma.AnswerKeyWhereInput["type"];
  schoolId: string | null;
}) {
  return prisma.answerKey.findFirst({
    where: {
      programCode: slot.programCode,
      testNumber: slot.testNumber,
      classLevel: slot.classLevel,
      type: slot.type,
      schoolId: slot.schoolId,
      OR: [{ answers: { equals: {} } }, { answers: { equals: Prisma.DbNull } }, { answers: { equals: Prisma.JsonNull } }],
    },
    select: answerKeyDetailSelect,
    orderBy: { updatedAt: "desc" },
  });
}

export function findAnswerKeyById(id: string) {
  return prisma.answerKey.findUnique({ where: { id }, select: answerKeyDetailSelect });
}

export function findAnswerKeyTestIds() {
  return prisma.answerKey.findMany({
    where: { testId: { not: null } },
    select: { testId: true },
  });
}

export function findAnswerKeyByTestId(testId: string, exceptId?: string) {
  return prisma.answerKey.findFirst({
    where: { testId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: answerKeyDetailSelect,
    orderBy: { updatedAt: "desc" },
  });
}

export function findVisibleAnswerKey(id: string, access: Prisma.AnswerKeyWhereInput) {
  return prisma.answerKey.findFirst({
    where: { id, ...access },
    select: answerKeyDetailSelect,
  });
}

export function createAnswerKey(data: Prisma.AnswerKeyUncheckedCreateInput) {
  return prisma.answerKey.create({ data, select: answerKeyDetailSelect });
}

export function updateAnswerKey(id: string, data: Prisma.AnswerKeyUncheckedUpdateInput) {
  return prisma.answerKey.update({ where: { id }, data, select: answerKeyDetailSelect });
}

/** Publishing isn't an edit, so `updatedAt` is kept as it was. Returns null when the key is gone. */
export async function setAnswerKeyPublished(id: string, published: boolean) {
  const current = await prisma.answerKey.findUnique({ where: { id }, select: { updatedAt: true } });
  if (!current) return null;
  return prisma.answerKey.update({
    where: { id },
    data: { published, publishedAt: published ? new Date() : null, updatedAt: current.updatedAt },
    select: answerKeySummarySelect,
  });
}

export function deleteAnswerKey(id: string) {
  return prisma.answerKey.delete({ where: { id }, select: { schoolId: true, published: true } });
}
