import type { RequestHandler } from "express";
import type { SchoolLoginInput } from "../schemas/auth.schema.js";
import {
  loginHeadOffice,
  type HeadOfficeAccountDto,
} from "../services/head-office-auth.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const headOfficeLogin: RequestHandler<unknown, unknown, SchoolLoginInput> = async (
  req,
  res,
) => {
  sendSuccess(res, await loginHeadOffice(req.body));
};

export const getCurrentHeadOffice: RequestHandler = (_req, res) => {
  const office: HeadOfficeAccountDto = res.locals.headOffice;
  sendSuccess(res, { office });
};
