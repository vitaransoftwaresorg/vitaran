import type { RequestHandler } from "express";
import type {
  AccountAvailabilityQuery,
  CreateSchoolInput,
  ListSchoolOptionsQuery,
  ListSchoolsQuery,
  ResetSchoolPasswordInput,
  UpdateSchoolInput,
} from "../schemas/school.schema.js";
import * as schoolService from "../services/school.service.js";
import { sendSuccess } from "../utils/api-response.js";

type IdParams = { id: string };

export const listSchools: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await schoolService.listSchools(req.query as unknown as ListSchoolsQuery),
  );
};

export const listSchoolOptions: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await schoolService.listSchoolOptions(req.query as unknown as ListSchoolOptionsQuery),
  );
};

export const getAccountAvailability: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await schoolService.getAccountAvailability(
      req.query as unknown as AccountAvailabilityQuery,
    ),
  );
};

export const getSchoolStats: RequestHandler = async (_req, res) => {
  sendSuccess(res, await schoolService.getSchoolStats());
};

export const getSchool: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await schoolService.getSchool(req.params.id));
};

export const createSchool: RequestHandler<
  unknown,
  unknown,
  CreateSchoolInput
> = async (req, res) => {
  sendSuccess(res, await schoolService.createSchool(req.body), 201);
};

export const updateSchool: RequestHandler<
  IdParams,
  unknown,
  UpdateSchoolInput
> = async (req, res) => {
  sendSuccess(res, await schoolService.updateSchool(req.params.id, req.body));
};

export const deleteSchool: RequestHandler<IdParams> = async (req, res) => {
  await schoolService.deleteSchool(req.params.id);
  res.status(204).end();
};

export const sendSchoolCredentials: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await schoolService.sendSchoolCredentials(req.params.id));
};

export const resetSchoolPassword: RequestHandler<
  IdParams,
  unknown,
  ResetSchoolPasswordInput
> = async (req, res) => {
  sendSuccess(res, await schoolService.resetSchoolPassword(req.params.id, req.body.password));
};

export const uploadSchoolLogo: RequestHandler<IdParams> = async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: "Choose a logo image to upload" });
    return;
  }
  sendSuccess(res, await schoolService.uploadSchoolLogo(req.params.id, file));
};

export const getSchoolLogo: RequestHandler<IdParams> = async (req, res) => {
  const logo = await schoolService.getSchoolLogo(req.params.id);
  res.setHeader("Content-Type", logo.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${logo.fileName.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(logo.data);
};

export const deleteSchoolLogo: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await schoolService.deleteSchoolLogo(req.params.id));
};
