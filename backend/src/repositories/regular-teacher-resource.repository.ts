import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";

const metaSelect = {
  id: true,
  programCode: true,
  classLevel: true,
  subject: true,
  volume: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RegularTeacherResourceSelect;

export type RegularTeacherResourceMeta = Prisma.RegularTeacherResourceGetPayload<{
  select: typeof metaSelect;
}>;

export function listAll() {
  return prisma.regularTeacherResource.findMany({
    select: metaSelect,
    orderBy: [{ programCode: "asc" }, { classLevel: "asc" }, { subject: "asc" }, { volume: "asc" }],
  });
}

export function listByProgram(programCode: string) {
  return prisma.regularTeacherResource.findMany({
    where: { programCode },
    select: metaSelect,
    orderBy: [{ classLevel: "asc" }, { subject: "asc" }, { volume: "asc" }],
  });
}

export function findMeta(
  programCode: string,
  classLevel: number,
  subject: string,
  volume: number,
) {
  return prisma.regularTeacherResource.findUnique({
    where: {
      programCode_classLevel_subject_volume: { programCode, classLevel, subject, volume },
    },
    select: metaSelect,
  });
}

export function findWithData(
  programCode: string,
  classLevel: number,
  subject: string,
  volume: number,
) {
  return prisma.regularTeacherResource.findUnique({
    where: {
      programCode_classLevel_subject_volume: { programCode, classLevel, subject, volume },
    },
  });
}

export function upsertResource(
  programCode: string,
  classLevel: number,
  subject: string,
  volume: number,
  data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    data: Buffer;
  },
) {
  return prisma.regularTeacherResource.upsert({
    where: {
      programCode_classLevel_subject_volume: { programCode, classLevel, subject, volume },
    },
    create: {
      programCode,
      classLevel,
      subject,
      volume,
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
  programCode: string,
  classLevel: number,
  subject: string,
  volume: number,
) {
  return prisma.regularTeacherResource.delete({
    where: {
      programCode_classLevel_subject_volume: { programCode, classLevel, subject, volume },
    },
  });
}
