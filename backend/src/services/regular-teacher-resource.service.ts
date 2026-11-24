import * as resourceRepository from "../repositories/regular-teacher-resource.repository.js";
import { getAppSettings } from "./settings.service.js";
import { deleteObject, getObject, replaceObject } from "./object-storage.js";
import { AppError } from "../utils/app-error.js";
import { normalizeSubjectCode, subjectsForClassLevel } from "../utils/subject.js";
import { notifyContentChanged } from "../utils/content-events.js";

const KIND = "teacher-resources";
const PDF_MAX_BYTES = 40 * 1024 * 1024;
const PDF_MIME = new Set(["application/pdf"]);

const PROGRAM_CODES = new Set([
  "INTEGRATED",
  "ADVANCED",
  "REVISED_ADVANCED",
  "OLYMPIAD",
  "OLYMPIAD_PRIMARY",
  "INTEGRATED_CLASSIC",
  "ADVANCED_CLASSIC",
  "OLYMPIAD_CLASSIC",
]);

function toDto(row: Awaited<ReturnType<typeof resourceRepository.listAll>>[number]) {
  return {
    id: row.id,
    programCode: row.programCode,
    classLevel: row.classLevel,
    subject: row.subject,
    volume: row.volume > 0 ? row.volume : null,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertSlot(programCode: string, classLevel: number, subject: string, volume: number) {
  const code = programCode.trim().toUpperCase();
  if (!PROGRAM_CODES.has(code)) {
    throw new AppError(400, "Unknown teacher-resource program");
  }
  if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 12) {
    throw new AppError(400, "Class must be between 1 and 12");
  }
  if (!Number.isInteger(volume) || volume < 0 || volume > 20) {
    throw new AppError(400, "Volume must be between 0 and 20");
  }
  const normalized = normalizeSubjectCode(subject);
  const allowed = new Set(subjectsForClassLevel(classLevel));
  if (!allowed.has(normalized)) {
    throw new AppError(400, `Subject ${normalized} is not available for Class ${classLevel}`);
  }
  return { programCode: code, classLevel, subject: normalized, volume };
}

export async function listRegularTeacherResources(programCode?: string) {
  const rows = programCode
    ? await resourceRepository.listByProgram(programCode.trim().toUpperCase())
    : await resourceRepository.listAll();
  return rows.map(toDto);
}

export async function uploadRegularTeacherResource(
  programCodeRaw: string,
  classLevel: number,
  subjectRaw: string,
  volumeRaw: number,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
) {
  const { programCode, subject, volume } = assertSlot(
    programCodeRaw,
    classLevel,
    subjectRaw,
    volumeRaw,
  );

  if (!PDF_MIME.has(file.mimetype) && !file.originalname.toLowerCase().endsWith(".pdf")) {
    throw new AppError(400, "Upload a PDF file");
  }
  if (file.size <= 0 || file.size > PDF_MAX_BYTES) {
    throw new AppError(400, "PDF must be under 40 MB");
  }

  const previous = await resourceRepository.findWithData(programCode, classLevel, subject, volume);
  const data = await replaceObject(
    previous?.data,
    `teacher-resources/${programCode}/${classLevel}/${subject}${volume > 0 ? `/v${volume}` : ""}`,
    file.buffer,
    {
      fileName: file.originalname.slice(0, 255) || `${subject}.pdf`,
      contentType: "application/pdf",
    },
  );

  const row = await resourceRepository.upsertResource(programCode, classLevel, subject, volume, {
    fileName: file.originalname.slice(0, 255) || `${subject}.pdf`,
    fileSize: file.size,
    mimeType: "application/pdf",
    data,
  });
  notifyContentChanged({ kind: KIND, schoolId: null });
  return toDto(row);
}

export async function getRegularTeacherResourceFile(
  programCodeRaw: string,
  classLevel: number,
  subjectRaw: string,
  volumeRaw = 0,
) {
  const { programCode, subject, volume } = assertSlot(
    programCodeRaw,
    classLevel,
    subjectRaw,
    volumeRaw,
  );
  const row = await resourceRepository.findWithData(programCode, classLevel, subject, volume);
  if (!row) throw new AppError(404, "Teacher resource not found");
  const data = await getObject(row.data);
  if (!data) throw new AppError(404, "Teacher resource not found");
  return {
    data,
    mimeType: row.mimeType,
    fileName: row.fileName,
  };
}

export async function deleteRegularTeacherResource(
  programCodeRaw: string,
  classLevel: number,
  subjectRaw: string,
  volumeRaw = 0,
) {
  const { programCode, subject, volume } = assertSlot(
    programCodeRaw,
    classLevel,
    subjectRaw,
    volumeRaw,
  );
  const row = await resourceRepository.findWithData(programCode, classLevel, subject, volume);
  if (!row) throw new AppError(404, "Teacher resource not found");
  await deleteObject(row.data);
  await resourceRepository.deleteResource(programCode, classLevel, subject, volume);
  notifyContentChanged({ kind: KIND, schoolId: null });
  return { ok: true as const };
}

/** Public / portal file access when teacher resources are public or caller is authenticated. */
export async function assertCanViewTeacherResources(authenticated: boolean) {
  if (authenticated) return;
  const settings = await getAppSettings();
  if (!settings.teacherResourcesPublic) {
    throw new AppError(401, "Sign in required to view this resource.");
  }
}
