import type { RequestHandler } from "express";
import * as dashboardService from "../services/dashboard.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const getAdminDashboard: RequestHandler = async (_req, res) => {
  sendSuccess(res, await dashboardService.getAdminDashboard());
};
