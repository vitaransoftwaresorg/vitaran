import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";

const scanSelect = {
  id: true,
  testId: true,
  rollNo: true,
  studentName: true,
  classLevel: true,
  sectionName: true,
  programName: true,
  examDate: true,
  answers: true,
  flags: true,
  subjectScores: true,
  correct: true,
  wrong: true,
  blank: true,
  total: true,
  maxTotal: true,
  confidence: true,
  fileName: true,
  actor: true,
  createdAt: true,
  updatedAt: true,
  school: { select: { id: true, name: true, code: true, type: true } },
  answerKey: { select: { testNumber: true, classLevel: true, programCode: true } },
} satisfies Prisma.OmScanSelect;

export type OmScanRow = Prisma.OmScanGetPayload<{ select: typeof scanSelect }>;

export async function findSchoolByName(name: string) {
  const value = name.trim();
  if (!value) return null;
  return prisma.school.findFirst({
    where: { name: { contains: value, mode: "insensitive" } },
    select: { id: true, name: true, code: true, type: true },
  });
}

export function upsertOmScan(
  schoolId: string,
  rollNo: string,
  testId: string,
  classLevel: number,
  data: Prisma.OmScanUncheckedCreateInput,
) {
  return prisma.omScan.upsert({
    where: { schoolId_rollNo_testId_classLevel: { schoolId, rollNo, testId, classLevel } },
    create: data,
    update: data,
    select: scanSelect,
  });
}

export function findOmScans(where: Prisma.OmScanWhereInput) {
  return prisma.omScan.findMany({
    where,
    select: scanSelect,
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
}
