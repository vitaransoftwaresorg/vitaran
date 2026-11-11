import { prisma } from "../config/database.js";

export const sectionInclude = {
  program: { select: { id: true, code: true, name: true, year: true } },
  classTeacher: {
    select: { id: true, name: true, email: true, status: true },
  },
} as const;

export function listSectionsBySchool(schoolId: string) {
  return prisma.schoolSection.findMany({
    where: { schoolId },
    include: sectionInclude,
    orderBy: [{ classLevel: "asc" }, { name: "asc" }],
  });
}

export function findSectionById(id: string) {
  return prisma.schoolSection.findUnique({
    where: { id },
    include: sectionInclude,
  });
}

export function sumStudentCount(schoolId: string, excludeSectionId?: string) {
  return prisma.schoolSection.aggregate({
    where: {
      schoolId,
      ...(excludeSectionId ? { NOT: { id: excludeSectionId } } : {}),
    },
    _sum: { studentCount: true },
  });
}

export function createSection(data: {
  schoolId: string;
  classLevel: number;
  name: string;
  programId: string;
  studentCount: number;
  classTeacherId?: string | null;
}) {
  return prisma.schoolSection.create({
    data: {
      schoolId: data.schoolId,
      classLevel: data.classLevel,
      name: data.name,
      programId: data.programId,
      studentCount: data.studentCount,
      classTeacherId: data.classTeacherId ?? null,
    },
    include: sectionInclude,
  });
}

export function updateSection(
  id: string,
  data: {
    name?: string;
    programId?: string;
    studentCount?: number;
    classTeacherId?: string | null;
  },
) {
  return prisma.schoolSection.update({
    where: { id },
    data,
    include: sectionInclude,
  });
}

export function deleteSection(id: string) {
  return prisma.schoolSection.delete({ where: { id } });
}

export function applyTeacherToClassLevel(
  schoolId: string,
  classLevel: number,
  classTeacherId: string | null,
) {
  return prisma.schoolSection.updateMany({
    where: { schoolId, classLevel },
    data: { classTeacherId },
  });
}

export function findSectionNameConflict(
  schoolId: string,
  classLevel: number,
  name: string,
  excludeId?: string,
) {
  return prisma.schoolSection.findFirst({
    where: {
      schoolId,
      classLevel,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
}
