import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";

const metaSelect = {
  id: true,
  headOfficeId: true,
  programCode: true,
  classLevel: true,
  subject: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.HeadOfficeTeacherResourceSelect;

export type HeadOfficeTeacherResourceMeta = Prisma.HeadOfficeTeacherResourceGetPayload<{
  select: typeof metaSelect;
}>;

export function listByHeadOffice(headOfficeId: string) {
  return prisma.headOfficeTeacherResource.findMany({
    where: { headOfficeId },
    select: metaSelect,
    orderBy: [{ programCode: "asc" }, { classLevel: "asc" }, { subject: "asc" }],
  });
}

export function findMeta(
  headOfficeId: string,
  programCode: string,
  classLevel: number,
  subject: string,
) {
  return prisma.headOfficeTeacherResource.findUnique({
    where: {
      headOfficeId_programCode_classLevel_subject: {
        headOfficeId,
        programCode,
        classLevel,
        subject,
      },
    },
    select: metaSelect,
  });
}

export function findWithData(
  headOfficeId: string,
  programCode: string,
  classLevel: number,
  subject: string,
) {
  return prisma.headOfficeTeacherResource.findUnique({
    where: {
      headOfficeId_programCode_classLevel_subject: {
        headOfficeId,
        programCode,
        classLevel,
        subject,
      },
    },
  });
}

export function upsertResource(
  headOfficeId: string,
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
  return prisma.headOfficeTeacherResource.upsert({
    where: {
      headOfficeId_programCode_classLevel_subject: {
        headOfficeId,
        programCode,
        classLevel,
        subject,
      },
    },
    create: {
      headOfficeId,
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
  headOfficeId: string,
  programCode: string,
  classLevel: number,
  subject: string,
) {
  return prisma.headOfficeTeacherResource.delete({
    where: {
      headOfficeId_programCode_classLevel_subject: {
        headOfficeId,
        programCode,
        classLevel,
        subject,
      },
    },
  });
}
