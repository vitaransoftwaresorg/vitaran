import type { RequestHandler } from "express";
import type {
  CreateHeadOfficeInput,
  HeadOfficeCodeAvailabilityQuery,
  UpdateHeadOfficeInput,
} from "../schemas/head-office.schema.js";
import * as headOfficeService from "../services/head-office.service.js";
import { sendSuccess } from "../utils/api-response.js";

type IdParams = { id: string };

export const listHeadOffices: RequestHandler = async (_req, res) => {
  sendSuccess(res, await headOfficeService.listHeadOffices());
};

export const getCodeAvailability: RequestHandler = async (req, res) => {
  const { code, excludeId } = req.query as unknown as HeadOfficeCodeAvailabilityQuery;
  sendSuccess(res, await headOfficeService.getCodeAvailability(code, excludeId));
};

export const getNextOfficeCode: RequestHandler = async (_req, res) => {
  sendSuccess(res, await headOfficeService.getNextOfficeCode());
};

export const getHeadOffice: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await headOfficeService.getHeadOffice(req.params.id));
};

export const createHeadOffice: RequestHandler = async (req, res) => {
  sendSuccess(res, await headOfficeService.createHeadOffice(req.body as CreateHeadOfficeInput), 201);
};

export const updateHeadOffice: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(
    res,
    await headOfficeService.updateHeadOffice(req.params.id, req.body as UpdateHeadOfficeInput),
  );
};

export const deleteHeadOffice: RequestHandler<IdParams> = async (req, res) => {
  await headOfficeService.deleteHeadOffice(req.params.id);
  res.status(204).end();
};
