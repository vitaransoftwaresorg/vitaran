import * as headOfficeRepository from "../repositories/head-office.repository.js";
import * as resourceRepository from "../repositories/head-office-teacher-resource.repository.js";
import { deleteObject, getObject, replaceObject } from "./object-storage.js";
import { AppError } from "../utils/app-error.js";
import { subjectsForClassLevel } from "../utils/subject.js";
import { notifyContentChanged } from "../utils/content-events.js";

const KIND = "schools";
const PDF_MAX_BYTES = 20 * 1024 * 1024;
const PDF_MIME = new Set(["application/pdf"]);

function toDto(row: Awaited<ReturnType<typeof resourceRepository.listByHeadOffice>>[number]) {
  return {
    id: row.id,
    headOfficeId: row.headOfficeId,
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

async function assertHeadOffice(headOfficeId: string) {
  const office = await headOfficeRepository.findHeadOfficeById(headOfficeId);
  if (!office) throw new AppError(404, "Head office not found");
  return office;
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

export async function listHeadOfficeTeacherResources(headOfficeId: string) {
  await assertHeadOffice(headOfficeId);
  return (await resourceRepository.listByHeadOffice(headOfficeId)).map(toDto);
}

export async function uploadHeadOfficeTeacherResource(
  headOfficeId: string,
  programCodeRaw: string,
  classLevel: number,
  subject: string,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
) {
  await assertHeadOffice(headOfficeId);
  const programCode = normalizeProgramCode(programCodeRaw);
  if (!programCode) throw new AppError(400, "Program is required");
  assertSlot(classLevel, subject);

  if (!PDF_MIME.has(file.mimetype) && !file.originalname.toLowerCase().endsWith(".pdf")) {
    throw new AppError(400, "Upload a PDF file");
  }
  if (file.size <= 0 || file.size > PDF_MAX_BYTES) {
    throw new AppError(400, "PDF must be under 20 MB");
  }

  const previous = await resourceRepository.findWithData(
    headOfficeId,
    programCode,
    classLevel,
    subject,
  );
  const data = await replaceObject(
    previous?.data,
    `head-offices/${headOfficeId}/teacher-resources/${programCode}/${classLevel}/${subject}`,
    file.buffer,
    {
      fileName: file.originalname.slice(0, 255) || `${subject}.pdf`,
      contentType: "application/pdf",
    },
  );

  const row = await resourceRepository.upsertResource(
    headOfficeId,
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
  notifyContentChanged({ kind: KIND, schoolId: null });
  return toDto(row);
}

export async function getHeadOfficeTeacherResourceFile(
  headOfficeId: string,
  programCodeRaw: string,
  classLevel: number,
  subject: string,
) {
  await assertHeadOffice(headOfficeId);
  const programCode = normalizeProgramCode(programCodeRaw);
  assertSlot(classLevel, subject);
  const row = await resourceRepository.findWithData(
    headOfficeId,
    programCode,
    classLevel,
    subject,
  );
  if (!row) throw new AppError(404, "Teacher resource not found");
  const data = await getObject(row.data);
  if (!data) throw new AppError(404, "Teacher resource not found");
  return {
    data,
    mimeType: row.mimeType,
    fileName: row.fileName,
  };
}

export async function deleteHeadOfficeTeacherResource(
  headOfficeId: string,
  programCodeRaw: string,
  classLevel: number,
  subject: string,
) {
  await assertHeadOffice(headOfficeId);
  const programCode = normalizeProgramCode(programCodeRaw);
  assertSlot(classLevel, subject);
  const row = await resourceRepository.findWithData(
    headOfficeId,
    programCode,
    classLevel,
    subject,
  );
  if (!row) throw new AppError(404, "Teacher resource not found");
  await deleteObject(row.data);
  await resourceRepository.deleteResource(headOfficeId, programCode, classLevel, subject);
  notifyContentChanged({ kind: KIND, schoolId: null });
  return { ok: true as const };
}
