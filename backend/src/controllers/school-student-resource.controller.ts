import type { RequestHandler } from "express";
import type { SchoolAccountDto } from "../services/school.service.js";
import * as resourceService from "../services/school-student-resource.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../utils/app-error.js";

type SchoolIdParams = { id: string };
type SlotParams = { id: string; classLevel: string; subject: string };
type PortalSlotParams = { classLevel: string; subject: string };

function parseSlot(classLevelRaw: string, subjectRaw: string) {
  const classLevel = Number(classLevelRaw);
  const subject = String(subjectRaw ?? "")
    .trim()
    .toUpperCase();
  if (!Number.isInteger(classLevel)) throw new AppError(400, "Invalid class level");
  if (!subject) throw new AppError(400, "Subject is required");
  return { classLevel, subject };
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
  const classLevel = Number(req.body.classLevel);
  const subject = String(req.body.subject ?? "")
    .trim()
    .toUpperCase();
  sendSuccess(
    res,
    await resourceService.uploadSchoolStudentResource(req.params.id, classLevel, subject, file),
    201,
  );
};

export const getAdminSchoolStudentResourceFile: RequestHandler<SlotParams> = async (req, res) => {
  const { classLevel, subject } = parseSlot(req.params.classLevel, req.params.subject);
  const file = await resourceService.getSchoolStudentResourceFile(req.params.id, classLevel, subject);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(file.data);
};

export const deleteAdminSchoolStudentResource: RequestHandler<SlotParams> = async (req, res) => {
  const { classLevel, subject } = parseSlot(req.params.classLevel, req.params.subject);
  sendSuccess(res, await resourceService.deleteSchoolStudentResource(req.params.id, classLevel, subject));
};

export const listSchoolPortalStudentResources: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await resourceService.listSchoolStudentResources(school.id));
};

export const getSchoolPortalStudentResourceFile: RequestHandler<PortalSlotParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  const { classLevel, subject } = parseSlot(req.params.classLevel, req.params.subject);
  const file = await resourceService.getSchoolStudentResourceFile(school.id, classLevel, subject);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(file.data);
};
