import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";
import { StudentStatus } from "../generated/prisma/enums.js";
import type { ListStudentsQuery } from "../schemas/student.schema.js";

export const studentInclude = {
  school: { select: { id: true, name: true, code: true, status: true, accountEmail: true } },
  program: { select: { id: true, code: true, name: true, year: true } },
  section: {
    select: {
      id: true,
      name: true,
      classLevel: true,
      programId: true,
      studentCount: true,
      classTeacherId: true,
    },
  },
} satisfies Prisma.StudentInclude;

export type StudentRecord = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

type ListFilter = ListStudentsQuery & { schoolId?: string };

function listWhere(query: ListFilter): Prisma.StudentWhereInput {
  const and: Prisma.StudentWhereInput[] = [];
  if (query.schoolId) and.push({ schoolId: query.schoolId });
  if (query.programId) and.push({ programId: query.programId });
  if (query.classLevel != null) and.push({ classLevel: query.classLevel });
  if (query.sectionId) and.push({ sectionId: query.sectionId });
  if (query.wholeClass === true) and.push({ sectionId: null });
  if (query.status) and.push({ status: query.status });
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { rollNo: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { parentName: { contains: query.q, mode: "insensitive" } },
        { parentPhone: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export function findStudentById(id: string) {
  return prisma.student.findUnique({ where: { id }, include: studentInclude });
}

export function listSchoolRolls(schoolId: string) {
  return prisma.student.findMany({
    where: { schoolId, status: StudentStatus.ACTIVE },
    select: { rollNo: true },
  });
}

export function listSchoolRoster(schoolId: string) {
  return prisma.student.findMany({
    where: { schoolId, status: StudentStatus.ACTIVE },
    select: {
      name: true,
      rollNo: true,
      classLevel: true,
      sectionId: true,
      program: { select: { code: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
}

export function findStudentBySchoolAndRoll(schoolId: string, rollNo: string) {
  return prisma.student.findUnique({
    where: { schoolId_rollNo: { schoolId, rollNo } },
    include: studentInclude,
  });
}

export function findActiveStudentInSchool(schoolId: string, rollNo: string) {
  return prisma.student.findFirst({
    where: { schoolId, status: StudentStatus.ACTIVE, rollNo: { equals: rollNo.trim(), mode: "insensitive" } },
    include: studentInclude,
  });
}

export function findActiveStudentsByRollNo(rollNo: string) {
  return prisma.student.findMany({
    where: {
      status: StudentStatus.ACTIVE,
      rollNo: { equals: rollNo.trim(), mode: "insensitive" },
    },
    include: {
      school: { select: { id: true, name: true, code: true, type: true } },
      program: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, name: true } },
    },
    orderBy: [{ school: { name: "asc" } }, { name: "asc" }],
    take: 20,
  });
}

export function findStudentBySchoolCodeAndRoll(schoolCode: string, rollNo: string) {
  return prisma.student.findFirst({
    where: {
      rollNo: { equals: rollNo, mode: "insensitive" },
      school: { code: { equals: schoolCode.trim().toUpperCase(), mode: "insensitive" } },
    },
    include: studentInclude,
  });
}

export const studentListSelect = {
  id: true,
  schoolId: true,
  name: true,
  rollNo: true,
  email: true,
  parentName: true,
  parentPhone: true,
  programId: true,
  classLevel: true,
  sectionId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  school: { select: { id: true, name: true, code: true } },
  program: { select: { code: true, name: true } },
  section: { select: { id: true, name: true } },
} satisfies Prisma.StudentSelect;

/** When a whole class is converted to a named section, attach existing students. */
export function assignWholeClassStudentsToSection(
  schoolId: string,
  programId: string,
  classLevel: number,
  sectionId: string,
) {
  return prisma.student.updateMany({
    where: { schoolId, programId, classLevel, sectionId: null },
    data: { sectionId },
  });
}

export async function findStudents(query: ListFilter) {
  const where = listWhere(query);
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: studentListSelect,
      orderBy: [{ classLevel: "asc" }, { rollNo: "asc" }],
      skip,
      take: query.pageSize,
    }),
    prisma.student.count({ where }),
  ]);
  return { items, total };
}

/** ACTIVE roster only — same set Students / Results / OMR use. */
export async function countStudentsGrouped(schoolId: string) {
  const where: Prisma.StudentWhereInput = {
    schoolId,
    status: StudentStatus.ACTIVE,
  };
  const [byProgram, byClass, bySection, byWhole] = await Promise.all([
    prisma.student.groupBy({
      by: ["programId"],
      where,
      _count: { _all: true },
    }),
    prisma.student.groupBy({
      by: ["programId", "classLevel"],
      where,
      _count: { _all: true },
    }),
    prisma.student.groupBy({
      by: ["sectionId"],
      where: { ...where, sectionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.student.groupBy({
      by: ["programId", "classLevel"],
      where: { ...where, sectionId: null },
      _count: { _all: true },
    }),
  ]);
  return { byProgram, byClass, bySection, byWhole };
}

export function countStudents(where: Prisma.StudentWhereInput) {
  return prisma.student.count({ where });
}

export function createStudent(data: {
  schoolId: string;
  name: string;
  rollNo: string;
  email: string | null;
  parentName: string | null;
  parentPhone: string | null;
  programId: string;
  classLevel: number;
  sectionId: string | null;
  status: StudentStatus;
}) {
  return prisma.student.create({ data, include: studentInclude });
}

export function updateStudent(
  id: string,
  data: Prisma.StudentUpdateInput,
) {
  return prisma.student.update({ where: { id }, data, include: studentInclude });
}

export function deleteStudent(id: string) {
  return prisma.student.delete({ where: { id } });
}

export function listRollsBySectionId(sectionId: string) {
  return prisma.student.findMany({
    where: { sectionId },
    select: { rollNo: true },
  });
}

export function listRollsByClassLevel(schoolId: string, classLevel: number) {
  return prisma.student.findMany({
    where: { schoolId, classLevel },
    select: { rollNo: true },
  });
}

export function listWholeClassRolls(
  schoolId: string,
  programId: string,
  classLevel: number,
) {
  return prisma.student.findMany({
    where: { schoolId, programId, classLevel, sectionId: null },
    select: { rollNo: true },
  });
}

/** Detach roster rows from a section — students stay on the class (sectionId null). */
export function clearSectionId(sectionId: string) {
  return prisma.student.updateMany({
    where: { sectionId },
    data: { sectionId: null },
  });
}

/** Roster rows tied to a named section — hard delete when a class is fully purged. */
export function deleteStudentsBySectionId(sectionId: string) {
  return prisma.student.deleteMany({ where: { sectionId } });
}

/** Every roster row for a school class — removed when that class is fully deleted. */
export function deleteStudentsByClassLevel(schoolId: string, classLevel: number) {
  return prisma.student.deleteMany({ where: { schoolId, classLevel } });
}

/** Whole-class roster (no section) for one program/class — removed when that class is deleted. */
export function deleteWholeClassStudents(
  schoolId: string,
  programId: string,
  classLevel: number,
) {
  return prisma.student.deleteMany({
    where: { schoolId, programId, classLevel, sectionId: null },
  });
}

export function isRollTaken(schoolId: string, rollNo: string, excludeId?: string) {
  return prisma.student.findFirst({
    where: {
      schoolId,
      rollNo: { equals: rollNo, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
}

type TeacherScope =
  | { sectionId: string }
  | { programId: string; classLevel: number; sectionId: null }
  | { programId: string; classLevel: number };

export async function findStudentsForTeacher(
  schoolId: string,
  scopeOr: TeacherScope[],
  query: ListStudentsQuery,
) {
  const where: Prisma.StudentWhereInput = {
    schoolId,
    OR: scopeOr,
    ...(query.programId ? { programId: query.programId } : {}),
    ...(query.classLevel != null ? { classLevel: query.classLevel } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          AND: [
            {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { rollNo: { contains: query.q, mode: "insensitive" } },
                { email: { contains: query.q, mode: "insensitive" } },
                { parentName: { contains: query.q, mode: "insensitive" } },
                { parentPhone: { contains: query.q, mode: "insensitive" } },
              ],
            },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: studentListSelect,
      orderBy: [{ classLevel: "asc" }, { rollNo: "asc" }],
      skip,
      take: query.pageSize,
    }),
    prisma.student.count({ where }),
  ]);
  return { items, total };
}
