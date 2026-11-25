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
  answerKey: {
    select: {
      testNumber: true,
      classLevel: true,
      programCode: true,
      answers: true,
      keyTypeRanges: true,
    },
  },
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

/** Shared blank roll — empty string; match by student when set. */
function isSharedBlankRoll(rollNo: string) {
  return /^0+$/.test(rollNo.replace(/\D/g, "")) || rollNo.replace(/\D/g, "").length === 0;
}

export async function upsertOmScan(
  schoolId: string,
  rollNo: string,
  testId: string,
  classLevel: number,
  data: Prisma.OmScanUncheckedCreateInput,
) {
  const blank = isSharedBlankRoll(rollNo);
  const storedRoll = blank ? "" : rollNo;
  const studentId = typeof data.studentId === "string" ? data.studentId : null;
  const existing = blank && studentId
    ? await prisma.omScan.findFirst({
        where: { schoolId, studentId, testId, classLevel, rollNo: "" },
        select: { id: true },
      })
    : await prisma.omScan.findFirst({
        where: { schoolId, rollNo: storedRoll, testId, classLevel },
        select: { id: true },
      });

  if (existing) {
    return prisma.omScan.update({
      where: { id: existing.id },
      data: { ...data, rollNo: storedRoll },
      select: scanSelect,
    });
  }
  return prisma.omScan.create({
    data: { ...data, rollNo: storedRoll },
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
    select: {
      id: true,
      rollNo: true,
      studentName: true,
      testId: true,
      total: true,
      maxTotal: true,
      updatedAt: true,
    },
    orderBy: { rollNo: "asc" },
  });
}

/** Keep every saved sheet's evaluated test ID aligned with the answer key. */
export function syncTestIdForKey(answerKeyId: string, testId: string) {
  const value = testId.trim();
  if (!value) return Promise.resolve({ count: 0 });
  return prisma.omScan.updateMany({
    where: { answerKeyId, NOT: { testId: value } },
    data: { testId: value },
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
      subjectScores: true,
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

/** Drop saved OMR rows for registration numbers leaving the school roster. */
export function deleteOmScansByRolls(schoolId: string, rollNos: string[]) {
  const rolls = [...new Set(rollNos.map((roll) => roll.trim()).filter(Boolean))];
  if (rolls.length === 0) return Promise.resolve({ count: 0 });
  return prisma.omScan.deleteMany({
    where: {
      schoolId,
      OR: rolls.map((rollNo) => ({ rollNo: { equals: rollNo, mode: "insensitive" as const } })),
    },
  });
}

export function deleteOmScansByClass(schoolId: string, classLevel: number) {
  return prisma.omScan.deleteMany({ where: { schoolId, classLevel } });
}
