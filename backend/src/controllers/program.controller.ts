import type { RequestHandler } from "express";
import type {
  CreateProgramInput,
  ProgramCodeAvailabilityQuery,
  UpdateProgramInput,
} from "../schemas/program.schema.js";
import * as programService from "../services/program.service.js";
import { sendSuccess } from "../utils/api-response.js";

type IdParams = { id: string };

export const listPrograms: RequestHandler = async (_req, res) => {
  sendSuccess(res, await programService.listPrograms());
};

export const getCodeAvailability: RequestHandler = async (req, res) => {
  const { code, excludeId } = req.query as unknown as ProgramCodeAvailabilityQuery;
  sendSuccess(res, await programService.getCodeAvailability(code, excludeId));
};

export const getProgram: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await programService.getProgram(req.params.id));
};

export const createProgram: RequestHandler = async (req, res) => {
  sendSuccess(res, await programService.createProgram(req.body as CreateProgramInput), 201);
};

export const updateProgram: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await programService.updateProgram(req.params.id, req.body as UpdateProgramInput));
};

export const deleteProgram: RequestHandler<IdParams> = async (req, res) => {
  await programService.deleteProgram(req.params.id);
  res.status(204).end();
};
