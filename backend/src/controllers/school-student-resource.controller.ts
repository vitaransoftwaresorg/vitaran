import type { RequestHandler } from "express";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import * as resourceService from "../services/school-student-resource.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../utils/app-error.js";

type SchoolIdParams = { id: string };
type SlotParams = { id: string; programCode: string; classLevel: string; subject: string };
type PortalSlotParams = { programCode: string; classLevel: string; subject: string };

function parseSlot(programCodeRaw: string, classLevelRaw: string, subjectRaw: string) {
  const programCode = String(programCodeRaw ?? "")
    .trim()
    .toUpperCase();
  const classLevel = Number(classLevelRaw);
  const subject = String(subjectRaw ?? "")
    .trim()
    .toUpperCase();
  if (!programCode) throw new AppError(400, "Program is required");
  if (!Number.isInteger(classLevel)) throw new AppError(400, "Invalid class level");
  if (!subject) throw new AppError(400, "Subject is required");
  return { programCode, classLevel, subject };
}

export const listAdminSchoolStudentResources: RequestHandler<SchoolIdParams> = async (req, res) => {
  sendSuccess(res, await resourceService.listSchoolStudentResources(req.params.id));
};

export const uploadAdminSchoolStudentResource: RequestHandler<SchoolIdParams> = async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: "Choose a PDF to upload" });
    return;
  }
  const programCode = String(req.body.programCode ?? "")
    .trim()
    .toUpperCase();
  const classLevel = Number(req.body.classLevel);
  const subject = String(req.body.subject ?? "")
    .trim()
    .toUpperCase();
  sendSuccess(
    res,
    await resourceService.uploadSchoolStudentResource(
      req.params.id,
      programCode,
      classLevel,
      subject,
      file,
    ),
    201,
  );
};

export const getAdminSchoolStudentResourceFile: RequestHandler<SlotParams> = async (req, res) => {
  const { programCode, classLevel, subject } = parseSlot(
    req.params.programCode,
    req.params.classLevel,
    req.params.subject,
  );
  const file = await resourceService.getSchoolStudentResourceFile(
    req.params.id,
    programCode,
    classLevel,
    subject,
  );
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(file.data);
};

export const deleteAdminSchoolStudentResource: RequestHandler<SlotParams> = async (req, res) => {
  const { programCode, classLevel, subject } = parseSlot(
    req.params.programCode,
    req.params.classLevel,
    req.params.subject,
  );
  sendSuccess(
    res,
    await resourceService.deleteSchoolStudentResource(
      req.params.id,
      programCode,
      classLevel,
      subject,
    ),
  );
};

export const listSchoolPortalStudentResources: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(
    res,
    await resourceService.listPortalSchoolStudentResources({ kind: "school", school }),
  );
};

export const getSchoolPortalStudentResourceFile: RequestHandler<PortalSlotParams> = async (
  req,
  res,
) => {
  const school = res.locals.school as SchoolAccountDto;
  const { programCode, classLevel, subject } = parseSlot(
    req.params.programCode,
    req.params.classLevel,
    req.params.subject,
  );
  const file = await resourceService.getSchoolStudentResourceFile(
    school.id,
    programCode,
    classLevel,
    subject,
    { requireRegisteredClass: true, resolveInherited: true },
  );
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(file.data);
};

export const listTeacherPortalStudentResources: RequestHandler = async (_req, res) => {
  const teacher = res.locals.teacher as TeacherAccountDto;
  sendSuccess(
    res,
    await resourceService.listPortalSchoolStudentResources({ kind: "teacher", teacher }),
  );
};

export const getTeacherPortalStudentResourceFile: RequestHandler<PortalSlotParams> = async (
  req,
  res,
) => {
  const teacher = res.locals.teacher as TeacherAccountDto;
  const { programCode, classLevel, subject } = parseSlot(
    req.params.programCode,
    req.params.classLevel,
    req.params.subject,
  );
  const allowed = teacher.assignments.some(
    (row) =>
      row.programCode === programCode &&
      row.classLevel === classLevel &&
      String(row.subject).toUpperCase() === subject,
  );
  if (!allowed) throw new AppError(403, "Not assigned to this program, class, and subject");
  const file = await resourceService.getSchoolStudentResourceFile(
    teacher.school.id,
    programCode,
    classLevel,
    subject,
    { requireRegisteredClass: true, resolveInherited: true },
  );
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(file.data);
};
