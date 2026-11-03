import { randomInt } from "node:crypto";
import { StudentStatus } from "../generated/prisma/enums.js";
import * as schoolClassRepository from "../repositories/school-class.repository.js";
import * as schoolRepository from "../repositories/school.repository.js";
import * as sectionRepository from "../repositories/section.repository.js";
import * as studentRepository from "../repositories/student.repository.js";
import type {
  CreateStudentInput,
  ListStudentsQuery,
  UpdateStudentInput,
} from "../schemas/student.schema.js";
import { AppError } from "../utils/app-error.js";
import { hashPassword } from "../utils/password.js";
import { decryptSecret, encryptSecret } from "../utils/secret-box.js";
import { sendStudentCredentialsEmail } from "./mail.service.js";
import type { TeacherAccountDto } from "./teacher.service.js";

export type StudentDto = {
  id: string;
  schoolId: string;
  schoolName: string;
  name: string;
  rollNo: string;
  email: string | null;
  programId: string;
  programCode: string;
  programName: string;
  classLevel: number;
  sectionId: string | null;
  sectionName: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
};

export type StudentDetailDto = StudentDto & {
  password: string;
  school: { id: string; name: string; code: string };
};

export type StudentAccountDto = StudentDto & {
  school: { id: string; name: string; code: string };
};

type StudentRecord = NonNullable<Awaited<ReturnType<typeof studentRepository.findStudentById>>>;

type StudentListRow = {
  id: string;
  schoolId: string;
  name: string;
  rollNo: string;
  email: string | null;
  programId: string;
  classLevel: number;
  sectionId: string | null;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
  school: { name: string };
  program: { code: string; name: string };
  section: { name: string } | null;
};

function toStudentDto(row: StudentListRow): StudentDto {
  return {
    id: row.id,
    schoolId: row.schoolId,
    schoolName: row.school.name,
    name: row.name,
    rollNo: row.rollNo,
    email: row.email,
    programId: row.programId,
    programCode: row.program.code,
    programName: row.program.name,
    classLevel: row.classLevel,
    sectionId: row.sectionId,
    sectionName: row.section?.name ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toStudentAccountDto(row: StudentRecord): StudentAccountDto {
  return {
    ...toStudentDto(row),
    school: {
      id: row.school.id,
      name: row.school.name,
      code: row.school.code,
    },
  };
}

function toStudentDetailDto(row: StudentRecord): StudentDetailDto {
  return {
    ...toStudentAccountDto(row),
    password: decryptSecret(row.passwordEncrypted) ?? "",
  };
}

async function sealPassword(password: string) {
  return {
    passwordHash: await hashPassword(password),
    passwordEncrypted: encryptSecret(password),
  };
}

function generatePassword() {
  const chunk = randomInt(0, 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  const digits = String(randomInt(1000, 10_000));
  return `${chunk}${digits}`;
}

async function assertSchoolOffering(
  schoolId: string,
  programId: string,
  classLevel: number,
) {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");

  const offering = school.schoolPrograms.find((row) => row.programId === programId);
  if (!offering?.classes.some((cls) => cls.classLevel === classLevel)) {
    throw new AppError(400, "This program is not enabled for the selected class", [
      { path: ["programId"], message: "Pick a program and class enabled for this school" },
    ]);
  }
  return school;
}

/**
 * Seat check against section or whole-class strength.
 * Section strength = SchoolSection.studentCount; whole class = SchoolClass.studentCount.
 */
async function assertSeatAvailable(
  schoolId: string,
  programId: string,
  classLevel: number,
  sectionId: string | null,
  excludeStudentId?: string,
) {
  if (sectionId) {
    const section = await sectionRepository.findSectionById(sectionId);
    if (!section || section.schoolId !== schoolId) {
      throw new AppError(400, "Section not found", [
        { path: ["sectionId"], message: "Pick a valid section" },
      ]);
    }
    if (section.programId !== programId || section.classLevel !== classLevel) {
      throw new AppError(400, "Section does not match program and class", [
        { path: ["sectionId"], message: "Section must match the selected program and class" },
      ]);
    }
    const enrolled = await studentRepository.countStudents({
      schoolId,
      sectionId,
      ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}),
    });
    if (enrolled >= section.studentCount) {
      throw new AppError(
        400,
        `Section ${section.name} is full (${enrolled}/${section.studentCount} seats).`,
        [{ path: ["sectionId"], message: "No seats left in this section" }],
      );
    }
    return;
  }

  const sectionsHere = await sectionRepository.listSectionsBySchool(schoolId);
  const hasSections = sectionsHere.some(
    (row) => row.programId === programId && row.classLevel === classLevel,
  );
  if (hasSections) {
    throw new AppError(400, "This class has sections — pick a section for the student", [
      { path: ["sectionId"], message: "Section is required when sections exist" },
    ]);
  }

  const whole = await schoolClassRepository.findSchoolClassByLevel(schoolId, classLevel);
  if (!whole || whole.programId !== programId) {
    throw new AppError(400, "Add this class (without sections) before enrolling students", [
      { path: ["classLevel"], message: "Create the whole class first under Classes" },
    ]);
  }

  const enrolled = await studentRepository.countStudents({
    schoolId,
    programId,
    classLevel,
    sectionId: null,
    ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}),
  });
  if (enrolled >= whole.studentCount) {
    throw new AppError(
      400,
      `Class ${classLevel} is full (${enrolled}/${whole.studentCount} seats).`,
      [{ path: ["classLevel"], message: "No seats left in this class" }],
    );
  }
}

async function assertUniqueRoll(schoolId: string, rollNo: string, excludeId?: string) {
  const taken = await studentRepository.isRollTaken(schoolId, rollNo, excludeId);
  if (taken) {
    throw new AppError(409, "Registration number already exists in this school", [
      { path: ["rollNo"], message: "Registration number already exists" },
    ]);
  }
}

export async function listStudents(query: ListStudentsQuery, schoolId?: string) {
  const { items, total } = await studentRepository.findStudents({
    ...query,
    schoolId: schoolId ?? query.schoolId,
  });
  return {
    items: items.map(toStudentDto),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getSchoolStudentCounts(schoolId: string) {
  const grouped = await studentRepository.countStudentsGrouped(schoolId);
  return {
    byProgram: Object.fromEntries(
      grouped.byProgram.map((row) => [row.programId, row._count._all]),
    ),
    byClass: grouped.byClass.map((row) => ({
      programId: row.programId,
      classLevel: row.classLevel,
      count: row._count._all,
    })),
    bySection: Object.fromEntries(
      grouped.bySection.map((row) => [row.sectionId ?? "", row._count._all]),
    ),
    byWhole: grouped.byWhole.map((row) => ({
      programId: row.programId,
      classLevel: row.classLevel,
      count: row._count._all,
    })),
  };
}

export async function getStudent(id: string, schoolId?: string) {
  const student = await studentRepository.findStudentById(id);
  if (!student || (schoolId && student.schoolId !== schoolId)) {
    throw new AppError(404, "Student not found");
  }
  return toStudentDetailDto(student);
}

export async function createStudent(schoolId: string, input: CreateStudentInput) {
  const sectionId = input.sectionId ?? null;
  await assertSchoolOffering(schoolId, input.programId, input.classLevel);
  await assertUniqueRoll(schoolId, input.rollNo);
  await assertSeatAvailable(schoolId, input.programId, input.classLevel, sectionId);

  const password = input.password?.trim() || generatePassword();
  const sealed = await sealPassword(password);
  const school = await schoolRepository.findSchoolById(schoolId);

  const student = await studentRepository.createStudent({
    schoolId,
    name: input.name,
    rollNo: input.rollNo.trim(),
    email: input.email?.trim().toLowerCase() || null,
    programId: input.programId,
    classLevel: input.classLevel,
    sectionId,
    status: input.status ?? StudentStatus.ACTIVE,
    ...sealed,
  });

  if (student.email) {
    await sendStudentCredentialsEmail({
      to: student.email,
      studentName: student.name,
      schoolName: school?.name ?? student.school.name,
      schoolEmail: school?.accountEmail ?? null,
      schoolCode: school?.code ?? student.school.code,
      rollNo: student.rollNo,
      password,
      reason: "created",
    });
  }

  return toStudentDetailDto(student);
}

export async function updateStudent(
  id: string,
  input: UpdateStudentInput,
  schoolId?: string,
) {
  const existing = await studentRepository.findStudentById(id);
  if (!existing || (schoolId && existing.schoolId !== schoolId)) {
    throw new AppError(404, "Student not found");
  }

  const nextProgramId = input.programId ?? existing.programId;
  const nextClassLevel = input.classLevel ?? existing.classLevel;
  const nextSectionId =
    input.sectionId !== undefined ? input.sectionId : existing.sectionId;
  const nextRoll = input.rollNo?.trim() ?? existing.rollNo;

  if (input.programId || input.classLevel !== undefined) {
    await assertSchoolOffering(existing.schoolId, nextProgramId, nextClassLevel);
  }
  if (input.rollNo && input.rollNo.trim().toLowerCase() !== existing.rollNo.toLowerCase()) {
    await assertUniqueRoll(existing.schoolId, nextRoll, id);
  }

  const placementChanged =
    nextProgramId !== existing.programId ||
    nextClassLevel !== existing.classLevel ||
    nextSectionId !== existing.sectionId;
  if (placementChanged) {
    await assertSeatAvailable(
      existing.schoolId,
      nextProgramId,
      nextClassLevel,
      nextSectionId,
      id,
    );
  }

  const sealed =
    input.password !== undefined ? await sealPassword(input.password) : undefined;

  const student = await studentRepository.updateStudent(id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.rollNo !== undefined ? { rollNo: nextRoll } : {}),
    ...(input.email !== undefined
      ? { email: input.email?.trim().toLowerCase() || null }
      : {}),
    ...(input.programId !== undefined ? { program: { connect: { id: nextProgramId } } } : {}),
    ...(input.classLevel !== undefined ? { classLevel: nextClassLevel } : {}),
    ...(input.sectionId !== undefined
      ? nextSectionId
        ? { section: { connect: { id: nextSectionId } } }
        : { section: { disconnect: true } }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...sealed,
  });

  return toStudentDetailDto(student);
}

export async function setStudentStatus(id: string, status: StudentStatus, schoolId?: string) {
  const existing = await studentRepository.findStudentById(id);
  if (!existing || (schoolId && existing.schoolId !== schoolId)) {
    throw new AppError(404, "Student not found");
  }
  const student = await studentRepository.updateStudent(id, { status });
  return toStudentDto(student);
}

export async function resetStudentPassword(id: string, password: string, schoolId?: string) {
  const existing = await studentRepository.findStudentById(id);
  if (!existing || (schoolId && existing.schoolId !== schoolId)) {
    throw new AppError(404, "Student not found");
  }
  const sealed = await sealPassword(password);
  const student = await studentRepository.updateStudent(id, sealed);

  if (student.email) {
    await sendStudentCredentialsEmail({
      to: student.email,
      studentName: student.name,
      schoolName: student.school.name,
      schoolEmail: student.school.accountEmail,
      schoolCode: student.school.code,
      rollNo: student.rollNo,
      password,
      reason: "password-reset",
    });
  }

  return toStudentDetailDto(student);
}

export async function sendStudentCredentials(id: string, schoolId?: string) {
  const student = await studentRepository.findStudentById(id);
  if (!student || (schoolId && student.schoolId !== schoolId)) {
    throw new AppError(404, "Student not found");
  }
  if (!student.email) {
    throw new AppError(400, "This student has no email on file");
  }
  const password = decryptSecret(student.passwordEncrypted);
  if (!password) throw new AppError(500, "Could not read stored password");

  const sent = await sendStudentCredentialsEmail({
    to: student.email,
    studentName: student.name,
    schoolName: student.school.name,
    schoolEmail: student.school.accountEmail,
    schoolCode: student.school.code,
    rollNo: student.rollNo,
    password,
    reason: "resend",
  });
  if (!sent) throw new AppError(502, "Could not send credentials email");
  return { ok: true as const };
}

export async function deleteStudent(id: string, schoolId?: string) {
  const existing = await studentRepository.findStudentById(id);
  if (!existing || (schoolId && existing.schoolId !== schoolId)) {
    throw new AppError(404, "Student not found");
  }
  await studentRepository.deleteStudent(id);
  return { ok: true as const };
}

/** Students visible to a teacher: class-teacher slots + assigned program/class levels. */
export async function listTeacherStudents(
  teacher: TeacherAccountDto,
  query: ListStudentsQuery,
) {
  const scopeOr: Array<
    | { sectionId: string }
    | { programId: string; classLevel: number; sectionId: null }
    | { programId: string; classLevel: number }
  > = [];

  for (const slot of teacher.classTeacherSections ?? []) {
    if (slot.kind === "section" && slot.sectionId) {
      scopeOr.push({ sectionId: slot.sectionId });
    } else if (slot.kind === "class") {
      scopeOr.push({
        programId: slot.programId,
        classLevel: slot.classLevel,
        sectionId: null,
      });
    }
  }

  for (const row of teacher.assignments) {
    scopeOr.push({ programId: row.programId, classLevel: row.classLevel });
  }

  if (scopeOr.length === 0) {
    return {
      items: [] as StudentDto[],
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        totalPages: 1,
      },
    };
  }

  const { items, total } = await studentRepository.findStudentsForTeacher(
    teacher.schoolId,
    scopeOr,
    query,
  );

  return {
    items: items.map(toStudentDto),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}
