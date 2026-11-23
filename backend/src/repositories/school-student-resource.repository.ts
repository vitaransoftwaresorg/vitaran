import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";

const metaSelect = {
  id: true,
  schoolId: true,
  classLevel: true,
  subject: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SchoolStudentResourceSelect;

export type SchoolStudentResourceMeta = Prisma.SchoolStudentResourceGetPayload<{
  select: typeof metaSelect;
}>;

export function listBySchool(schoolId: string) {
  return prisma.schoolStudentResource.findMany({
    where: { schoolId },
    select: metaSelect,
    orderBy: [{ classLevel: "asc" }, { subject: "asc" }],
  });
}

export function findMeta(schoolId: string, classLevel: number, subject: string) {
  return prisma.schoolStudentResource.findUnique({
    where: {
      schoolId_classLevel_subject: { schoolId, classLevel, subject },
    },
    select: metaSelect,
  });
}

export function findWithData(schoolId: string, classLevel: number, subject: string) {
  return prisma.schoolStudentResource.findUnique({
    where: {
      schoolId_classLevel_subject: { schoolId, classLevel, subject },
    },
  });
}

export function upsertResource(
  schoolId: string,
  classLevel: number,
  subject: string,
  data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    data: Buffer;
  },
) {
  return prisma.schoolStudentResource.upsert({
    where: {
      schoolId_classLevel_subject: { schoolId, classLevel, subject },
    },
    create: {
      schoolId,
      classLevel,
      subject,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      data: data.data as unknown as Uint8Array<ArrayBuffer>,
    },
    update: {
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      data: data.data as unknown as Uint8Array<ArrayBuffer>,
    },
    select: metaSelect,
  });
}

export function deleteResource(schoolId: string, classLevel: number, subject: string) {
  return prisma.schoolStudentResource.delete({
    where: {
      schoolId_classLevel_subject: { schoolId, classLevel, subject },
    },
  });
}
