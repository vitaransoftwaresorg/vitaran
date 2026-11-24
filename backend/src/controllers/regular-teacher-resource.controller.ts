import type { RequestHandler } from "express";
import * as resourceService from "../services/regular-teacher-resource.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../utils/app-error.js";

type SlotParams = { programCode: string; classLevel: string; subject: string };

function parseSlot(params: SlotParams, volumeRaw?: unknown) {
  const classLevel = Number(params.classLevel);
  const volume = volumeRaw === undefined || volumeRaw === "" || volumeRaw === null
    ? 0
    : Number(volumeRaw);
  if (!Number.isInteger(classLevel)) throw new AppError(400, "Invalid class level");
  if (!Number.isInteger(volume)) throw new AppError(400, "Invalid volume");
  return {
    programCode: String(params.programCode ?? "").trim().toUpperCase(),
    classLevel,
    subject: String(params.subject ?? "").trim().toUpperCase(),
    volume,
  };
}

function sendPdf(
  res: Parameters<RequestHandler>[1],
  file: { data: Buffer; mimeType: string; fileName: string },
) {
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(file.data);
}

export const listAdminRegularTeacherResources: RequestHandler = async (req, res) => {
  const programCode =
    typeof req.query.programCode === "string" ? req.query.programCode : undefined;
  sendSuccess(res, await resourceService.listRegularTeacherResources(programCode));
};

export const uploadAdminRegularTeacherResource: RequestHandler = async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: "Choose a PDF to upload" });
    return;
  }
  const programCode = String(req.body.programCode ?? "").trim();
  const classLevel = Number(req.body.classLevel);
  const subject = String(req.body.subject ?? "").trim();
  const volume = req.body.volume === undefined || req.body.volume === ""
    ? 0
    : Number(req.body.volume);
  sendSuccess(
    res,
    await resourceService.uploadRegularTeacherResource(
      programCode,
      classLevel,
      subject,
      volume,
      file,
    ),
    201,
  );
};

export const getAdminRegularTeacherResourceFile: RequestHandler<SlotParams> = async (req, res) => {
  const slot = parseSlot(req.params, req.query.volume);
  const file = await resourceService.getRegularTeacherResourceFile(
    slot.programCode,
    slot.classLevel,
    slot.subject,
    slot.volume,
  );
  sendPdf(res, file);
};

export const deleteAdminRegularTeacherResource: RequestHandler<SlotParams> = async (req, res) => {
  const slot = parseSlot(req.params, req.query.volume);
  sendSuccess(
    res,
    await resourceService.deleteRegularTeacherResource(
      slot.programCode,
      slot.classLevel,
      slot.subject,
      slot.volume,
    ),
  );
};

export const listPublicRegularTeacherResources: RequestHandler = async (req, res) => {
  const authenticated = Boolean(res.locals.authenticated);
  await resourceService.assertCanViewTeacherResources(authenticated);
  const programCode =
    typeof req.query.programCode === "string" ? req.query.programCode : undefined;
  sendSuccess(res, await resourceService.listRegularTeacherResources(programCode));
};

export const getPublicRegularTeacherResourceFile: RequestHandler<SlotParams> = async (req, res) => {
  const authenticated = Boolean(res.locals.authenticated);
  await resourceService.assertCanViewTeacherResources(authenticated);
  const slot = parseSlot(req.params, req.query.volume);
  const file = await resourceService.getRegularTeacherResourceFile(
    slot.programCode,
    slot.classLevel,
    slot.subject,
    slot.volume,
  );
  sendPdf(res, file);
};
