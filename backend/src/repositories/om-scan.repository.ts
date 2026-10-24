import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";

export const omScanSummarySelect = {
  id: true,
  schoolId: true,
  studentId: true,
  answerKeyId: true,
  testId: true,
  rollNo: true,
  examDate: true,
  answers: true,
  flags: true,
  subjectScores: true,
  correct: true,
  wrong: true,
  blank: true,
  total: true,
  maxTotal: true,
  rank: true,
  classSize: true,
  fileName: true,
  fileSize: true,
  scannedById: true,
  createdAt: true,
  updatedAt: true,
  school: { select: { type: true } },
  answerKey: { select: { testNumber: true } },
  student: {
    select: {
      id: true,
      name: true,
      rollNo: true,
      classLevel: true,
      sectionId: true,
      programId: true,
      program: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.OmScanSelect;

export type OmScanSummary = Prisma.OmScanGetPayload<{ select: typeof omScanSummarySelect }>;

export function findOmScan(where: Prisma.OmScanWhereInput) {
  return prisma.omScan.findFirst({ where, select: omScanSummarySelect });
}

export function findOmScans(where: Prisma.OmScanWhereInput) {
  return prisma.omScan.findMany({
    where,
    select: omScanSummarySelect,
    orderBy: [{ total: "desc" }, { rollNo: "asc" }],
  });
}

export function upsertOmScan(studentId: string, testId: string, data: Prisma.OmScanUncheckedCreateInput) {
  return prisma.omScan.upsert({
    where: { studentId_testId: { studentId, testId } },
    create: data,
    update: {
      answerKeyId: data.answerKeyId,
      rollNo: data.rollNo,
      examDate: data.examDate ?? null,
      answers: data.answers,
      flags: data.flags,
      subjectScores: data.subjectScores,
      correct: data.correct,
      wrong: data.wrong,
      blank: data.blank,
      total: data.total,
      maxTotal: data.maxTotal,
      fileName: data.fileName,
      fileSize: data.fileSize,
      image: data.image,
      scannedById: data.scannedById,
    },
    select: omScanSummarySelect,
  });
}

export function findOmScanId(studentId: string, testId: string) {
  return prisma.omScan.findUnique({
    where: { studentId_testId: { studentId, testId } },
    select: { id: true, total: true, maxTotal: true, updatedAt: true },
  });
}

export function updateOmScan(id: string, data: Prisma.OmScanUncheckedUpdateInput) {
  return prisma.omScan.update({ where: { id }, data, select: omScanSummarySelect });
}

export const omResultReleaseSelect = {
  testId: true,
  programId: true,
  classLevel: true,
  sectionKey: true,
  published: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.OmResultReleaseSelect;

export type OmResultReleaseRow = Prisma.OmResultReleaseGetPayload<{ select: typeof omResultReleaseSelect }>;

export function findOmResultReleases(where: Prisma.OmResultReleaseWhereInput) {
  return prisma.omResultRelease.findMany({ where, select: omResultReleaseSelect });
}

export function upsertOmResultRelease(
  slot: { schoolId: string; testId: string; programId: string; classLevel: number; sectionKey: string },
  published: boolean,
  teacherId: string,
) {
  const publishedAt = published ? new Date() : null;
  return prisma.omResultRelease.upsert({
    where: { schoolId_testId_programId_classLevel_sectionKey: slot },
    create: { ...slot, published, publishedAt, updatedById: teacherId },
    update: { published, publishedAt, updatedById: teacherId },
    select: omResultReleaseSelect,
  });
}

export function findOmScansForKey(answerKeyId: string) {
  return prisma.omScan.findMany({
    where: { answerKeyId },
    select: {
      id: true,
      answers: true,
      schoolId: true,
      school: { select: { type: true } },
    },
  });
}
