import type { RequestHandler } from "express";
import type { UpdateAppSettingsInput } from "../schemas/settings.schema.js";
import * as settingsService from "../services/settings.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const getPublicSettings: RequestHandler = async (_req, res) => {
  sendSuccess(res, await settingsService.getPublicSettings());
};

export const getAdminSettings: RequestHandler = async (_req, res) => {
  sendSuccess(res, await settingsService.getAppSettings());
};

export const updateAdminSettings: RequestHandler<
  unknown,
  unknown,
  UpdateAppSettingsInput
> = async (req, res) => {
  sendSuccess(res, await settingsService.updateAppSettings(req.body));
};
