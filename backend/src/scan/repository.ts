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

export type ClassScanFilter = { schoolId: string; testNumber: number; classLevel: number; program?: string };

function classScanWhere(filter: ClassScanFilter): Prisma.OmScanWhereInput {
  return {
    schoolId: filter.schoolId,
    classLevel: filter.classLevel,
    answerKey: { testNumber: filter.testNumber, ...(filter.program ? { programCode: filter.program } : {}) },
  };
}

export function findClassScans(filter: ClassScanFilter) {
  return prisma.omScan.findMany({
    where: classScanWhere(filter),
    select: { id: true, rollNo: true, studentName: true, total: true, maxTotal: true, updatedAt: true },
    orderBy: { rollNo: "asc" },
  });
}

/** Saved image bytes; scans saved before raw/preview existed fall back to the warped sheet. */
export function findScanImages(where: Prisma.OmScanWhereInput) {
  return prisma.omScan.findMany({
    where,
    select: {
      id: true,
      rollNo: true,
      studentName: true,
      schoolId: true,
      testId: true,
      total: true,
      image: true,
      rawImage: true,
      previewImage: true,
    },
    orderBy: { total: "desc" },
  });
}

export function findClassScanImages(filter: ClassScanFilter) {
  return findScanImages(classScanWhere(filter));
}

export async function findScanIdsForKey(answerKeyId: string) {
  const rows = await prisma.omScan.findMany({ where: { answerKeyId }, select: { id: true }, orderBy: { createdAt: "asc" } });
  return rows.map((row) => row.id);
}

/** What re-marking needs: the stored answers and the straightened sheet the marks are drawn on. */
export function findScanForRegrade(id: string) {
  return prisma.omScan.findUnique({
    where: { id },
    select: {
      id: true,
      schoolId: true,
      studentName: true,
      classLevel: true,
      sectionName: true,
      testId: true,
      rollNo: true,
      answers: true,
      flags: true,
      image: true,
    },
  });
}

export function updateScanScore(id: string, data: Prisma.OmScanUncheckedUpdateInput) {
  return prisma.omScan.update({ where: { id }, data, select: { id: true } });
}

export function findOmScans(where: Prisma.OmScanWhereInput) {
  return prisma.omScan.findMany({
    where,
    select: scanSelect,
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
}
