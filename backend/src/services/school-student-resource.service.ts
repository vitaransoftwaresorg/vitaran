import * as schoolRepository from "../repositories/school.repository.js";
import * as resourceRepository from "../repositories/school-student-resource.repository.js";
import { deleteObject, getObject, replaceObject } from "./object-storage.js";
import { AppError } from "../utils/app-error.js";
import { subjectsForClassLevel } from "../utils/subject.js";
import { notifyContentChanged } from "../utils/content-events.js";

const KIND = "schools";
const PDF_MAX_BYTES = 20 * 1024 * 1024;
const PDF_MIME = new Set(["application/pdf"]);

function toDto(row: Awaited<ReturnType<typeof resourceRepository.listBySchool>>[number]) {
  return {
    id: row.id,
    schoolId: row.schoolId,
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

function assertSlot(classLevel: number, subject: string) {
  if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 10) {
    throw new AppError(400, "Class must be between 1 and 10");
  }
  const allowed = subjectsForClassLevel(classLevel);
  if (!allowed.includes(subject)) {
    throw new AppError(400, `Subject ${subject} is not available for Class ${classLevel}`);
  }
}

export async function listSchoolStudentResources(schoolId: string) {
  await assertSchool(schoolId);
  const rows = await resourceRepository.listBySchool(schoolId);
  return rows.map(toDto);
}

export async function uploadSchoolStudentResource(
  schoolId: string,
  classLevel: number,
  subject: string,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
) {
  await assertSchool(schoolId);
  assertSlot(classLevel, subject);

  if (!PDF_MIME.has(file.mimetype) && !file.originalname.toLowerCase().endsWith(".pdf")) {
    throw new AppError(400, "Upload a PDF file");
  }
  if (file.size <= 0 || file.size > PDF_MAX_BYTES) {
    throw new AppError(400, "PDF must be under 20 MB");
  }

  const previous = await resourceRepository.findWithData(schoolId, classLevel, subject);
  const data = await replaceObject(
    previous?.data,
    `schools/${schoolId}/student-resources/${classLevel}/${subject}`,
    file.buffer,
    {
      fileName: file.originalname.slice(0, 255) || `${subject}.pdf`,
      contentType: "application/pdf",
    },
  );

  const row = await resourceRepository.upsertResource(schoolId, classLevel, subject, {
    fileName: file.originalname.slice(0, 255) || `${subject}.pdf`,
    fileSize: file.size,
    mimeType: "application/pdf",
    data,
  });
  notifyContentChanged({ kind: KIND, schoolId });
  return toDto(row);
}

export async function getSchoolStudentResourceFile(
  schoolId: string,
  classLevel: number,
  subject: string,
) {
  await assertSchool(schoolId);
  assertSlot(classLevel, subject);
  const row = await resourceRepository.findWithData(schoolId, classLevel, subject);
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
  classLevel: number,
  subject: string,
) {
  await assertSchool(schoolId);
  assertSlot(classLevel, subject);
  const row = await resourceRepository.findWithData(schoolId, classLevel, subject);
  if (!row) throw new AppError(404, "Student resource not found");
  await deleteObject(row.data);
  await resourceRepository.deleteResource(schoolId, classLevel, subject);
  notifyContentChanged({ kind: KIND, schoolId });
  return { ok: true as const };
}
