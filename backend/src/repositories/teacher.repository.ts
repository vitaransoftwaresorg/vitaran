import { prisma } from "../config/database.js";
import type { Prisma, Subject } from "../generated/prisma/client.js";
import { TeacherStatus } from "../generated/prisma/enums.js";
import type { ListTeachersQuery } from "../schemas/teacher.schema.js";

const teacherInclude = {
  assignments: {
    include: { program: true },
    orderBy: [{ program: { name: "asc" } }, { classLevel: "asc" }, { subject: "asc" }],
  },
  school: {
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      status: true,
      schoolPrograms: {
        include: {
          program: true,
          classes: { orderBy: { classLevel: "asc" } },
        },
      },
    },
  },
} satisfies Prisma.TeacherInclude;

export type TeacherRecord = Prisma.TeacherGetPayload<{ include: typeof teacherInclude }>;

function buildWhere(query: ListTeachersQuery): Prisma.TeacherWhereInput {
  const where: Prisma.TeacherWhereInput = {};
  if (query.schoolId) where.schoolId = query.schoolId;
  if (query.status) where.status = query.status;

  if (query.search) {
    const contains = { contains: query.search, mode: "insensitive" } as const;
    where.OR = [{ name: contains }, { email: contains }, { phone: contains }];
  }

  return where;
}

export async function findTeachers(query: ListTeachersQuery) {
  const where = buildWhere(query);
  const [items, total] = await prisma.$transaction([
    prisma.teacher.findMany({
      where,
      include: teacherInclude,
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.teacher.count({ where }),
  ]);
  return { items, total };
}

export function findTeacherById(id: string) {
  return prisma.teacher.findUnique({ where: { id }, include: teacherInclude });
}

export function findTeacherByAccount(account: { email?: string; phone?: string }) {
  return prisma.teacher.findFirst({
    where: account.email
      ? { email: { equals: account.email, mode: "insensitive" } }
      : { phone: account.phone },
    include: teacherInclude,
  });
}

export function countTeachers(where?: Prisma.TeacherWhereInput) {
  return prisma.teacher.count({ where });
}

export async function isTeacherEmailTaken(email: string, excludeId?: string) {
  const count = await prisma.teacher.count({
    where: {
      email: { equals: email, mode: "insensitive" },
      ...(excludeId && { NOT: { id: excludeId } }),
    },
  });
  return count > 0;
}

export async function isTeacherPhoneTaken(phone: string, excludeId?: string) {
  const count = await prisma.teacher.count({
    where: { phone, ...(excludeId && { NOT: { id: excludeId } }) },
  });
  return count > 0;
}

export function createTeacher(data: {
  schoolId: string;
  name: string;
  email: string;
  phone: string;
  status: TeacherStatus;
  passwordHash: string;
  passwordEncrypted: string;
  assignments: { programId: string; classLevel: number; subject: Subject }[];
}) {
  const { assignments, ...teacher } = data;
  return prisma.teacher.create({
    data: {
      ...teacher,
      assignments: { create: assignments },
    },
    include: teacherInclude,
  });
}

export async function updateTeacher(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    status?: TeacherStatus;
    passwordHash?: string;
    passwordEncrypted?: string;
    assignments?: { programId: string; classLevel: number; subject: Subject }[];
  },
) {
  const { assignments, ...fields } = data;

  return prisma.$transaction(async (tx) => {
    if (assignments) {
      await tx.teacherAssignment.deleteMany({ where: { teacherId: id } });
      await tx.teacherAssignment.createMany({
        data: assignments.map((assignment) => ({ teacherId: id, ...assignment })),
      });
    }

    return tx.teacher.update({
      where: { id },
      data: fields,
      include: teacherInclude,
    });
  });
}

export async function setTeacherStatus(id: string, status: TeacherStatus) {
  return prisma.$transaction(async (tx) => {
    // Inactive teachers must not remain assigned as class teachers.
    if (status === TeacherStatus.INACTIVE) {
      await tx.classTeacher.deleteMany({ where: { teacherId: id } });
    }
    return tx.teacher.update({
      where: { id },
      data: { status },
      include: teacherInclude,
    });
  });
}

export function deleteTeacher(id: string) {
  return prisma.teacher.delete({ where: { id } });
}

/** Drop assignments that no longer match the school's class/subject offerings. */
export async function pruneAssignmentsOutsideSchoolOfferings(schoolId: string) {
  const offerings = await prisma.schoolProgram.findMany({
    where: { schoolId },
    include: { classes: true },
  });

  const allowed = new Set(
    offerings.flatMap((row) =>
      row.classes.flatMap((cls) =>
        cls.subjects.map((subject) => `${row.programId}:${cls.classLevel}:${subject}`),
      ),
    ),
  );

  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacher: { schoolId } },
    select: { id: true, programId: true, classLevel: true, subject: true },
  });

  const staleIds = assignments
    .filter((row) => !allowed.has(`${row.programId}:${row.classLevel}:${row.subject}`))
    .map((row) => row.id);

  if (staleIds.length === 0) return { count: 0 };
  return prisma.teacherAssignment.deleteMany({ where: { id: { in: staleIds } } });
}

export function listClassTeachers(schoolId: string, programId?: string, classLevel?: number) {
  return prisma.classTeacher.findMany({
    where: {
      schoolId,
      ...(programId ? { programId } : {}),
      ...(classLevel !== undefined ? { classLevel } : {}),
    },
    include: {
      teacher: { select: { id: true, name: true, email: true, status: true } },
      program: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ program: { name: "asc" } }, { classLevel: "asc" }, { teacher: { name: "asc" } }],
  });
}

export function listClassTeachersForTeacher(teacherId: string) {
  return prisma.classTeacher.findMany({
    where: { teacherId },
    select: { programId: true, classLevel: true },
  });
}

/** Replace every class teacher for this slot with zero or one teacher. */
export async function setSoleClassTeacher(
  schoolId: string,
  programId: string,
  classLevel: number,
  teacherId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    await tx.classTeacher.deleteMany({ where: { schoolId, programId, classLevel } });
    if (!teacherId) return null;
    return tx.classTeacher.create({
      data: { schoolId, programId, classLevel, teacherId },
      include: {
        teacher: { select: { id: true, name: true, email: true, status: true } },
      },
    });
  });
}

/** Apply class-teacher toggles for one teacher after create/update. */
export async function syncTeacherClassTeacherSlots(
  schoolId: string,
  teacherId: string,
  slots: { programId: string; classLevel: number }[],
) {
  const wanted = new Set(slots.map((slot) => `${slot.programId}:${slot.classLevel}`));
  const existing = await prisma.classTeacher.findMany({
    where: { schoolId, teacherId },
    select: { programId: true, classLevel: true },
  });

  for (const row of existing) {
    const key = `${row.programId}:${row.classLevel}`;
    if (!wanted.has(key)) {
      await prisma.classTeacher.deleteMany({
        where: {
          schoolId,
          teacherId,
          programId: row.programId,
          classLevel: row.classLevel,
        },
      });
    }
  }

  for (const slot of slots) {
    await setSoleClassTeacher(schoolId, slot.programId, slot.classLevel, teacherId);
  }
}
