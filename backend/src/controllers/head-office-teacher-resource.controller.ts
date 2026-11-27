import type { RequestHandler } from "express";
import * as resourceService from "../services/head-office-teacher-resource.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../utils/app-error.js";

type HeadOfficeIdParams = { id: string };
type SlotParams = {
  id: string;
  programCode: string;
  classLevel: string;
  subject: string;
};

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

export const listAdminHeadOfficeTeacherResources: RequestHandler<HeadOfficeIdParams> = async (
  req,
  res,
) => {
  sendSuccess(res, await resourceService.listHeadOfficeTeacherResources(req.params.id));
};

export const uploadAdminHeadOfficeTeacherResource: RequestHandler<HeadOfficeIdParams> = async (
  req,
  res,
) => {
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
    await resourceService.uploadHeadOfficeTeacherResource(
      req.params.id,
      programCode,
      classLevel,
      subject,
      file,
    ),
    201,
  );
};

export const getAdminHeadOfficeTeacherResourceFile: RequestHandler<SlotParams> = async (
  req,
  res,
) => {
  const { programCode, classLevel, subject } = parseSlot(
    req.params.programCode,
    req.params.classLevel,
    req.params.subject,
  );
  const file = await resourceService.getHeadOfficeTeacherResourceFile(
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

export const deleteAdminHeadOfficeTeacherResource: RequestHandler<SlotParams> = async (
  req,
  res,
) => {
  const { programCode, classLevel, subject } = parseSlot(
    req.params.programCode,
    req.params.classLevel,
    req.params.subject,
  );
  sendSuccess(
    res,
    await resourceService.deleteHeadOfficeTeacherResource(
      req.params.id,
      programCode,
      classLevel,
      subject,
    ),
  );
};
