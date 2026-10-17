import type { Subject } from "../generated/prisma/client.js";
import { TeacherStatus } from "../generated/prisma/enums.js";
import * as schoolRepository from "../repositories/school.repository.js";
import * as teacherRepository from "../repositories/teacher.repository.js";
import type { TeacherRecord } from "../repositories/teacher.repository.js";
import type {
  CreateTeacherInput,
  ListTeachersQuery,
  SetClassTeacherInput,
  SetTeacherStatusInput,
  UpdateTeacherInput,
} from "../schemas/teacher.schema.js";
import { AppError } from "../utils/app-error.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { decryptSecret, encryptSecret } from "../utils/secret-box.js";
import {
  toSchoolRef,
  type SchoolAccountDto,
  type SchoolProgramDto,
} from "./school.service.js";

export type TeacherAssignmentDto = {
  programId: string;
  programCode: string;
  programName: string;
  classLevel: number;
  subject: Subject;
};

export type TeacherDto = {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  phone: string;
  status: TeacherStatus;
  assignments: TeacherAssignmentDto[];
  school: ReturnType<typeof toSchoolRef> & { type: SchoolAccountDto["type"] };
  createdAt: string;
  updatedAt: string;
};

export type TeacherDetailDto = TeacherDto & { password: string };

export type TeacherAccountDto = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: TeacherStatus;
  schoolId: string;
  assignments: TeacherAssignmentDto[];
  school: {
    id: string;
    name: string;
    code: string;
    type: SchoolAccountDto["type"];
    schoolPrograms: SchoolProgramDto[];
    programCodes: string[];
  };
};

function toAssignments(teacher: TeacherRecord): TeacherAssignmentDto[] {
  return teacher.assignments.map((row) => ({
    programId: row.programId,
    programCode: row.program.code,
    programName: row.program.name,
    classLevel: row.classLevel,
    subject: row.subject,
  }));
}

export function toTeacherDto(teacher: TeacherRecord): TeacherDto {
  return {
    id: teacher.id,
    schoolId: teacher.schoolId,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    status: teacher.status,
    assignments: toAssignments(teacher),
    school: { ...toSchoolRef(teacher.school), type: teacher.school.type },
    createdAt: teacher.createdAt.toISOString(),
    updatedAt: teacher.updatedAt.toISOString(),
  };
}

export function toTeacherDetailDto(teacher: TeacherRecord): TeacherDetailDto {
  return {
    ...toTeacherDto(teacher),
    password: decryptSecret(teacher.passwordEncrypted) ?? "",
  };
}

export function toTeacherAccountDto(teacher: TeacherRecord): TeacherAccountDto {
  const schoolPrograms = teacher.school.schoolPrograms.map((row) => ({
    programId: row.programId,
    programCode: row.program.code,
    programName: row.program.name,
    year: row.program.year,
    classFrom: row.program.classFrom,
    classTo: row.program.classTo,
    catalogSubjects: row.program.subjects,
    classes: row.classes.map((cls) => ({
      classLevel: cls.classLevel,
      subjects: cls.subjects,
    })),
  }));

  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    status: teacher.status,
    schoolId: teacher.schoolId,
    assignments: toAssignments(teacher),
    school: {
      id: teacher.school.id,
      name: teacher.school.name,
      code: teacher.school.code,
      type: teacher.school.type,
      schoolPrograms,
      programCodes: schoolPrograms.map((row) => row.programCode),
    },
  };
}

async function sealPassword(password: string) {
  return {
    passwordHash: await hashPassword(password),
    passwordEncrypted: encryptSecret(password),
  };
}

async function assertUniqueCredentials(email: string, phone: string, excludeId?: string) {
  const [emailTaken, phoneTaken] = await Promise.all([
    teacherRepository.isTeacherEmailTaken(email, excludeId),
    teacherRepository.isTeacherPhoneTaken(phone, excludeId),
  ]);

  const details: { path: string[]; message: string }[] = [];
  if (emailTaken) details.push({ path: ["email"], message: "Email already exists" });
  if (phoneTaken) details.push({ path: ["phone"], message: "Phone already exists" });
  if (details.length > 0) throw new AppError(409, "Teacher credentials already in use", details);
}

function assertAssignmentsAgainstSchool(
  assignments: { programId: string; classLevel: number; subject: Subject }[],
  school: Awaited<ReturnType<typeof schoolRepository.findSchoolById>>,
) {
  if (!school) throw new AppError(404, "School not found");

  const allowed = new Set(
    school.schoolPrograms.flatMap((row) =>
      row.classes.flatMap((cls) =>
        cls.subjects.map((subject) => `${row.programId}:${cls.classLevel}:${subject}`),
      ),
    ),
  );

  if (allowed.size === 0) {
    throw new AppError(400, "Enable programs and classes on the school before assigning teachers", [
      { path: ["assignments"], message: "This school has no class/subject offerings yet" },
    ]);
  }

  const invalid = assignments.find(
    (item) => !allowed.has(`${item.programId}:${item.classLevel}:${item.subject}`),
  );
  if (invalid) {
    throw new AppError(400, "Assignment is outside this school's offerings", [
      { path: ["assignments"], message: "Pick classes and subjects enabled for this school" },
    ]);
  }
}

export async function listTeachers(query: ListTeachersQuery) {
  const { items, total } = await teacherRepository.findTeachers(query);
  return {
    items: items.map(toTeacherDto),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getTeacher(id: string) {
  const teacher = await teacherRepository.findTeacherById(id);
  if (!teacher) throw new AppError(404, "Teacher not found");
  return toTeacherDetailDto(teacher);
}

function assertClassTeacherSlots(
  slots: { programId: string; classLevel: number }[],
  assignments: { programId: string; classLevel: number }[],
  school: Awaited<ReturnType<typeof schoolRepository.findSchoolById>>,
) {
  if (!school) throw new AppError(404, "School not found");
  const assigned = new Set(assignments.map((item) => `${item.programId}:${item.classLevel}`));
  const offered = new Set(
    school.schoolPrograms.flatMap((row) =>
      row.classes.map((cls) => `${row.programId}:${cls.classLevel}`),
    ),
  );

  for (const slot of slots) {
    const key = `${slot.programId}:${slot.classLevel}`;
    if (!offered.has(key)) {
      throw new AppError(400, "Class teacher slot is outside this school's offerings");
    }
    if (!assigned.has(key)) {
      throw new AppError(400, "Class teacher must be assigned at least one subject in that class");
    }
  }
}

export async function createTeacher(schoolId: string, input: CreateTeacherInput) {
  const school = await schoolRepository.findSchoolById(schoolId);
  assertAssignmentsAgainstSchool(input.assignments, school);
  assertClassTeacherSlots(input.classTeacherFor, input.assignments, school);
  await assertUniqueCredentials(input.email, input.phone);

  const sealed = await sealPassword(input.password);
  const teacher = await teacherRepository.createTeacher({
    schoolId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    status: input.status,
    ...sealed,
    assignments: input.assignments,
  });

  if (input.classTeacherFor.length > 0) {
    await teacherRepository.syncTeacherClassTeacherSlots(
      schoolId,
      teacher.id,
      input.classTeacherFor,
    );
  }

  return toTeacherDetailDto(teacher);
}

export async function updateTeacher(id: string, input: UpdateTeacherInput, schoolId?: string) {
  const existing = await teacherRepository.findTeacherById(id);
  if (!existing) throw new AppError(404, "Teacher not found");
  if (schoolId && existing.schoolId !== schoolId) throw new AppError(404, "Teacher not found");

  if (input.assignments) {
    const school = await schoolRepository.findSchoolById(existing.schoolId);
    assertAssignmentsAgainstSchool(input.assignments, school);
    if (input.classTeacherFor) {
      assertClassTeacherSlots(input.classTeacherFor, input.assignments, school);
    }
  }

  if (input.email || input.phone) {
    await assertUniqueCredentials(
      input.email ?? existing.email,
      input.phone ?? existing.phone,
      id,
    );
  }

  let sealed: { passwordHash?: string; passwordEncrypted?: string } = {};
  if (input.password) {
    const unchanged =
      existing.passwordHash && (await verifyPassword(input.password, existing.passwordHash));
    if (!unchanged) sealed = await sealPassword(input.password);
  }

  const teacher = await teacherRepository.updateTeacher(id, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    status: input.status,
    ...sealed,
    assignments: input.assignments,
  });

  if (input.classTeacherFor) {
    await teacherRepository.syncTeacherClassTeacherSlots(
      existing.schoolId,
      id,
      input.classTeacherFor,
    );
  }

  return toTeacherDetailDto(teacher);
}

export async function setTeacherStatus(
  id: string,
  input: SetTeacherStatusInput,
  schoolId?: string,
) {
  const existing = await teacherRepository.findTeacherById(id);
  if (!existing) throw new AppError(404, "Teacher not found");
  if (schoolId && existing.schoolId !== schoolId) throw new AppError(404, "Teacher not found");

  const teacher = await teacherRepository.setTeacherStatus(id, input.status);
  return toTeacherDto(teacher);
}

export async function deleteTeacher(id: string, schoolId?: string) {
  const existing = await teacherRepository.findTeacherById(id);
  if (!existing) throw new AppError(404, "Teacher not found");
  if (schoolId && existing.schoolId !== schoolId) throw new AppError(404, "Teacher not found");
  await teacherRepository.deleteTeacher(id);
}

export async function getSchoolTeacherStats(schoolId: string) {
  const [total, active] = await Promise.all([
    teacherRepository.countTeachers({ schoolId }),
    teacherRepository.countTeachers({ schoolId, status: TeacherStatus.ACTIVE }),
  ]);
  return { total, active };
}

export async function listSchoolClasses(schoolId: string) {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");

  const classTeachers = await teacherRepository.listClassTeachers(schoolId);
  const bySlot = new Map(
    classTeachers
      .filter((row) => row.teacher.status === TeacherStatus.ACTIVE)
      .map((row) => [
        `${row.programId}:${row.classLevel}`,
        {
          id: row.id,
          teacherId: row.teacherId,
          name: row.teacher.name,
          email: row.teacher.email,
          status: row.teacher.status,
        },
      ]),
  );

  return school.schoolPrograms.flatMap((program) =>
    program.classes.map((cls) => ({
      programId: program.programId,
      programCode: program.program.code,
      programName: program.program.name,
      year: program.program.year,
      classLevel: cls.classLevel,
      subjects: cls.subjects,
      classTeacher: bySlot.get(`${program.programId}:${cls.classLevel}`) ?? null,
    })),
  );
}

export async function listClassTeacherSlots(schoolId: string) {
  const rows = await teacherRepository.listClassTeachers(schoolId);
  return rows
    .filter((row) => row.teacher.status === TeacherStatus.ACTIVE)
    .map((row) => ({
      programId: row.programId,
      programCode: row.program.code,
      programName: row.program.name,
      classLevel: row.classLevel,
      teacherId: row.teacherId,
      teacherName: row.teacher.name,
    }));
}

export async function listClassTeachersForTeacher(teacherId: string) {
  return teacherRepository.listClassTeachersForTeacher(teacherId);
}

export async function setClassTeacher(schoolId: string, input: SetClassTeacherInput) {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");

  const offering = school.schoolPrograms.find((row) => row.programId === input.programId);
  if (!offering?.classes.some((cls) => cls.classLevel === input.classLevel)) {
    throw new AppError(400, "This class is not enabled for the selected program");
  }

  if (input.teacherId) {
    const teacher = await teacherRepository.findTeacherById(input.teacherId);
    if (!teacher || teacher.schoolId !== schoolId) {
      throw new AppError(400, "Class teacher must belong to this school");
    }
    if (teacher.status !== TeacherStatus.ACTIVE) {
      throw new AppError(400, "Only active teachers can be class teachers");
    }
  }

  const row = await teacherRepository.setSoleClassTeacher(
    schoolId,
    input.programId,
    input.classLevel,
    input.teacherId,
  );

  return row
    ? {
        id: row.id,
        teacherId: row.teacherId,
        name: row.teacher.name,
        email: row.teacher.email,
        status: row.teacher.status,
      }
    : null;
}
