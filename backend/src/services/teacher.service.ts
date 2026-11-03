import { TeacherStatus } from "../generated/prisma/enums.js";
import * as schoolRepository from "../repositories/school.repository.js";
import * as sectionRepository from "../repositories/section.repository.js";
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
import { sendTeacherCredentialsEmail } from "./mail.service.js";
import * as sectionService from "./section.service.js";
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
  subject: string;
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

export type ClassTeacherSectionDto = {
  kind: "class" | "section";
  sectionId?: string;
  sectionName?: string;
  classLevel: number;
  programId: string;
  programCode: string;
  programName: string;
};

export type TeacherAccountDto = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: TeacherStatus;
  schoolId: string;
  assignments: TeacherAssignmentDto[];
  classTeacherSections: ClassTeacherSectionDto[];
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
  const assignments = toAssignments(teacher);
  const schoolPrograms: SchoolProgramDto[] = teacher.school.schoolPrograms.map((row) => ({
    programId: row.programId,
    programCode: row.program.code,
    programName: row.program.name,
    type: row.program.type,
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
    assignments,
    classTeacherSections: [
      ...teacher.classTeacherOfClasses.map((row) => ({
        kind: "class" as const,
        classLevel: row.classLevel,
        programId: row.programId,
        programCode: row.program.code,
        programName: row.program.name,
      })),
      ...teacher.classTeacherOf.map((row) => ({
        kind: "section" as const,
        sectionId: row.id,
        sectionName: row.name,
        classLevel: row.classLevel,
        programId: row.programId,
        programCode: row.program.code,
        programName: row.program.name,
      })),
    ],
    school: {
      id: teacher.school.id,
      name: teacher.school.name,
      code: teacher.school.code,
      type: teacher.school.type,
      schoolPrograms,
      programCodes: [
        ...new Set([
          ...schoolPrograms.map((row) => row.programCode),
          ...assignments.map((row) => row.programCode),
        ]),
      ],
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
  assignments: { programId: string; classLevel: number; subject: string }[],
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

type ClassTeacherSlotPick =
  | { kind: "class"; programId: string; classLevel: number }
  | { kind: "section"; sectionId: string };

/** Validate hybrid class/section class-teacher picks. */
async function assertClassTeacherSlots(
  schoolId: string,
  slots: ClassTeacherSlotPick[],
  assignments: { programId: string; classLevel: number }[],
  teacherId?: string,
) {
  const assigned = new Set(assignments.map((item) => `${item.programId}:${item.classLevel}`));
  const sections = await sectionRepository.listSectionsBySchool(schoolId);
  const byId = new Map(sections.map((row) => [row.id, row]));
  const sectionCounts = new Map<string, number>();
  for (const row of sections) {
    const key = `${row.programId}:${row.classLevel}`;
    sectionCounts.set(key, (sectionCounts.get(key) ?? 0) + 1);
  }

  const classSlots: { programId: string; classLevel: number }[] = [];
  const sectionIds: string[] = [];

  for (const slot of slots) {
    if (slot.kind === "class") {
      const key = `${slot.programId}:${slot.classLevel}`;
      if (!assigned.has(key)) {
        throw new AppError(400, "Class teacher must be assigned at least one subject in that class");
      }
      if ((sectionCounts.get(key) ?? 0) > 0) {
        throw new AppError(
          400,
          "This class already has sections — pick a section for class teacher instead",
        );
      }
      classSlots.push({ programId: slot.programId, classLevel: slot.classLevel });
      continue;
    }

    const section = byId.get(slot.sectionId);
    if (!section) throw new AppError(400, "Unknown section for class teacher");

    const key = `${section.programId}:${section.classLevel}`;
    if (!assigned.has(key)) {
      throw new AppError(
        400,
        `Class teacher for ${section.classLevel}-${section.name} needs a subject in that program and class`,
      );
    }
    if (
      section.classTeacherId &&
      section.classTeacherId !== teacherId &&
      section.classTeacher?.status === TeacherStatus.ACTIVE
    ) {
      throw new AppError(
        409,
        `Section ${section.classLevel}-${section.name} already has a class teacher`,
      );
    }
    sectionIds.push(section.id);
  }

  return { classSlots, sectionIds };
}

async function applyClassTeacherSlots(
  schoolId: string,
  teacherId: string,
  slots: ClassTeacherSlotPick[],
  assignments: { programId: string; classLevel: number }[],
) {
  const { classSlots, sectionIds } = await assertClassTeacherSlots(
    schoolId,
    slots,
    assignments,
    teacherId,
  );
  try {
    await teacherRepository.syncTeacherClassTeacherSlots(
      schoolId,
      teacherId,
      classSlots,
      sectionIds,
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SECTION_TAKEN:")) {
      throw new AppError(409, "One of the selected sections already has a class teacher");
    }
    throw error;
  }
}

export async function createTeacher(schoolId: string, input: CreateTeacherInput) {
  const school = await schoolRepository.findSchoolById(schoolId);
  assertAssignmentsAgainstSchool(input.assignments, school);
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
    await applyClassTeacherSlots(
      schoolId,
      teacher.id,
      input.classTeacherFor,
      input.assignments,
    );
  }

  const detail = toTeacherDetailDto(teacher);
  await sendTeacherCredentialsEmail({
    to: input.email,
    teacherName: input.name,
    schoolName: school?.name ?? detail.school.name,
    schoolEmail: school?.accountEmail ?? null,
    loginEmail: input.email,
    loginPhone: input.phone,
    password: input.password,
    reason: "created",
  });

  return detail;
}

export async function updateTeacher(id: string, input: UpdateTeacherInput, schoolId?: string) {
  const existing = await teacherRepository.findTeacherById(id);
  if (!existing) throw new AppError(404, "Teacher not found");
  if (schoolId && existing.schoolId !== schoolId) throw new AppError(404, "Teacher not found");

  let classTeacherFor = input.classTeacherFor;
  let assignmentBasis: { programId: string; classLevel: number }[] = existing.assignments;
  if (input.assignments) {
    const school = await schoolRepository.findSchoolById(existing.schoolId);
    assertAssignmentsAgainstSchool(input.assignments, school);
    assignmentBasis = input.assignments;
  }

  if (input.email || input.phone) {
    await assertUniqueCredentials(
      input.email ?? existing.email,
      input.phone ?? existing.phone,
      id,
    );
  }

  let sealed: { passwordHash?: string; passwordEncrypted?: string } = {};
  let passwordReset: string | undefined;
  if (input.password) {
    const unchanged =
      existing.passwordHash && (await verifyPassword(input.password, existing.passwordHash));
    if (!unchanged) {
      sealed = await sealPassword(input.password);
      passwordReset = input.password;
    }
  }

  const teacher = await teacherRepository.updateTeacher(id, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    status: input.status,
    ...sealed,
    assignments: input.assignments,
  });

  if (classTeacherFor) {
    await applyClassTeacherSlots(existing.schoolId, id, classTeacherFor, assignmentBasis);
  }

  const detail = toTeacherDetailDto(teacher);

  // School/admin sets a new password → teacher (+ school mailbox) receive it by email.
  if (passwordReset) {
    await sendTeacherCredentialsEmail({
      to: detail.email,
      teacherName: detail.name,
      schoolName: detail.school.name,
      schoolEmail: existing.school.accountEmail,
      loginEmail: detail.email,
      loginPhone: detail.phone,
      password: passwordReset,
      reason: "password-reset",
    });
  }

  return detail;
}

/** Resend current teacher credentials by email (school or admin). */
export async function sendTeacherCredentials(id: string, schoolId?: string) {
  const existing = await teacherRepository.findTeacherById(id);
  if (!existing) throw new AppError(404, "Teacher not found");
  if (schoolId && existing.schoolId !== schoolId) throw new AppError(404, "Teacher not found");

  const teacher = await getTeacher(id);
  if (!teacher.password) {
    throw new AppError(400, "Set a password before sending credentials");
  }

  const sent = await sendTeacherCredentialsEmail({
    to: teacher.email,
    teacherName: teacher.name,
    schoolName: teacher.school.name,
    schoolEmail: existing.school.accountEmail,
    loginEmail: teacher.email,
    loginPhone: teacher.phone,
    password: teacher.password,
    reason: "resend",
  });
  if (!sent) {
    throw new AppError(502, "Could not send the email. Check SMTP settings and try again.");
  }
  return { ok: true as const, to: teacher.email };
}

/** Set a new teacher password and email it (school/admin reset flow). */
export async function resetTeacherPassword(id: string, password: string, schoolId?: string) {
  const existing = await teacherRepository.findTeacherById(id);
  if (!existing) throw new AppError(404, "Teacher not found");
  if (schoolId && existing.schoolId !== schoolId) throw new AppError(404, "Teacher not found");

  const sealed = await sealPassword(password);
  const teacher = await teacherRepository.updateTeacher(id, sealed);
  const detail = toTeacherDetailDto(teacher);

  const sent = await sendTeacherCredentialsEmail({
    to: detail.email,
    teacherName: detail.name,
    schoolName: detail.school.name,
    schoolEmail: existing.school.accountEmail,
    loginEmail: detail.email,
    loginPhone: detail.phone,
    password,
    reason: "password-reset",
  });
  if (!sent) {
    throw new AppError(502, "Password was saved but the email could not be sent. Try Send credentials.");
  }
  return { ok: true as const, to: detail.email };
}

export async function setTeacherStatus(
  id: string,
  input: SetTeacherStatusInput,
  schoolId?: string,
) {
  // Light lookup only — status toggle must stay snappy (no full assignment/program graph).
  const existing = await teacherRepository.findTeacherStatusTarget(id);
  if (!existing) throw new AppError(404, "Teacher not found");
  if (schoolId && existing.schoolId !== schoolId) throw new AppError(404, "Teacher not found");

  await teacherRepository.setTeacherStatus(id, input.status);
  return {
    id: existing.id,
    schoolId: existing.schoolId,
    name: existing.name,
    email: existing.email,
    phone: existing.phone,
    status: input.status,
    assignments: [] as TeacherAssignmentDto[],
    school: { ...toSchoolRef(existing.school), type: existing.school.type },
    createdAt: existing.createdAt.toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies TeacherDto;
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
  return sectionService.listSections(schoolId);
}

export async function listClassTeacherSlots(schoolId: string) {
  const [sections, classRows] = await Promise.all([
    teacherRepository.listSectionsWithClassTeachers(schoolId),
    teacherRepository.listClassLevelTeachers(schoolId),
  ]);

  const sectionSlots = sections
    .filter((row) => row.classTeacher && row.classTeacher.status === TeacherStatus.ACTIVE)
    .map((row) => ({
      kind: "section" as const,
      sectionId: row.id,
      programId: row.programId,
      programCode: row.program.code,
      programName: row.program.name,
      classLevel: row.classLevel,
      sectionName: row.name,
      teacherId: row.classTeacher!.id,
      teacherName: row.classTeacher!.name,
    }));

  const classSlots = classRows
    .filter((row) => row.teacher.status === TeacherStatus.ACTIVE)
    .map((row) => ({
      kind: "class" as const,
      programId: row.programId,
      programCode: row.program.code,
      programName: row.program.name,
      classLevel: row.classLevel,
      teacherId: row.teacherId,
      teacherName: row.teacher.name,
    }));

  return [...classSlots, ...sectionSlots];
}

export async function listClassTeachersForTeacher(teacherId: string) {
  const [classRows, sectionRows] = await teacherRepository.listClassTeacherSlotsForTeacher(teacherId);
  return {
    classes: classRows,
    sections: sectionRows,
  };
}

export async function setClassTeacher(schoolId: string, input: SetClassTeacherInput) {
  if (input.kind === "section") {
    return sectionService.setSectionClassTeacher(
      schoolId,
      input.sectionId,
      input.teacherId,
      input.applyToClass,
    );
  }

  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");

  const offering = school.schoolPrograms.find((row) => row.programId === input.programId);
  if (!offering?.classes.some((cls) => cls.classLevel === input.classLevel)) {
    throw new AppError(400, "This class is not enabled for the selected program");
  }

  const sections = await sectionRepository.listSectionsBySchool(schoolId);
  if (
    sections.some(
      (row) => row.programId === input.programId && row.classLevel === input.classLevel,
    )
  ) {
    throw new AppError(400, "This class has sections — assign class teacher per section");
  }

  if (input.teacherId) {
    const teacher = await teacherRepository.findTeacherById(input.teacherId);
    if (!teacher || teacher.schoolId !== schoolId) {
      throw new AppError(400, "Class teacher must belong to this school");
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
        kind: "class" as const,
        programId: input.programId,
        classLevel: input.classLevel,
        teacherId: row.teacherId,
        name: row.teacher.name,
        email: row.teacher.email,
        status: row.teacher.status,
      }
    : null;
}
