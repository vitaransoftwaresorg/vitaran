import * as schoolRepository from "../repositories/school.repository.js";
import * as resourceRepository from "../repositories/school-student-resource.repository.js";
import { deleteObject, getObject, replaceObject } from "./object-storage.js";
import { AppError } from "../utils/app-error.js";
import { subjectsForClassLevel } from "../utils/subject.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { loadOrganizationSlots, type ContentActor } from "./content-access.js";
import type { SchoolAccountDto } from "./school.service.js";

const KIND = "schools";
const PDF_MAX_BYTES = 20 * 1024 * 1024;
const PDF_MIME = new Set(["application/pdf"]);

function toDto(row: Awaited<ReturnType<typeof resourceRepository.listBySchool>>[number]) {
  return {
    id: row.id,
    schoolId: row.schoolId,
    programCode: row.programCode,
    classLevel: row.classLevel,
    subject: row.subject,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertSchool(schoolId: string) {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw new AppError(404, "School not found");
  return school;
}

function normalizeProgramCode(programCode: string) {
  return String(programCode ?? "")
    .trim()
    .toUpperCase();
}

function assertSlot(classLevel: number, subject: string) {
  if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 10) {
    throw new AppError(400, "Class must be between 1 and 10");
  }
  const allowed = subjectsForClassLevel(classLevel);
  if (!allowed.includes(subject)) {
    throw new AppError(400, `Subject ${subject} is not available for Class ${classLevel}`);
  }
}

function assertSchoolProgramClass(
  school: Awaited<ReturnType<typeof assertSchool>>,
  programCode: string,
  classLevel: number,
) {
  const enrolled = school.schoolPrograms.find((row) => row.program.code === programCode);
  if (!enrolled) {
    throw new AppError(400, `This school is not enrolled in ${programCode}`);
  }
  const hasClass = enrolled.classes.some((row) => row.classLevel === classLevel);
  if (!hasClass) {
    throw new AppError(400, `Class ${classLevel} is not set for ${enrolled.program.name}`);
  }
}

export async function listSchoolStudentResources(schoolId: string) {
  await assertSchool(schoolId);
  const rows = await resourceRepository.listBySchool(schoolId);
  return rows.map(toDto);
}

/** Portal: only programs/classes with at least one registered class or section. */
export async function listPortalSchoolStudentResources(actor: ContentActor) {
  const school = actor.kind === "school" ? actor.school : actor.teacher.school;
  const resources = await listSchoolStudentResources(school.id);
  const orgKeys = new Set(
    (await loadOrganizationSlots(school.id)).map(
      (slot) => `${slot.programCode}:${slot.classLevel}`,
    ),
  );

  let filtered = resources.filter((row) =>
    orgKeys.has(`${row.programCode}:${row.classLevel}`),
  );

  if (actor.kind === "teacher") {
    const allowed = new Set(
      actor.teacher.assignments.map(
        (row) =>
          `${row.programCode}:${row.classLevel}:${String(row.subject).toUpperCase()}`,
      ),
    );
    filtered = filtered.filter((row) =>
      allowed.has(`${row.programCode}:${row.classLevel}:${row.subject}`),
    );
  }

  return filtered;
}

export async function uploadSchoolStudentResource(
  schoolId: string,
  programCodeRaw: string,
  classLevel: number,
  subject: string,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
) {
  const school = await assertSchool(schoolId);
  const programCode = normalizeProgramCode(programCodeRaw);
  if (!programCode) throw new AppError(400, "Program is required");
  assertSlot(classLevel, subject);
  assertSchoolProgramClass(school, programCode, classLevel);

  if (!PDF_MIME.has(file.mimetype) && !file.originalname.toLowerCase().endsWith(".pdf")) {
    throw new AppError(400, "Upload a PDF file");
  }
  if (file.size <= 0 || file.size > PDF_MAX_BYTES) {
    throw new AppError(400, "PDF must be under 20 MB");
  }

  const previous = await resourceRepository.findWithData(
    schoolId,
    programCode,
    classLevel,
    subject,
  );
  const data = await replaceObject(
    previous?.data,
    `schools/${schoolId}/student-resources/${programCode}/${classLevel}/${subject}`,
    file.buffer,
    {
      fileName: file.originalname.slice(0, 255) || `${subject}.pdf`,
      contentType: "application/pdf",
    },
  );

  const row = await resourceRepository.upsertResource(
    schoolId,
    programCode,
    classLevel,
    subject,
    {
      fileName: file.originalname.slice(0, 255) || `${subject}.pdf`,
      fileSize: file.size,
      mimeType: "application/pdf",
      data,
    },
  );
  notifyContentChanged({ kind: KIND, schoolId });
  return toDto(row);
}

async function assertPortalAccess(
  school: Pick<SchoolAccountDto, "id">,
  programCode: string,
  classLevel: number,
) {
  const orgKeys = new Set(
    (await loadOrganizationSlots(school.id)).map(
      (slot) => `${slot.programCode}:${slot.classLevel}`,
    ),
  );
  if (!orgKeys.has(`${programCode}:${classLevel}`)) {
    throw new AppError(
      404,
      "Register at least one class for this program to access its resources",
    );
  }
}

export async function getSchoolStudentResourceFile(
  schoolId: string,
  programCodeRaw: string,
  classLevel: number,
  subject: string,
  options?: { requireRegisteredClass?: boolean },
) {
  await assertSchool(schoolId);
  const programCode = normalizeProgramCode(programCodeRaw);
  assertSlot(classLevel, subject);
  if (options?.requireRegisteredClass) {
    await assertPortalAccess({ id: schoolId }, programCode, classLevel);
  }
  const row = await resourceRepository.findWithData(
    schoolId,
    programCode,
    classLevel,
    subject,
  );
  if (!row) throw new AppError(404, "Student resource not found");
  const data = await getObject(row.data);
  if (!data) throw new AppError(404, "Student resource not found");
  return {
    data,
    mimeType: row.mimeType,
    fileName: row.fileName,
  };
}

export async function deleteSchoolStudentResource(
  schoolId: string,
  programCodeRaw: string,
  classLevel: number,
  subject: string,
) {
  await assertSchool(schoolId);
  const programCode = normalizeProgramCode(programCodeRaw);
  assertSlot(classLevel, subject);
  const row = await resourceRepository.findWithData(
    schoolId,
    programCode,
    classLevel,
    subject,
  );
  if (!row) throw new AppError(404, "Student resource not found");
  await deleteObject(row.data);
  await resourceRepository.deleteResource(schoolId, programCode, classLevel, subject);
  notifyContentChanged({ kind: KIND, schoolId });
  return { ok: true as const };
}

/**
 * Drop teacher-resource PDFs for programs/classes no longer enrolled on the school.
 * Call after school offerings are rewritten.
 */
export async function pruneSchoolStudentResourcesOutsideOfferings(
  schoolId: string,
  offerings: Array<{ programCode: string; classLevels: number[] }>,
) {
  const allowed = new Set(
    offerings.flatMap((row) =>
      row.classLevels.map((classLevel) => `${normalizeProgramCode(row.programCode)}:${classLevel}`),
    ),
  );
  const rows = await resourceRepository.listWithDataBySchool(schoolId);
  const orphanIds: string[] = [];
  for (const row of rows) {
    const key = `${normalizeProgramCode(row.programCode)}:${row.classLevel}`;
    if (allowed.has(key)) continue;
    await deleteObject(row.data);
    orphanIds.push(row.id);
  }
  if (orphanIds.length === 0) return { deleted: 0 };
  await resourceRepository.deleteManyByIds(orphanIds);
  notifyContentChanged({ kind: KIND, schoolId });
  return { deleted: orphanIds.length };
}
