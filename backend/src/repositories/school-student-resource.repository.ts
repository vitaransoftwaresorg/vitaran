import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";

const metaSelect = {
  id: true,
  schoolId: true,
  programCode: true,
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
    orderBy: [{ programCode: "asc" }, { classLevel: "asc" }, { subject: "asc" }],
  });
}

export function findMeta(
  schoolId: string,
  programCode: string,
  classLevel: number,
  subject: string,
) {
  return prisma.schoolStudentResource.findUnique({
    where: {
      schoolId_programCode_classLevel_subject: {
        schoolId,
        programCode,
        classLevel,
        subject,
      },
    },
    select: metaSelect,
  });
}

export function findWithData(
  schoolId: string,
  programCode: string,
  classLevel: number,
  subject: string,
) {
  return prisma.schoolStudentResource.findUnique({
    where: {
      schoolId_programCode_classLevel_subject: {
        schoolId,
        programCode,
        classLevel,
        subject,
      },
    },
  });
}

export function upsertResource(
  schoolId: string,
  programCode: string,
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
      schoolId_programCode_classLevel_subject: {
        schoolId,
        programCode,
        classLevel,
        subject,
      },
    },
    create: {
      schoolId,
      programCode,
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

export function deleteResource(
  schoolId: string,
  programCode: string,
  classLevel: number,
  subject: string,
) {
  return prisma.schoolStudentResource.delete({
    where: {
      schoolId_programCode_classLevel_subject: {
        schoolId,
        programCode,
        classLevel,
        subject,
      },
    },
  });
}

export function listWithDataBySchool(schoolId: string) {
  return prisma.schoolStudentResource.findMany({
    where: { schoolId },
    orderBy: [{ programCode: "asc" }, { classLevel: "asc" }, { subject: "asc" }],
  });
}

export function deleteManyByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve({ count: 0 });
  return prisma.schoolStudentResource.deleteMany({
    where: { id: { in: ids } },
  });
}

export function updateProgramCode(
  schoolId: string,
  fromProgramCode: string,
  toProgramCode: string,
) {
  return prisma.schoolStudentResource.updateMany({
    where: { schoolId, programCode: fromProgramCode },
    data: { programCode: toProgramCode },
  });
}
