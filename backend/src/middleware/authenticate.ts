import type { RequestHandler } from "express";
import { verifyAdminToken } from "../services/auth.service.js";
import { verifySchoolToken } from "../services/school-auth.service.js";
import { verifyTeacherToken } from "../services/teacher-auth.service.js";
import { AppError } from "../utils/app-error.js";

const BEARER_PREFIX = "Bearer ";

function bearerAuth(
  local: "admin" | "school" | "teacher",
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

export const requireAdmin = bearerAuth("admin", verifyAdminToken);
export const requireSchool = bearerAuth("school", verifySchoolToken);
export const requireTeacher = bearerAuth("teacher", verifyTeacherToken);
