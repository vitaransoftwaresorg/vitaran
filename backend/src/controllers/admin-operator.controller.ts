import type { RequestHandler } from "express";
import type {
  CreateAdminOperatorInput,
  UpdateAdminOperatorInput,
} from "../schemas/admin-operator.schema.js";
import type { AdminProfile } from "../services/auth.service.js";
import * as adminOperatorService from "../services/admin-operator.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const listAdminOperators: RequestHandler = async (_req, res) => {
  sendSuccess(res, await adminOperatorService.listOperators());
};

export const createAdminOperator: RequestHandler<
  unknown,
  unknown,
  CreateAdminOperatorInput
> = async (req, res) => {
  sendSuccess(res, await adminOperatorService.createOperator(req.body), 201);
};

export const updateAdminOperator: RequestHandler<
  { id: string },
  unknown,
  UpdateAdminOperatorInput
> = async (req, res) => {
  const actor = res.locals.admin as AdminProfile;
  sendSuccess(res, await adminOperatorService.updateOperator(req.params.id, req.body, actor));
};

export const deleteAdminOperator: RequestHandler<{ id: string }> = async (req, res) => {
  const actor = res.locals.admin as AdminProfile;
  sendSuccess(res, await adminOperatorService.deleteOperator(req.params.id, actor));
};
