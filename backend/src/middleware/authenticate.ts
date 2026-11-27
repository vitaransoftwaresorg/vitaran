import type { RequestHandler } from "express";
import type { AdminProfile } from "../services/auth.service.js";
import { verifyAdminToken } from "../services/auth.service.js";
import { verifyHeadOfficeToken } from "../services/head-office-auth.service.js";
import { verifySchoolToken } from "../services/school-auth.service.js";
import { verifyTeacherToken } from "../services/teacher-auth.service.js";
import * as settingsService from "../services/settings.service.js";
import { AppError } from "../utils/app-error.js";

const BEARER_PREFIX = "Bearer ";

function bearerAuth(
  local: "admin" | "school" | "teacher" | "headOffice",
  verify: (token: string) => Promise<unknown>,
): RequestHandler {
  return async (req, res, next) => {
    const header = req.get("authorization");

    if (!header?.startsWith(BEARER_PREFIX)) {
      next(new AppError(401, "Authentication required"));
      return;
    }

    try {
      res.locals[local] = await verify(header.slice(BEARER_PREFIX.length).trim());
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Root admin always allowed; employee admins blocked during maintenance. */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  await bearerAuth("admin", verifyAdminToken)(req, res, async (error) => {
    if (error) {
      next(error);
      return;
    }
    try {
      const admin = res.locals.admin as AdminProfile | undefined;
      if (admin && !admin.isRoot) {
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
      }
      next();
    } catch (err) {
      next(err);
    }
  });
};
/** Settings / employee management — root admin only. */
export const requireRootAdmin: RequestHandler = (req, res, next) => {
  requireAdmin(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }
    const admin = res.locals.admin as AdminProfile | undefined;
    if (!admin?.isRoot) {
      next(new AppError(403, "Only the primary admin can manage settings"));
      return;
    }
    next();
  });
};

export const requireSchool = bearerAuth("school", verifySchoolToken);
export const requireTeacher = bearerAuth("teacher", verifyTeacherToken);
export const requireHeadOffice = bearerAuth("headOffice", verifyHeadOfficeToken);
