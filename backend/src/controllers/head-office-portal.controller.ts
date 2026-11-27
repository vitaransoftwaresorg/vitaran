import type { RequestHandler } from "express";
import type { HeadOfficeAccountDto } from "../services/head-office-auth.service.js";
import * as headOfficePortalService from "../services/head-office-portal.service.js";
import { sendSuccess } from "../utils/api-response.js";

function officeId(res: { locals: Record<string, unknown> }) {
  return (res.locals.headOffice as HeadOfficeAccountDto).id;
}

export const getPortalDashboard: RequestHandler = async (_req, res) => {
  sendSuccess(res, await headOfficePortalService.getPortalDashboard(officeId(res)));
};

export const listPortalSchools: RequestHandler = async (_req, res) => {
  sendSuccess(res, await headOfficePortalService.listPortalSchools(officeId(res)));
};

export const getPortalSchool: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await headOfficePortalService.getPortalSchool(officeId(res), req.params.id as string),
  );
};

export const assumePortalSchool: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await headOfficePortalService.assumePortalSchool(officeId(res), req.params.id as string),
  );
};

export const sendPortalSchoolCredentials: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await headOfficePortalService.sendPortalSchoolCredentials(
      officeId(res),
      req.params.id as string,
    ),
  );
};

export const resetPortalSchoolPassword: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await headOfficePortalService.resetPortalSchoolPassword(
      officeId(res),
      req.params.id as string,
      (req.body as { password: string }).password,
    ),
  );
};

export const updatePortalSchoolLoginEmail: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await headOfficePortalService.updatePortalSchoolLoginEmail(
      officeId(res),
      req.params.id as string,
      (req.body as { accountEmail: string }).accountEmail,
    ),
  );
};
