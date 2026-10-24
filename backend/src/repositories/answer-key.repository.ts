import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";

/** Everything except the file bytes. */
export const answerKeySummarySelect = {
  id: true,
  programCode: true,
  type: true,
  pattern: true,
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
    orderBy: [{ classLevel: "asc" }, { testNumber: "asc" }],
  });
}

export function countAnswerKeys(where?: Prisma.AnswerKeyWhereInput) {
  return prisma.answerKey.count({ where });
}

export function findAnswerKeyById(id: string) {
  return prisma.answerKey.findUnique({ where: { id }, select: answerKeyDetailSelect });
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

export function findAnswerKeyFile(where: Prisma.AnswerKeyWhereInput) {
  return prisma.answerKey.findFirst({
    where,
    select: { fileName: true, data: true },
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
