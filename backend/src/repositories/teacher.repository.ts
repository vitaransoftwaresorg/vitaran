import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";
import { TeacherStatus } from "../generated/prisma/enums.js";
import type { ListTeachersQuery } from "../schemas/teacher.schema.js";

const teacherInclude = {
  assignments: {
    include: { program: true },
    orderBy: [{ program: { name: "asc" } }, { classLevel: "asc" }, { subject: "asc" }],
  },
  classTeacherOf: {
    include: { program: { select: { id: true, code: true, name: true } } },
    orderBy: [{ classLevel: "asc" as const }, { name: "asc" as const }],
  },
  classTeacherOfClasses: {
    include: { program: { select: { id: true, code: true, name: true } } },
    orderBy: [{ classLevel: "asc" as const }],
  },
  school: {
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      status: true,
      accountEmail: true,
      schoolPrograms: {
        orderBy: { program: { name: "asc" as const } },
        select: {
          programId: true,
          program: {
            select: {
              code: true,
              name: true,
              type: true,
              year: true,
              classFrom: true,
              classTo: true,
              subjects: true,
            },
          },
          classes: { orderBy: { classLevel: "asc" as const }, select: { classLevel: true, subjects: true } },
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
  assignments: { programId: string; classLevel: number; subject: string }[];
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
    assignments?: { programId: string; classLevel: number; subject: string }[];
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

/** Minimal row for status toggles (skip assignments / program graph). */
export function findTeacherStatusTarget(id: string) {
  return prisma.teacher.findUnique({
    where: { id },
    select: {
      id: true,
      schoolId: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      school: { select: { id: true, name: true, code: true, type: true } },
    },
  });
}

/** Fast status flip — no heavy include. */
export async function setTeacherStatus(id: string, status: TeacherStatus) {
  await prisma.$transaction(async (tx) => {
    // Disabled teachers must leave class-teacher slots so Classes updates immediately.
    if (status === TeacherStatus.INACTIVE) {
      await tx.schoolSection.updateMany({
        where: { classTeacherId: id },
        data: { classTeacherId: null },
      });
      await tx.classTeacher.deleteMany({ where: { teacherId: id } });
    }
    await tx.teacher.update({ where: { id }, data: { status } });
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

export function listSectionsWithClassTeachers(schoolId: string) {
  return prisma.schoolSection.findMany({
    where: { schoolId },
    include: {
      program: { select: { id: true, code: true, name: true, year: true } },
      classTeacher: { select: { id: true, name: true, email: true, status: true } },
    },
    orderBy: [{ classLevel: "asc" }, { name: "asc" }],
  });
}

export function listClassLevelTeachers(schoolId: string) {
  return prisma.classTeacher.findMany({
    where: { schoolId },
    include: {
      teacher: { select: { id: true, name: true, email: true, status: true } },
      program: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ classLevel: "asc" }, { program: { name: "asc" } }],
  });
}

export function listClassTeacherSlotsForTeacher(teacherId: string) {
  return Promise.all([
    prisma.classTeacher.findMany({
      where: { teacherId },
      select: {
        programId: true,
        classLevel: true,
        program: { select: { code: true, name: true } },
      },
    }),
    prisma.schoolSection.findMany({
      where: { classTeacherId: teacherId },
      select: {
        id: true,
        classLevel: true,
        name: true,
        programId: true,
        program: { select: { code: true, name: true } },
      },
      orderBy: [{ classLevel: "asc" }, { name: "asc" }],
    }),
  ]);
}

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

/** Clear class-level CT when the school starts creating sections for that class. */
export function clearClassLevelTeacher(
  schoolId: string,
  programId: string,
  classLevel: number,
) {
  return prisma.classTeacher.deleteMany({ where: { schoolId, programId, classLevel } });
}

/** Sync both class-level and section-level class-teacher picks for one teacher. */
export async function syncTeacherClassTeacherSlots(
  schoolId: string,
  teacherId: string,
  classSlots: { programId: string; classLevel: number }[],
  sectionIds: string[],
) {
  const wantedClasses = new Set(
    classSlots.map((slot) => `${slot.programId}:${slot.classLevel}`),
  );
  const existingClasses = await prisma.classTeacher.findMany({
    where: { schoolId, teacherId },
    select: { programId: true, classLevel: true },
  });

  for (const row of existingClasses) {
    const key = `${row.programId}:${row.classLevel}`;
    if (!wantedClasses.has(key)) {
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

  for (const slot of classSlots) {
    await setSoleClassTeacher(schoolId, slot.programId, slot.classLevel, teacherId);
  }

  const wantedSections = new Set(sectionIds);
  const ownedSections = await prisma.schoolSection.findMany({
    where: { schoolId, classTeacherId: teacherId },
    select: { id: true },
  });

  const releaseIds = ownedSections.map((row) => row.id).filter((id) => !wantedSections.has(id));
  if (releaseIds.length > 0) {
    await prisma.schoolSection.updateMany({
      where: { id: { in: releaseIds } },
      data: { classTeacherId: null },
    });
  }

  if (sectionIds.length === 0) return;

  const targets = await prisma.schoolSection.findMany({
    where: { schoolId, id: { in: sectionIds } },
    select: { id: true, classTeacherId: true },
  });

  for (const row of targets) {
    if (row.classTeacherId && row.classTeacherId !== teacherId) {
      throw new Error(`SECTION_TAKEN:${row.id}`);
    }
  }

  await prisma.schoolSection.updateMany({
    where: { schoolId, id: { in: sectionIds } },
    data: { classTeacherId: teacherId },
  });
}

export function setTeacherPasswordHash(id: string, passwordHash: string) {
  return prisma.teacher.update({ where: { id }, data: { passwordHash }, select: { id: true } });
}
