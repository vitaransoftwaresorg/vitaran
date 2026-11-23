import { StudentStatus } from "../generated/prisma/enums.js";
import { classWithSectionLabel, displaySectionName } from "../utils/section-label.js";
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
import { downloadFileName } from "../utils/download-file-name.js";
import type { ContentActor } from "./content-access.js";
import { getObject } from "./object-storage.js";
import { getRankCards } from "./rank-card.service.js";
import {
  loadVitaranLogo,
  rankCardsPdf,
  renderSubjectReportCard,
  renderYearReportCard,
} from "./rank-card.render.js";
import { mergePdfBuffers } from "./report-card.pdf.js";
import type { ReportCardKind } from "../schemas/student.schema.js";
import { schoolTestResultsIndex, studentTestResults } from "./student-performance.service.js";
import {
  renderStudentProfilePdf,
  renderStudentProfilesPdf,
  type StudentProfilePdfData,
} from "./student-profile.pdf.js";
import { removeRollsFromSchoolData } from "./roster-lifecycle.js";
import type { SchoolAccountDto } from "./school.service.js";
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

/** Only school seat limit applies — section/class seat counts are not enforced. */
async function assertSchoolStrengthAllows(
  schoolId: string,
  seatsNeeded = 1,
  excludeStudentId?: string,
) {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");
  const ceiling = school.studentStrength;
  if (ceiling == null) return;

  const enrolled = await studentRepository.countStudents({
    schoolId,
    status: StudentStatus.ACTIVE,
    ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}),
  });
  if (enrolled + seatsNeeded > ceiling) {
    throw new AppError(
      400,
      `School seat limit exceeded. ${enrolled} of ${ceiling} seats used; only ${Math.max(0, ceiling - enrolled)} left.`,
      [{ path: ["schoolId"], message: "Not enough seats under the school seat limit" }],
    );
  }
}

/** Validate section/class placement (no per-section seat cap). */
async function assertPlacementValid(
  schoolId: string,
  programId: string,
  classLevel: number,
  sectionId: string | null,
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
}

async function assertSeatAvailable(
  schoolId: string,
  programId: string,
  classLevel: number,
  sectionId: string | null,
  excludeStudentId?: string,
  seatsNeeded = 1,
) {
  await assertPlacementValid(schoolId, programId, classLevel, sectionId);
  await assertSchoolStrengthAllows(schoolId, seatsNeeded, excludeStudentId);
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
    parentName: input.parentName?.trim() || null,
    parentPhone: input.parentPhone ?? null,
    programId: input.programId,
    classLevel: input.classLevel,
    sectionId,
    status: input.status ?? StudentStatus.ACTIVE,
  });

  notifyContentChanged({ kind: KIND, schoolId });
  return toStudentDetailDto(student);
}

export async function createStudentsBulk(schoolId: string, input: CreateStudentsBulkInput) {
  const defaultSectionId = input.sectionId ?? null;
  const rows = input.students.map((row) => ({
    ...row,
    sectionId: row.sectionId !== undefined ? row.sectionId : defaultSectionId,
  }));

  await assertSchoolOffering(schoolId, input.programId, input.classLevel);

  const sectionIds = new Set(rows.map((row) => row.sectionId ?? null));
  for (const sectionId of sectionIds) {
    await assertPlacementValid(schoolId, input.programId, input.classLevel, sectionId);
  }
  await assertSchoolStrengthAllows(schoolId, rows.length);

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
      parentName: row.parentName?.trim() || null,
      parentPhone: row.parentPhone ?? null,
      programId: input.programId,
      classLevel: input.classLevel,
      sectionId: row.sectionId ?? null,
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
    ...(input.parentName !== undefined
      ? { parentName: input.parentName?.trim() || null }
      : {}),
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
  // Roster is parent — removing a student clears Results / OMR / ranks for that roll.
  await removeRollsFromSchoolData(existing.schoolId, [existing.rollNo]);
  await studentRepository.deleteStudent(id);
  notifyContentChanged({ kind: KIND, schoolId: existing.schoolId });
  return { ok: true as const };
}

/**
 * Delete every student in a section — keeps the class and section setup.
 * Also clears Results / OMR / ranks for those rolls.
 */
export async function deleteStudentsInSection(schoolId: string, sectionId: string) {
  const section = await sectionRepository.findSectionById(sectionId);
  if (!section || section.schoolId !== schoolId) {
    throw new AppError(404, "Section not found");
  }
  const rolls = (await studentRepository.listRollsBySectionId(sectionId)).map((row) => row.rollNo);
  if (rolls.length > 0) await removeRollsFromSchoolData(schoolId, rolls);
  const result = await studentRepository.deleteStudentsBySectionId(sectionId);
  notifyContentChanged({ kind: KIND, schoolId });
  return { ok: true as const, deleted: result.count };
}

/**
 * Delete every student in a class level — keeps class/section setup.
 */
export async function deleteStudentsInClass(schoolId: string, classLevel: number) {
  if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 12) {
    throw new AppError(400, "Invalid class");
  }
  const rolls = (await studentRepository.listRollsByClassLevel(schoolId, classLevel)).map(
    (row) => row.rollNo,
  );
  if (rolls.length > 0) await removeRollsFromSchoolData(schoolId, rolls);
  const result = await studentRepository.deleteStudentsByClassLevel(schoolId, classLevel);
  notifyContentChanged({ kind: KIND, schoolId });
  return { ok: true as const, deleted: result.count };
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

type PerformanceScope =
  | { kind: "admin" }
  | { kind: "school"; schoolId: string }
  | { kind: "teacher"; teacher: TeacherAccountDto };

async function scopedStudent(id: string, scope: PerformanceScope) {
  const student =
    scope.kind === "teacher"
      ? await teacherStudent(id, scope.teacher)
      : await studentRepository.findStudentById(id);
  if (!student || (scope.kind === "school" && student.schoolId !== scope.schoolId)) {
    throw new AppError(404, "Student not found");
  }
  return student;
}

/** Admin sees every saved test; schools and teachers only published ones. */
export async function getStudentPerformance(id: string, scope: PerformanceScope) {
  const student = await scopedStudent(id, scope);
  return studentTestResults(student, { publishedOnly: scope.kind !== "admin" });
}

async function studentReportLogos(schoolId: string) {
  const [logo, vitaran] = await Promise.all([
    schoolRepository.findSchoolLogo(schoolId),
    loadVitaranLogo(),
  ]);
  return {
    vitaran,
    school: logo?.logoData ? await getObject(logo.logoData) : null,
  };
}

/** Test-wise report cards — every saved test, or one test number when `testNumber` is set. */
export async function getStudentRankCardsPdf(
  id: string,
  scope: PerformanceScope,
  viewer?: ContentActor | SchoolAccountDto,
  testNumber?: number,
) {
  const student = toStudentAccountDto(await scopedStudent(id, scope));
  const results = await studentTestResults(student, { publishedOnly: scope.kind !== "admin" });
  const wanted = testNumber != null ? results.filter((row) => row.testNumber === testNumber) : results;
  if (wanted.length === 0) {
    throw new AppError(
      404,
      testNumber != null
        ? `No tests report records for Test ${testNumber} yet`
        : "No tests report records yet",
    );
  }

  const images: Buffer[] = [];
  for (const result of [...wanted].reverse()) {
    try {
      const card = await getRankCards(
        { id: result.resultSetId, classLevel: result.classLevel },
        { roll: student.rollNo, format: "jpg" },
        viewer,
      );
      images.push(Buffer.from(card.data));
    } catch {
      // Skip tests with no saved sheet / marks for this student.
    }
  }
  if (images.length === 0) {
    throw new AppError(
      404,
      testNumber != null
        ? `No tests report records for Test ${testNumber} yet`
        : "No tests report records yet",
    );
  }

  const fileName = downloadFileName(
    [
      testNumber != null ? `Test-${testNumber}-Report` : "Test-Report-Cards",
      student.school.name,
      student.programName,
      `Class-${student.classLevel}`,
      student.name,
      student.rollNo,
    ],
    "pdf",
  );
  return {
    fileName,
    data: await rankCardsPdf(images, fileName.replace(/\.pdf$/i, "")),
  };
}

/** One student's year / test-wise / subject report card PDF (rank-card visual style). */
export async function getStudentReportCardPdf(
  id: string,
  kind: ReportCardKind,
  scope: PerformanceScope,
  viewer?: ContentActor | SchoolAccountDto,
  subject?: string,
  testNumber?: number,
) {
  if (kind === "tests") return getStudentRankCardsPdf(id, scope, viewer, testNumber);

  const student = toStudentAccountDto(await scopedStudent(id, scope));
  const results = await studentTestResults(student, { publishedOnly: scope.kind !== "admin" });
  if (results.length === 0) {
    throw new AppError(
      404,
      kind === "year" ? "No year report records yet" : "No subjects report records yet",
    );
  }

  const logos = await studentReportLogos(student.schoolId);
  const classLabel = classWithSectionLabel(student.classLevel, student.sectionName);
  const tests = [...results].sort((a, b) => a.testNumber - b.testNumber || a.date.localeCompare(b.date));
  const wanted = subject?.trim().toUpperCase() || null;

  let card: Buffer;
  if (kind === "year") {
    card = await renderYearReportCard(
      {
        schoolName: student.school.name,
        programName: student.programName,
        student: { name: student.name, rollNo: student.rollNo, classLabel },
        tests: tests.map((test) => ({
          testNumber: test.testNumber,
          testId: test.testId,
          subjects: test.subjects,
          total: test.total,
          totalMax: test.totalMax,
          percentage: test.percentage,
          classRank: test.classRank,
          sectionRank: test.sectionRank,
        })),
      },
      logos,
    );
  } else {
    const labels = [
      ...new Set(tests.flatMap((test) => test.subjects.map((row) => row.label))),
    ].filter((label) => !wanted || label.toUpperCase() === wanted);
    if (!labels.length) {
      throw new AppError(
        404,
        wanted ? `No subjects report records for ${wanted} yet` : "No subjects report records yet",
      );
    }
    const subjectRows = labels.map((label) => {
      const scores = tests.map((test) => {
        const row = test.subjects.find((entry) => entry.label === label);
        return {
          marks: row?.marks ?? null,
          max: row?.max ?? null,
          percentage: row?.percentage ?? null,
        };
      });
      const filled = scores.map((score) => score.percentage).filter((value): value is number => value != null);
      return {
        label,
        scores,
        average: filled.length ? filled.reduce((sum, value) => sum + value, 0) / filled.length : null,
      };
    });
    const overallFilled = wanted
      ? subjectRows[0]!.scores.map((score) => score.percentage).filter((value): value is number => value != null)
      : tests.map((test) => test.percentage).filter((value): value is number => value != null);
    card = await renderSubjectReportCard(
      {
        schoolName: student.school.name,
        programName: student.programName,
        student: { name: student.name, rollNo: student.rollNo, classLabel },
        tests: tests.map((test) => ({ testNumber: test.testNumber })),
        subjects: subjectRows,
        overallAverage: overallFilled.length
          ? overallFilled.reduce((sum, value) => sum + value, 0) / overallFilled.length
          : null,
        focusSubject: wanted ?? undefined,
      },
      logos,
    );
  }

  const prefix = kind === "year" ? "Year-Report" : wanted ? `Subject-${wanted}` : "Subject-Report-All";
  const fileName = downloadFileName(
    [
      prefix,
      student.school.name,
      student.programName,
      `Class-${student.classLevel}`,
      student.name,
      student.rollNo,
    ],
    "pdf",
  );
  return {
    fileName,
    data: await rankCardsPdf([card], fileName.replace(/\.pdf$/i, "")),
  };
}

/**
 * Class pack: one PDF with every student's card on its own page(s).
 * Year / tests (rank cards) / subjects (all or one subject).
 */
export async function getStudentsReportCardsPdf(
  ids: string[],
  kind: ReportCardKind,
  scope: PerformanceScope,
  viewer?: ContentActor | SchoolAccountDto,
  subject?: string,
  testNumber?: number,
) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new AppError(404, "No students to print");

  const parts: Buffer[] = [];
  let schoolName: string | undefined;
  let scopeLabel = "Students";
  const classes = new Set<string>();

  for (const id of unique) {
    try {
      const file = await getStudentReportCardPdf(id, kind, scope, viewer, subject, testNumber);
      parts.push(Buffer.from(file.data));
      const student = toStudentAccountDto(await scopedStudent(id, scope));
      schoolName ??= student.school.name;
      classes.add(classWithSectionLabel(student.classLevel, student.sectionName));
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) continue;
      throw error;
    }
  }
  if (parts.length === 0) {
    const wantedSubject = subject?.trim().toUpperCase() || null;
    throw new AppError(
      404,
      kind === "year"
        ? "No year report records yet"
        : kind === "subjects"
          ? wantedSubject
            ? `No subjects report records for ${wantedSubject} yet`
            : "No subjects report records yet"
          : testNumber != null
            ? `No tests report records for Test ${testNumber} yet`
            : "No tests report records yet",
    );
  }
  if (classes.size === 1) scopeLabel = [...classes][0]!;

  const wanted = subject?.trim().toUpperCase() || null;
  const prefix =
    kind === "year"
      ? "Year-Reports"
      : kind === "subjects"
        ? wanted
          ? `Subject-${wanted}`
          : "Subject-Reports-All"
        : testNumber != null
          ? `Test-${testNumber}-Reports`
          : "Test-Report-Cards";
  const fileName = downloadFileName([prefix, schoolName, scopeLabel], "pdf");
  return {
    fileName,
    data: await mergePdfBuffers(parts, fileName.replace(/\.pdf$/i, "")),
  };
}

/** Printable profile: details, performance trend and every test. */
export async function getStudentProfilePdf(id: string, scope: PerformanceScope) {
  const student = toStudentAccountDto(await scopedStudent(id, scope));
  const [results, logo, vitaran] = await Promise.all([
    studentTestResults(student, { publishedOnly: scope.kind !== "admin" }),
    schoolRepository.findSchoolLogo(student.schoolId),
    loadVitaranLogo(),
  ]);
  const data = await renderStudentProfilePdf(profilePdfData(student, results), {
    vitaran,
    school: logo?.logoData ? await getObject(logo.logoData) : null,
  });
  return {
    fileName: downloadFileName(
      [
        "Student-Profile",
        student.school.name,
        student.programName,
        `Class-${student.classLevel}`,
        student.name,
        student.rollNo,
      ],
      "pdf",
    ),
    data,
  };
}

function profilePdfData(
  student: StudentAccountDto,
  results: StudentProfilePdfData["results"],
): StudentProfilePdfData {
  return {
    student: {
      name: student.name,
      rollNo: student.rollNo,
      status: student.status,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      email: student.email,
      programName: student.programName,
      classLevel: student.classLevel,
      sectionName: student.sectionName,
      schoolName: student.school.name,
    },
    results,
  };
}

/** One PDF with every listed student's profile (a class or section), in the given order. */
export async function getStudentProfilesPdf(ids: string[], scope: PerformanceScope) {
  const students: StudentAccountDto[] = [];
  for (const id of [...new Set(ids)]) students.push(toStudentAccountDto(await scopedStudent(id, scope)));
  if (students.length === 0) throw new AppError(404, "No students to print");

  const schoolIds = [...new Set(students.map((student) => student.schoolId))];
  const publishedOnly = scope.kind !== "admin";
  const [indexes, logos, vitaran] = await Promise.all([
    Promise.all(schoolIds.map((schoolId) => schoolTestResultsIndex(schoolId, { publishedOnly }))),
    Promise.all(schoolIds.map((schoolId) => schoolRepository.findSchoolLogo(schoolId))),
    loadVitaranLogo(),
  ]);
  const indexBySchool = new Map(schoolIds.map((schoolId, i) => [schoolId, indexes[i]!]));

  const classes = [...new Set(students.map((student) => classWithSectionLabel(student.classLevel, student.sectionName)))];
  const scopeLabel = classes.length === 1 ? classes[0]! : "Students";
  const data = await renderStudentProfilesPdf(
    students.map((student) => ({
      schoolId: student.schoolId,
      data: profilePdfData(student, indexBySchool.get(student.schoolId)!(student.rollNo)),
    })),
    {
      vitaran,
      schools: new Map(
        await Promise.all(
          schoolIds.map(async (schoolId, i) => {
            const logo = logos[i]?.logoData;
            return [schoolId, logo ? await getObject(logo) : null] as const;
          }),
        ),
      ),
    },
    downloadFileName(["Student-Profiles", students[0]?.school.name, scopeLabel], "pdf").replace(/\.pdf$/i, ""),
  );
  const schoolName = students[0]?.school.name;
  return {
    fileName: downloadFileName(["Student-Profiles", schoolName, scopeLabel], "pdf"),
    data,
  };
}
