import { prisma } from "../config/database.js";

export const schoolClassInclude = {
  program: { select: { id: true, code: true, name: true, year: true } },
} as const;

export function listSchoolClassesBySchool(schoolId: string) {
  return prisma.schoolClass.findMany({
    where: { schoolId },
    include: schoolClassInclude,
    orderBy: [{ classLevel: "asc" }],
  });
}

export function findSchoolClassById(id: string) {
  return prisma.schoolClass.findUnique({
    where: { id },
    include: schoolClassInclude,
  });
}

export function findSchoolClassByLevel(schoolId: string, classLevel: number) {
  return prisma.schoolClass.findUnique({
    where: { schoolId_classLevel: { schoolId, classLevel } },
    include: schoolClassInclude,
  });
}

export function sumSchoolClassStudentCount(schoolId: string, excludeId?: string) {
  return prisma.schoolClass.aggregate({
    where: {
      schoolId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    _sum: { studentCount: true },
  });
}

export function createSchoolClass(data: {
  schoolId: string;
  classLevel: number;
  programId: string;
  studentCount: number;
}) {
  return prisma.schoolClass.create({
    data,
    include: schoolClassInclude,
  });
}

export function updateSchoolClass(
  id: string,
  data: { programId?: string; studentCount?: number },
) {
  return prisma.schoolClass.update({
    where: { id },
    data,
    include: schoolClassInclude,
  });
}

export function deleteSchoolClass(id: string) {
  return prisma.schoolClass.delete({ where: { id } });
}

export function deleteSchoolClassByLevel(schoolId: string, classLevel: number) {
  return prisma.schoolClass.deleteMany({ where: { schoolId, classLevel } });
}
