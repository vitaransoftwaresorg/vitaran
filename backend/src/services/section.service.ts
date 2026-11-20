import * as schoolClassRepository from "../repositories/school-class.repository.js";
import * as schoolRepository from "../repositories/school.repository.js";
import * as sectionRepository from "../repositories/section.repository.js";
import * as studentRepository from "../repositories/student.repository.js";
import * as teacherRepository from "../repositories/teacher.repository.js";
import type {
  CreateSectionInput,
  UpdateSchoolClassInput,
  UpdateSectionInput,
} from "../schemas/section.schema.js";
import { AppError } from "../utils/app-error.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { TeacherStatus } from "../generated/prisma/enums.js";
import { DEFAULT_SECTION_NAME } from "../utils/section-label.js";
import * as resultService from "./result.service.js";
import * as scanRepository from "../scan/repository.js";

const KIND = "sections" as const;

async function releaseClassLevelTeacher(
  schoolId: string,
  programId: string,
  classLevel: number,
) {
  await teacherRepository.clearClassLevelTeacher(schoolId, programId, classLevel);
}

export type SectionDto = {
  id: string;
  schoolId: string;
  classLevel: number;
  name: string;
  programId: string;
  programCode: string;
  programName: string;
  year: number;
  studentCount: number;
  classTeacher: {
    id: string;
    teacherId: string;
    name: string;
    email: string;
    status: TeacherStatus;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type WholeClassDto = {
  id: string;
  schoolId: string;
  classLevel: number;
  programId: string;
  programCode: string;
  programName: string;
  year: number;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ClassOrganizationDto = {
  wholeClasses: WholeClassDto[];
  sections: SectionDto[];
};

export type SectionStrengthDto = {
  studentStrength: number | null;
  used: number;
  remaining: number | null;
};

function toSectionDto(
  row: Awaited<ReturnType<typeof sectionRepository.findSectionById>>,
): SectionDto {
  if (!row) throw new AppError(404, "Section not found");
  return {
    id: row.id,
    schoolId: row.schoolId,
    classLevel: row.classLevel,
    name: row.name,
    programId: row.programId,
    programCode: row.program.code,
    programName: row.program.name,
    year: row.program.year,
    studentCount: row.studentCount,
    classTeacher: row.classTeacher
      ? {
          id: row.classTeacher.id,
          teacherId: row.classTeacher.id,
          name: row.classTeacher.name,
          email: row.classTeacher.email,
          status: row.classTeacher.status,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toWholeClassDto(
  row: NonNullable<Awaited<ReturnType<typeof schoolClassRepository.findSchoolClassById>>>,
): WholeClassDto {
  return {
    id: row.id,
    schoolId: row.schoolId,
    classLevel: row.classLevel,
    programId: row.programId,
    programCode: row.program.code,
    programName: row.program.name,
    year: row.program.year,
    studentCount: row.studentCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertProgramOfferedForClass(
  schoolId: string,
  programId: string,
  classLevel: number,
) {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");

  const offering = school.schoolPrograms.find((row) => row.programId === programId);
  if (!offering?.classes.some((cls) => cls.classLevel === classLevel)) {
    throw new AppError(400, "This program is not enabled for the selected class");
  }

  return school;
}

async function usedSeats(
  schoolId: string,
  opts?: { excludeSectionId?: string; excludeClassId?: string },
) {
  const [sectionSum, sectionRows, wholeRows] = await Promise.all([
    sectionRepository.sumStudentCount(schoolId, opts?.excludeSectionId),
    sectionRepository.listSectionsBySchool(schoolId),
    schoolClassRepository.listSchoolClassesBySchool(schoolId),
  ]);
  // Sections replace whole-class rows for that class level — never count both.
  const levelsWithSections = new Set(sectionRows.map((row) => row.classLevel));
  let wholeSum = 0;
  for (const row of wholeRows) {
    if (opts?.excludeClassId && row.id === opts.excludeClassId) continue;
    if (levelsWithSections.has(row.classLevel)) continue;
    wholeSum += row.studentCount;
  }
  return (sectionSum._sum.studentCount ?? 0) + wholeSum;
}

async function assertStrengthAllows(
  schoolId: string,
  nextCount: number,
  opts?: { excludeSectionId?: string; excludeClassId?: string },
) {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");

  const ceiling = school.studentStrength;
  if (ceiling == null) return school;

  const used = await usedSeats(schoolId, opts);
  if (used + nextCount > ceiling) {
    throw new AppError(
      400,
      `Student strength exceeded. ${used} of ${ceiling} seats used; only ${Math.max(0, ceiling - used)} left.`,
    );
  }

  return school;
}

async function assertClassTeacher(
  schoolId: string,
  classTeacherId: string | null | undefined,
  programId: string,
  classLevel: number,
) {
  if (!classTeacherId) return null;

  const teacher = await teacherRepository.findTeacherById(classTeacherId);
  if (!teacher || teacher.schoolId !== schoolId) {
    throw new AppError(400, "Class teacher must belong to this school");
  }
  if (teacher.status !== TeacherStatus.ACTIVE) {
    throw new AppError(400, "Class teacher must be an active teacher");
  }

  const teachesClass = teacher.assignments.some(
    (row) => row.programId === programId && row.classLevel === classLevel,
  );
  if (!teachesClass) {
    throw new AppError(400, "Class teacher must be assigned at least one subject in that class");
  }

  return classTeacherId;
}

export async function getStrengthBudget(schoolId: string): Promise<SectionStrengthDto> {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");

  const used = await usedSeats(schoolId);
  const ceiling = school.studentStrength;

  return {
    studentStrength: ceiling,
    used,
    remaining: ceiling == null ? null : Math.max(0, ceiling - used),
  };
}

/** Sections only (teacher form / CT occupancy). */
export async function listSections(schoolId: string) {
  const rows = await sectionRepository.listSectionsBySchool(schoolId);
  return rows.map((row) => toSectionDto(row));
}

/** Whole classes + sections for the Classes board. */
export async function listClassOrganization(schoolId: string): Promise<ClassOrganizationDto> {
  const [wholeRows, sectionRows] = await Promise.all([
    schoolClassRepository.listSchoolClassesBySchool(schoolId),
    sectionRepository.listSectionsBySchool(schoolId),
  ]);
  const levelsWithSections = new Set(sectionRows.map((row) => row.classLevel));
  // Drop superseded whole-class rows so their seat count cannot override sections.
  const orphans = wholeRows.filter((row) => levelsWithSections.has(row.classLevel));
  if (orphans.length > 0) {
    await Promise.all(orphans.map((row) => schoolClassRepository.deleteSchoolClass(row.id)));
  }
  return {
    wholeClasses: wholeRows
      .filter((row) => !levelsWithSections.has(row.classLevel))
      .map(toWholeClassDto),
    sections: sectionRows.map((row) => toSectionDto(row)),
  };
}

export async function createSection(schoolId: string, input: CreateSectionInput) {
  await assertProgramOfferedForClass(schoolId, input.programId, input.classLevel);

  // Blank name → Section A (classes without other sections default to A).
  const sectionName = input.name?.trim() || DEFAULT_SECTION_NAME;

  const existingWhole = await schoolClassRepository.findSchoolClassByLevel(
    schoolId,
    input.classLevel,
  );

  // Free the whole-class seats when this create replaces that row.
  await assertStrengthAllows(schoolId, input.studentCount, {
    excludeClassId: existingWhole?.id,
  });

  const conflict = await sectionRepository.findSectionNameConflict(
    schoolId,
    input.classLevel,
    sectionName,
  );
  if (conflict) {
    throw new AppError(409, `Section ${sectionName} already exists for class ${input.classLevel}`);
  }

  const existingClassTeachers = await teacherRepository.listClassLevelTeachers(schoolId);
  const priorClassTeacher = existingClassTeachers.find(
    (row) => row.programId === input.programId && row.classLevel === input.classLevel,
  );

  const classTeacherId = await assertClassTeacher(
    schoolId,
    input.classTeacherId ?? priorClassTeacher?.teacherId ?? null,
    input.programId,
    input.classLevel,
  );

  // If a whole-class seat budget exists, turn it into Section A with its own count
  // before adding another section — so Integrated class seats do not replace section seats.
  if (existingWhole) {
    const sectionsAtLevel = (await sectionRepository.listSectionsBySchool(schoolId)).filter(
      (row) => row.classLevel === input.classLevel,
    );
    const creatingDefault =
      sectionName.toUpperCase() === DEFAULT_SECTION_NAME.toUpperCase();

    if (sectionsAtLevel.length === 0 && !creatingDefault) {
      await schoolClassRepository.deleteSchoolClass(existingWhole.id);
      await releaseClassLevelTeacher(
        schoolId,
        existingWhole.programId,
        existingWhole.classLevel,
      );
      const sectionA = await sectionRepository.createSection({
        schoolId,
        classLevel: existingWhole.classLevel,
        name: DEFAULT_SECTION_NAME,
        programId: existingWhole.programId,
        studentCount: existingWhole.studentCount,
        classTeacherId: null,
      });
      await studentRepository.assignWholeClassStudentsToSection(
        schoolId,
        existingWhole.programId,
        existingWhole.classLevel,
        sectionA.id,
      );
    } else {
      await schoolClassRepository.deleteSchoolClass(existingWhole.id);
      await releaseClassLevelTeacher(
        schoolId,
        existingWhole.programId,
        existingWhole.classLevel,
      );
    }
  } else {
    await releaseClassLevelTeacher(schoolId, input.programId, input.classLevel);
  }

  const row = await sectionRepository.createSection({
    schoolId,
    classLevel: input.classLevel,
    name: sectionName,
    programId: input.programId,
    studentCount: input.studentCount,
    classTeacherId,
  });

  await studentRepository.assignWholeClassStudentsToSection(
    schoolId,
    input.programId,
    input.classLevel,
    row.id,
  );

  if (input.applyTeacherToClass && classTeacherId) {
    await sectionRepository.applyTeacherToClassLevel(schoolId, input.classLevel, classTeacherId);
    const refreshed = await sectionRepository.findSectionById(row.id);
    notifyContentChanged({ kind: KIND, schoolId });
    return { kind: "section" as const, section: toSectionDto(refreshed) };
  }

  notifyContentChanged({ kind: KIND, schoolId });
  return { kind: "section" as const, section: toSectionDto(row) };
}

export async function updateSection(schoolId: string, id: string, input: UpdateSectionInput) {
  const existing = await sectionRepository.findSectionById(id);
  if (!existing || existing.schoolId !== schoolId) {
    throw new AppError(404, "Section not found");
  }

  const nextClassLevel = existing.classLevel;
  const nextName = input.name ?? existing.name;
  const nextProgramId = input.programId ?? existing.programId;

  if (input.programId) {
    await assertProgramOfferedForClass(schoolId, nextProgramId, nextClassLevel);
  }

  if (input.studentCount !== undefined) {
    await assertStrengthAllows(schoolId, input.studentCount, { excludeSectionId: id });
  }

  if (input.name && input.name !== existing.name) {
    const conflict = await sectionRepository.findSectionNameConflict(
      schoolId,
      nextClassLevel,
      nextName,
      id,
    );
    if (conflict) {
      throw new AppError(409, `Section ${nextName} already exists for class ${nextClassLevel}`);
    }
  }

  let classTeacherId = input.classTeacherId;
  if (classTeacherId !== undefined) {
    classTeacherId = await assertClassTeacher(
      schoolId,
      classTeacherId,
      nextProgramId,
      nextClassLevel,
    );
  }

  const row = await sectionRepository.updateSection(id, {
    name: input.name,
    programId: input.programId,
    studentCount: input.studentCount,
    ...(classTeacherId !== undefined ? { classTeacherId } : {}),
  });

  if (input.applyTeacherToClass && classTeacherId) {
    await sectionRepository.applyTeacherToClassLevel(schoolId, nextClassLevel, classTeacherId);
    const refreshed = await sectionRepository.findSectionById(id);
    notifyContentChanged({ kind: KIND, schoolId });
    return toSectionDto(refreshed);
  }

  notifyContentChanged({ kind: KIND, schoolId });
  return toSectionDto(row);
}

export async function updateSchoolClass(
  schoolId: string,
  id: string,
  input: UpdateSchoolClassInput,
) {
  const existing = await schoolClassRepository.findSchoolClassById(id);
  if (!existing || existing.schoolId !== schoolId) {
    throw new AppError(404, "Class not found");
  }

  const nextProgramId = input.programId ?? existing.programId;
  if (input.programId) {
    await assertProgramOfferedForClass(schoolId, nextProgramId, existing.classLevel);
  }
  if (input.studentCount !== undefined) {
    await assertStrengthAllows(schoolId, input.studentCount, { excludeClassId: id });
  }

  const row = await schoolClassRepository.updateSchoolClass(id, {
    programId: input.programId,
    studentCount: input.studentCount,
  });
  notifyContentChanged({ kind: KIND, schoolId });
  return toWholeClassDto(row);
}

async function purgeClassRosterAndResults(
  schoolId: string,
  classLevel: number,
  programCode?: string | null,
) {
  const rolls = (await studentRepository.listRollsByClassLevel(schoolId, classLevel)).map(
    (row) => row.rollNo,
  );
  if (rolls.length > 0) {
    await resultService.purgeRollsFromResults(schoolId, rolls);
    await scanRepository.deleteOmScansByRolls(schoolId, rolls);
  }
  await studentRepository.deleteStudentsByClassLevel(schoolId, classLevel);
  await resultService.purgeClassFromResults(schoolId, classLevel, programCode ?? undefined);
  await scanRepository.deleteOmScansByClass(schoolId, classLevel);
}

export async function deleteSection(schoolId: string, id: string) {
  const existing = await sectionRepository.findSectionById(id);
  if (!existing || existing.schoolId !== schoolId) {
    throw new AppError(404, "Section not found");
  }

  const siblingsLeft = (await sectionRepository.listSectionsBySchool(schoolId)).some(
    (row) => row.classLevel === existing.classLevel && row.id !== id,
  );
  const wholeLeft = await schoolClassRepository.findSchoolClassByLevel(
    schoolId,
    existing.classLevel,
  );

  if (!siblingsLeft && !wholeLeft) {
    // Last org unit for this class → permanently remove every student in that class.
    await purgeClassRosterAndResults(schoolId, existing.classLevel, existing.program.code);
  } else {
    const rolls = (await studentRepository.listRollsBySectionId(id)).map((row) => row.rollNo);
    if (rolls.length > 0) {
      await resultService.purgeRollsFromResults(schoolId, rolls);
      await scanRepository.deleteOmScansByRolls(schoolId, rolls);
    }
    await studentRepository.deleteStudentsBySectionId(id);
  }

  await sectionRepository.deleteSection(id);
  notifyContentChanged({ kind: KIND, schoolId });
  notifyContentChanged({ kind: "students", schoolId });
}

export async function deleteSchoolClass(schoolId: string, id: string) {
  const existing = await schoolClassRepository.findSchoolClassById(id);
  if (!existing || existing.schoolId !== schoolId) {
    throw new AppError(404, "Class not found");
  }

  const sectionsLeft = (await sectionRepository.listSectionsBySchool(schoolId)).some(
    (row) => row.classLevel === existing.classLevel,
  );
  if (!sectionsLeft) {
    await purgeClassRosterAndResults(schoolId, existing.classLevel, existing.program.code);
  } else {
    const rolls = (
      await studentRepository.listWholeClassRolls(schoolId, existing.programId, existing.classLevel)
    ).map((row) => row.rollNo);
    if (rolls.length > 0) {
      await resultService.purgeRollsFromResults(schoolId, rolls);
      await scanRepository.deleteOmScansByRolls(schoolId, rolls);
    }
    await studentRepository.deleteWholeClassStudents(
      schoolId,
      existing.programId,
      existing.classLevel,
    );
  }

  await releaseClassLevelTeacher(schoolId, existing.programId, existing.classLevel);
  await schoolClassRepository.deleteSchoolClass(id);
  notifyContentChanged({ kind: KIND, schoolId });
  notifyContentChanged({ kind: "students", schoolId });
}

export async function setSectionClassTeacher(
  schoolId: string,
  sectionId: string,
  teacherId: string | null,
  applyToClass = false,
) {
  const existing = await sectionRepository.findSectionById(sectionId);
  if (!existing || existing.schoolId !== schoolId) {
    throw new AppError(404, "Section not found");
  }

  const classTeacherId = await assertClassTeacher(
    schoolId,
    teacherId,
    existing.programId,
    existing.classLevel,
  );

  if (applyToClass) {
    await sectionRepository.applyTeacherToClassLevel(
      schoolId,
      existing.classLevel,
      classTeacherId,
    );
  } else {
    await sectionRepository.updateSection(sectionId, { classTeacherId });
  }

  const refreshed = await sectionRepository.findSectionById(sectionId);
  notifyContentChanged({ kind: KIND, schoolId });
  return toSectionDto(refreshed);
}
