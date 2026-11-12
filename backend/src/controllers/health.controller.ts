import type { RequestHandler } from "express";
import { getHealthStatus } from "../services/health.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const getHealth: RequestHandler = async (_req, res) => {
  const health = await getHealthStatus();
  sendSuccess(res, health, health.status === "ok" ? 200 : 503);
};
