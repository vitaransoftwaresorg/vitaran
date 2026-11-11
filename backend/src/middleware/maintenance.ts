import type { RequestHandler } from "express";
import * as settingsService from "../services/settings.service.js";
import { AppError } from "../utils/app-error.js";

/** Blocks school/teacher API traffic while maintenance mode is on. */
export const blockIfMaintenance: RequestHandler = async (_req, _res, next) => {
  try {
    const { maintenanceMode } = await settingsService.getPublicSettings();
    if (maintenanceMode) {
      next(
        new AppError(
          503,
          "Vitaran Learning is under maintenance. Please try again shortly.",
        ),
      );
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
