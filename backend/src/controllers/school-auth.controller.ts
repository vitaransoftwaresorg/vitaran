import type { RequestHandler } from "express";
import type { SchoolLoginInput } from "../schemas/auth.schema.js";
import { loginSchool } from "../services/school-auth.service.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const schoolLogin: RequestHandler<unknown, unknown, SchoolLoginInput> = async (
  req,
  res,
) => {
  sendSuccess(res, await loginSchool(req.body));
};

export const getCurrentSchool: RequestHandler = (_req, res) => {
  const school: SchoolAccountDto = res.locals.school;
  sendSuccess(res, { school });
};
