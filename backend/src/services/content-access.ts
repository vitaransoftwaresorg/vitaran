import type { Prisma } from "../generated/prisma/client.js";
import { SchoolType } from "../generated/prisma/enums.js";
import * as schoolClassRepository from "../repositories/school-class.repository.js";
import * as sectionRepository from "../repositories/section.repository.js";
import type { SchoolAccountDto } from "./school.service.js";
import type { TeacherAccountDto } from "./teacher.service.js";

/** Signed-in school or teacher — one place for content RBAC. */
export type ContentActor =
  | { kind: "school"; school: SchoolAccountDto }
  | { kind: "teacher"; teacher: TeacherAccountDto };

export type ProgramClassSlot = {
  programCode: string;
  classLevel: number;
};

export function contentSchool(
  actor: ContentActor,
): Pick<SchoolAccountDto, "id" | "type" | "programCodes" | "schoolPrograms"> {
  return actor.kind === "school" ? actor.school : actor.teacher.school;
}

function ownershipFilter(
  school: Pick<SchoolAccountDto, "id" | "type">,
): Prisma.AnswerKeyWhereInput {
  return school.type === SchoolType.CUSTOMIZED
    ? { schoolId: school.id }
    : { type: SchoolType.REGULAR };
}

/** One OR branch per enrolled/assigned program+class — avoids cross-program class leaks. */
function programClassSlots(
  slots: Array<{ programCode: string; classLevel: number }>,
): Prisma.AnswerKeyWhereInput[] {
  const seen = new Set<string>();
  const branches: Prisma.AnswerKeyWhereInput[] = [];
  for (const slot of slots) {
    const key = `${slot.programCode}:${slot.classLevel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    branches.push({ programCode: slot.programCode, classLevel: slot.classLevel });
  }
  return branches;
}

function customProgramCodes(
  school: Pick<SchoolAccountDto, "schoolPrograms">,
) {
  return school.schoolPrograms
    .filter((row) => row.type === SchoolType.CUSTOMIZED)
    .map((row) => row.programCode);
}

/** Keys live on the customized program code even if the teacher is assigned to a regular offering. */
function withCustomProgramSlots(
  school: Pick<SchoolAccountDto, "schoolPrograms">,
  slots: Array<{ programCode: string; classLevel: number }>,
) {
  const custom = customProgramCodes(school);
  if (custom.length === 0) return slots;
  return [
    ...slots,
    ...slots.flatMap((slot) =>
      custom.map((programCode) => ({ programCode, classLevel: slot.classLevel })),
    ),
  ];
}

function slotKey(slot: ProgramClassSlot) {
  return `${slot.programCode}:${slot.classLevel}`;
}

/** Programs & classes — enrolled program × class levels. */
export function schoolOfferingSlots(
  school: Pick<SchoolAccountDto, "schoolPrograms">,
): ProgramClassSlot[] {
  return school.schoolPrograms.flatMap((program) =>
    program.classes.map((cls) => ({
      programCode: program.programCode,
      classLevel: cls.classLevel,
    })),
  );
}

/** Classes & sections — admin-created whole classes and sections. */
export async function loadOrganizationSlots(schoolId: string): Promise<ProgramClassSlot[]> {
  const [wholeClasses, sections] = await Promise.all([
    schoolClassRepository.listSchoolClassesBySchool(schoolId),
    sectionRepository.listSectionsBySchool(schoolId),
  ]);
  return [
    ...wholeClasses.map((row) => ({
      programCode: row.program.code,
      classLevel: row.classLevel,
    })),
    ...sections.map((row) => ({
      programCode: row.program.code,
      classLevel: row.classLevel,
    })),
  ];
}

function intersectSlots(
  left: ProgramClassSlot[],
  right: ProgramClassSlot[],
): ProgramClassSlot[] {
  const allowed = new Set(right.map(slotKey));
  return left.filter((slot) => allowed.has(slotKey(slot)));
}

/**
 * Content the actor may see:
 * school  → Programs & classes ∩ Classes & sections
 * teacher → that set ∩ assignments / class-teacher slots
 */
export async function resolveContentSlots(actor: ContentActor): Promise<ProgramClassSlot[]> {
  const school = contentSchool(actor);
  const offerings = schoolOfferingSlots(school);
  const organization = await loadOrganizationSlots(school.id);
  let slots = intersectSlots(offerings, organization);

  if (actor.kind === "teacher") {
    const teacherSlots = teacherProgramSlots(actor.teacher).map((row) => ({
      programCode: row.programCode,
      classLevel: row.classLevel,
    }));
    slots = intersectSlots(slots, teacherSlots);
  }

  return slots;
}

export async function buildAnswerKeyAccessFilter(
  actor: ContentActor,
): Promise<Prisma.AnswerKeyWhereInput> {
  const school = contentSchool(actor);
  const ownership = ownershipFilter(school);
  const slots = programClassSlots(
    withCustomProgramSlots(school, await resolveContentSlots(actor)),
  );
  if (slots.length === 0) return { id: { in: [] } };
  // Include unpublished — portals show them as "Not Published".
  return { ...ownership, OR: slots };
}

/** @deprecated Prefer buildAnswerKeyAccessFilter (async, org-aware). */
export function answerKeyAccessFilter(actor: ContentActor): Prisma.AnswerKeyWhereInput {
  const school = contentSchool(actor);
  const ownership = ownershipFilter(school);

  if (actor.kind === "teacher") {
    const slots = programClassSlots(
      withCustomProgramSlots(school, [
        ...actor.teacher.assignments.map((row) => ({
          programCode: row.programCode,
          classLevel: row.classLevel,
        })),
        ...actor.teacher.classTeacherSections.map((row) => ({
          programCode: row.programCode,
          classLevel: row.classLevel,
        })),
      ]),
    );
    if (slots.length === 0) return { id: { in: [] } };
    return { ...ownership, OR: slots };
  }

  const slots = programClassSlots(
    withCustomProgramSlots(
      school,
      school.schoolPrograms.flatMap((program) =>
        program.classes.map((cls) => ({
          programCode: program.programCode,
          classLevel: cls.classLevel,
        })),
      ),
    ),
  );
  if (slots.length === 0) return { id: { in: [] } };
  return { ...ownership, OR: slots };
}

export type StudentScope = {
  programCode: string;
  programId?: string;
  classLevel: number;
  sectionId: string | null;
};

function fold(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function teacherProgramSlots(teacher: TeacherAccountDto) {
  return [
    ...teacher.assignments.map((row) => ({
      programCode: row.programCode,
      programName: row.programName,
      classLevel: row.classLevel,
    })),
    ...teacher.classTeacherSections.map((row) => ({
      programCode: row.programCode,
      programName: row.programName,
      classLevel: row.classLevel,
    })),
  ];
}

export function isClassTeacherOf(teacher: TeacherAccountDto, student: StudentScope) {
  return teacher.classTeacherSections.some((slot) => {
    if (slot.programCode !== student.programCode || slot.classLevel !== student.classLevel) {
      return false;
    }
    if (slot.kind === "section") return Boolean(slot.sectionId) && slot.sectionId === student.sectionId;
    return student.sectionId == null;
  });
}

export function assignedSubjects(
  teacher: TeacherAccountDto,
  student: Pick<StudentScope, "programCode" | "classLevel">,
): string[] {
  return [
    ...new Set(
      teacher.assignments
        .filter(
          (row) =>
            row.programCode === student.programCode && row.classLevel === student.classLevel,
        )
        .map((row) => row.subject),
    ),
  ];
}

export function teacherCanAccessStudent(teacher: TeacherAccountDto, student: StudentScope) {
  return isClassTeacherOf(teacher, student) || assignedSubjects(teacher, student).length > 0;
}

export function resultSetAccessFilter(actor: ContentActor): Prisma.ResultSetWhereInput {
  // Include unpublished sets — portals show them as "Not Published".
  return { schoolId: contentSchool(actor).id };
}

export function resultSetMatchesProgram(
  set: { programCode: string | null; programName: string | null },
  programs: Array<{ programCode: string; programName?: string }>,
) {
  return programs.some((slot) => {
    if (set.programCode && set.programCode === slot.programCode) return true;
    return Boolean(
      set.programName && slot.programName && fold(set.programName) === fold(slot.programName),
    );
  });
}

export function resultSetVisibleToTeacher(
  teacher: TeacherAccountDto,
  set: { programCode: string | null; programName: string | null },
) {
  return resultSetMatchesProgram(set, teacherProgramSlots(teacher));
}

export function resultSetVisibleToSchool(
  set: { programCode: string | null; programName: string | null },
  slots: ProgramClassSlot[],
  school: Pick<SchoolAccountDto, "schoolPrograms">,
) {
  if (slots.length === 0) return false;
  const programs = school.schoolPrograms
    .filter((program) => slots.some((slot) => slot.programCode === program.programCode))
    .map((program) => ({ programCode: program.programCode, programName: program.programName }));
  return resultSetMatchesProgram(set, programs);
}

/** Teachers only see sheets for their assigned classes; schools see offering∩org classes. */
export function resultSheetClassFilter(
  actor: ContentActor,
  contentSlots?: ProgramClassSlot[],
): number[] | null {
  if (actor.kind === "teacher") return teacherClassLevels(actor.teacher);
  if (!contentSlots) return null;
  return [...new Set(contentSlots.map((slot) => slot.classLevel))];
}

export function teacherSubjects(teacher: TeacherAccountDto): string[] {
  return [...new Set(teacher.assignments.map((a) => a.subject))];
}

export function teacherClassLevels(teacher: TeacherAccountDto): number[] {
  return [...new Set(teacherProgramSlots(teacher).map((row) => row.classLevel))];
}
