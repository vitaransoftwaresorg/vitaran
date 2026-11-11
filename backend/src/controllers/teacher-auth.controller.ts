import type { RequestHandler } from "express";
import type { SchoolLoginInput } from "../schemas/auth.schema.js";
import { loginTeacher } from "../services/teacher-auth.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const teacherLogin: RequestHandler<unknown, unknown, SchoolLoginInput> = async (
  req,
  res,
) => {
  sendSuccess(res, await loginTeacher(req.body));
};

export const getCurrentTeacher: RequestHandler = (_req, res) => {
  const teacher: TeacherAccountDto = res.locals.teacher;
  sendSuccess(res, { teacher });
};
