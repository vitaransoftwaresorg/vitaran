import { StudentStatus } from "../generated/prisma/enums.js";
import { displaySectionName } from "../utils/section-label.js";
import * as schoolClassRepository from "../repositories/school-class.repository.js";
import * as schoolRepository from "../repositories/school.repository.js";
import * as sectionRepository from "../repositories/section.repository.js";
import * as studentRepository from "../repositories/student.repository.js";
import type {
  CreateStudentInput,
  CreateStudentsBulkInput,
  ListStudentsQuery,
  UpdateStudentInput,
} from "../schemas/student.schema.js";
import { AppError } from "../utils/app-error.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { studentTestResults } from "./student-performance.service.js";
import type { TeacherAccountDto } from "./teacher.service.js";

const KIND = "students" as const;

export type StudentDto = {
  id: string;
  schoolId: string;
  schoolName: string;
  name: string;
  rollNo: string;
  email: string | null;
  parentName: string | null;
  parentPhone: string | null;
  programId: string;
  programCode: string;
  programName: string;
  classLevel: number;
  sectionId: string | null;
  /** Always set — whole class (no section row) displays as A. */
  sectionName: string;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
};

export type StudentDetailDto = StudentDto & {
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
  parentName: string | null;
  parentPhone: string | null;
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
    parentName: row.parentName,
    parentPhone: row.parentPhone,
    programId: row.programId,
    programCode: row.program.code,
    programName: row.program.name,
    classLevel: row.classLevel,
    sectionId: row.sectionId,
    sectionName: displaySectionName(row.section?.name),
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
  return toStudentAccountDto(row);
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
  seatsNeeded = 1,
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
    if (enrolled + seatsNeeded > section.studentCount) {
      throw new AppError(
        400,
        `Section ${section.name} needs ${seatsNeeded} seat${seatsNeeded === 1 ? "" : "s"} but only ${Math.max(0, section.studentCount - enrolled)} left (${enrolled}/${section.studentCount} used).`,
        [{ path: ["sectionId"], message: "Not enough seats in this section" }],
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
  if (enrolled + seatsNeeded > whole.studentCount) {
    throw new AppError(
      400,
      `Class ${classLevel} needs ${seatsNeeded} seat${seatsNeeded === 1 ? "" : "s"} but only ${Math.max(0, whole.studentCount - enrolled)} left (${enrolled}/${whole.studentCount} used).`,
      [{ path: ["classLevel"], message: "Not enough seats in this class" }],
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

  const student = await studentRepository.createStudent({
    schoolId,
    name: input.name,
    rollNo: input.rollNo.trim(),
    email: input.email?.trim().toLowerCase() || null,
    parentName: input.parentName.trim(),
    parentPhone: input.parentPhone,
    programId: input.programId,
    classLevel: input.classLevel,
    sectionId,
    status: input.status ?? StudentStatus.ACTIVE,
  });

  notifyContentChanged({ kind: KIND, schoolId });
  return toStudentDetailDto(student);
}

export async function createStudentsBulk(schoolId: string, input: CreateStudentsBulkInput) {
  const sectionId = input.sectionId ?? null;
  const rows = input.students;

  await assertSchoolOffering(schoolId, input.programId, input.classLevel);
  await assertSeatAvailable(
    schoolId,
    input.programId,
    input.classLevel,
    sectionId,
    undefined,
    rows.length,
  );

  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const key = row.rollNo.trim().toLowerCase();
    if (seen.has(key)) {
      throw new AppError(400, `Duplicate registration number in row ${index + 1}`, [
        { path: ["students", String(index), "rollNo"], message: "Duplicate registration number" },
      ]);
    }
    seen.add(key);
  }

  for (const [index, row] of rows.entries()) {
    const taken = await studentRepository.isRollTaken(schoolId, row.rollNo);
    if (taken) {
      throw new AppError(409, `Registration number already exists (row ${index + 1})`, [
        {
          path: ["students", String(index), "rollNo"],
          message: "Registration number already exists",
        },
      ]);
    }
  }

  const created: StudentDetailDto[] = [];

  for (const row of rows) {
    const student = await studentRepository.createStudent({
      schoolId,
      name: row.name,
      rollNo: row.rollNo.trim(),
      email: row.email?.trim().toLowerCase() || null,
      parentName: row.parentName.trim(),
      parentPhone: row.parentPhone,
      programId: input.programId,
      classLevel: input.classLevel,
      sectionId,
      status: StudentStatus.ACTIVE,
    });
    created.push(toStudentDetailDto(student));
  }

  notifyContentChanged({ kind: KIND, schoolId });
  return { items: created, count: created.length };
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

  const student = await studentRepository.updateStudent(id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.rollNo !== undefined ? { rollNo: nextRoll } : {}),
    ...(input.email !== undefined
      ? { email: input.email?.trim().toLowerCase() || null }
      : {}),
    ...(input.parentName !== undefined ? { parentName: input.parentName.trim() } : {}),
    ...(input.parentPhone !== undefined ? { parentPhone: input.parentPhone } : {}),
    ...(input.programId !== undefined ? { program: { connect: { id: nextProgramId } } } : {}),
    ...(input.classLevel !== undefined ? { classLevel: nextClassLevel } : {}),
    ...(input.sectionId !== undefined
      ? nextSectionId
        ? { section: { connect: { id: nextSectionId } } }
        : { section: { disconnect: true } }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });

  notifyContentChanged({ kind: KIND, schoolId: student.schoolId });
  return toStudentDetailDto(student);
}

export async function setStudentStatus(id: string, status: StudentStatus, schoolId?: string) {
  const existing = await studentRepository.findStudentById(id);
  if (!existing || (schoolId && existing.schoolId !== schoolId)) {
    throw new AppError(404, "Student not found");
  }
  const student = await studentRepository.updateStudent(id, { status });
  notifyContentChanged({ kind: KIND, schoolId: student.schoolId });
  return toStudentDto(student);
}

export async function deleteStudent(id: string, schoolId?: string) {
  const existing = await studentRepository.findStudentById(id);
  if (!existing || (schoolId && existing.schoolId !== schoolId)) {
    throw new AppError(404, "Student not found");
  }
  await studentRepository.deleteStudent(id);
  notifyContentChanged({ kind: KIND, schoolId: existing.schoolId });
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

/** Class-teacher sections and subject assignments decide which students a teacher may open. */
function teacherCanSee(
  teacher: TeacherAccountDto,
  student: { schoolId: string; programId: string; classLevel: number; sectionId: string | null },
) {
  if (student.schoolId !== teacher.schoolId) return false;
  const assigned = teacher.assignments.some(
    (row) => row.programId === student.programId && row.classLevel === student.classLevel,
  );
  if (assigned) return true;
  return (teacher.classTeacherSections ?? []).some((slot) =>
    slot.kind === "section"
      ? slot.sectionId === student.sectionId
      : slot.programId === student.programId && slot.classLevel === student.classLevel && !student.sectionId,
  );
}

async function teacherStudent(id: string, teacher: TeacherAccountDto) {
  const student = await studentRepository.findStudentById(id);
  if (!student || !teacherCanSee(teacher, student)) throw new AppError(404, "Student not found");
  return student;
}

/** A student profile, limited to the teacher's classes. */
export async function getTeacherStudent(id: string, teacher: TeacherAccountDto) {
  return toStudentAccountDto(await teacherStudent(id, teacher));
}

/** Admin sees every saved test; schools and teachers only published ones. */
export async function getStudentPerformance(
  id: string,
  scope: { kind: "admin" } | { kind: "school"; schoolId: string } | { kind: "teacher"; teacher: TeacherAccountDto },
) {
  const student =
    scope.kind === "teacher"
      ? await teacherStudent(id, scope.teacher)
      : await studentRepository.findStudentById(id);
  if (!student || (scope.kind === "school" && student.schoolId !== scope.schoolId)) {
    throw new AppError(404, "Student not found");
  }
  return studentTestResults(student, { publishedOnly: scope.kind !== "admin" });
}
