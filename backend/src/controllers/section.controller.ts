import type { RequestHandler } from "express";
import type {
  CreateSectionInput,
  UpdateSchoolClassInput,
  UpdateSectionInput,
} from "../schemas/section.schema.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import * as sectionService from "../services/section.service.js";
import { sendSuccess } from "../utils/api-response.js";

type SectionIdParams = { id: string };
type SchoolSectionParams = { schoolId: string; id: string };

export const listSchoolSections: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await sectionService.listSections(school.id));
};

export const listSchoolClassOrganization: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await sectionService.listClassOrganization(school.id));
};

export const getSchoolSectionStrength: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await sectionService.getStrengthBudget(school.id));
};

export const createSchoolSection: RequestHandler = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await sectionService.createSection(school.id, req.body as CreateSectionInput), 201);
};

export const updateSchoolSection: RequestHandler<SectionIdParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(
    res,
    await sectionService.updateSection(school.id, req.params.id, req.body as UpdateSectionInput),
  );
};

export const deleteSchoolSection: RequestHandler<SectionIdParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  await sectionService.deleteSection(school.id, req.params.id);
  res.status(204).end();
};

export const updateSchoolWholeClass: RequestHandler<SectionIdParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(
    res,
    await sectionService.updateSchoolClass(
      school.id,
      req.params.id,
      req.body as UpdateSchoolClassInput,
    ),
  );
};

export const deleteSchoolWholeClass: RequestHandler<SectionIdParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  await sectionService.deleteSchoolClass(school.id, req.params.id);
  res.status(204).end();
};

export const listAdminSchoolSections: RequestHandler<{ schoolId: string }> = async (req, res) => {
  sendSuccess(res, await sectionService.listClassOrganization(req.params.schoolId));
};

export const getAdminSchoolSectionStrength: RequestHandler<{ schoolId: string }> = async (
  req,
  res,
) => {
  sendSuccess(res, await sectionService.getStrengthBudget(req.params.schoolId));
};

export const createAdminSchoolSection: RequestHandler<{ schoolId: string }> = async (req, res) => {
  sendSuccess(
    res,
    await sectionService.createSection(req.params.schoolId, req.body as CreateSectionInput),
    201,
  );
};

export const updateAdminSchoolSection: RequestHandler<SchoolSectionParams> = async (req, res) => {
  sendSuccess(
    res,
    await sectionService.updateSection(
      req.params.schoolId,
      req.params.id,
      req.body as UpdateSectionInput,
    ),
  );
};

export const deleteAdminSchoolSection: RequestHandler<SchoolSectionParams> = async (req, res) => {
  await sectionService.deleteSection(req.params.schoolId, req.params.id);
  res.status(204).end();
};
