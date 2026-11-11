import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
  AnswerKeyObjectionRaisedBy,
  AnswerKeyObjectionStatus,
} from "../generated/prisma/enums.js";

export const objectionInclude = {
  school: { select: { id: true, name: true, code: true, accountEmail: true } },
  teacher: { select: { id: true, name: true, email: true } },
  answerKey: {
    select: {
      id: true,
      programCode: true,
      testId: true,
      testNumber: true,
      classLevel: true,
      type: true,
      schoolId: true,
      answers: true,
    },
  },
} satisfies Prisma.AnswerKeyObjectionInclude;

const omitImage = { imageData: true } as const;

export type ObjectionRecord = Prisma.AnswerKeyObjectionGetPayload<{
  include: typeof objectionInclude;
  omit: typeof omitImage;
}>;

export function createObjection(data: {
  answerKeyId: string;
  schoolId: string;
  raisedBy: AnswerKeyObjectionRaisedBy;
  teacherId?: string | null;
  questionNumber?: number | null;
  proposedAnswer?: string | null;
  message: string;
  image?: { data: Uint8Array<ArrayBuffer>; mimeType: string } | null;
}) {
  return prisma.answerKeyObjection.create({
    data: {
      answerKeyId: data.answerKeyId,
      schoolId: data.schoolId,
      raisedBy: data.raisedBy,
      teacherId: data.teacherId ?? null,
      questionNumber: data.questionNumber ?? null,
      proposedAnswer: data.proposedAnswer ?? null,
      message: data.message,
      imageData: data.image?.data ?? null,
      imageMimeType: data.image?.mimeType ?? null,
    },
    include: objectionInclude,
    omit: omitImage,
  });
}

export function findObjectionById(id: string) {
  return prisma.answerKeyObjection.findUnique({
    where: { id },
    include: objectionInclude,
    omit: omitImage,
  });
}

export function findObjectionImage(id: string) {
  return prisma.answerKeyObjection.findUnique({
    where: { id },
    select: { schoolId: true, imageData: true, imageMimeType: true },
  });
}

export async function listObjections(filter: {
  status?: AnswerKeyObjectionStatus;
  answerKeyId?: string;
  schoolId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.AnswerKeyObjectionWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.answerKeyId ? { answerKeyId: filter.answerKeyId } : {}),
    ...(filter.schoolId ? { schoolId: filter.schoolId } : {}),
  };
  const skip = (filter.page - 1) * filter.pageSize;
  const [items, total] = await Promise.all([
    prisma.answerKeyObjection.findMany({
      where,
      include: objectionInclude,
      omit: omitImage,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip,
      take: filter.pageSize,
    }),
    prisma.answerKeyObjection.count({ where }),
  ]);
  return { items, total };
}

export function countOpenObjections() {
  return prisma.answerKeyObjection.count({
    where: { status: AnswerKeyObjectionStatus.OPEN },
  });
}

export function resolveObjection(
  id: string,
  data: {
    status: typeof AnswerKeyObjectionStatus.RESOLVED | typeof AnswerKeyObjectionStatus.REJECTED;
    resolutionNote: string;
  },
) {
  return prisma.answerKeyObjection.update({
    where: { id },
    data: {
      status: data.status,
      resolutionNote: data.resolutionNote,
      resolvedAt: new Date(),
    },
    include: objectionInclude,
    omit: omitImage,
  });
}
