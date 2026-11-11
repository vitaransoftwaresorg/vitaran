import { Router } from "express";
import { z } from "zod";
import {
  createAdminSchoolSection,
  createSchoolSection,
  deleteAdminSchoolSection,
  deleteSchoolSection,
  deleteSchoolWholeClass,
  getAdminSchoolSectionStrength,
  getSchoolSectionStrength,
  listAdminSchoolSections,
  listSchoolClassOrganization,
  listSchoolSections,
  updateAdminSchoolSection,
  updateSchoolSection,
  updateSchoolWholeClass,
} from "../controllers/section.controller.js";
import { requireAdmin, requireSchool } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createSectionSchema,
  sectionIdParamsSchema,
  updateSchoolClassSchema,
  updateSectionSchema,
} from "../schemas/section.schema.js";

const schoolIdParams = z.object({ schoolId: z.uuid() });
const schoolSectionParams = z.object({ schoolId: z.uuid(), id: z.uuid() });

/** School portal: /school/sections */
export const schoolSectionRouter = Router();
schoolSectionRouter.use(requireSchool);
schoolSectionRouter.get("/", listSchoolSections);
schoolSectionRouter.get("/organization", listSchoolClassOrganization);
schoolSectionRouter.get("/strength", getSchoolSectionStrength);
schoolSectionRouter.post("/", validate(createSectionSchema), createSchoolSection);
schoolSectionRouter.patch(
  "/classes/:id",
  validate(sectionIdParamsSchema, "params"),
  validate(updateSchoolClassSchema),
  updateSchoolWholeClass,
);
schoolSectionRouter.delete(
  "/classes/:id",
  validate(sectionIdParamsSchema, "params"),
  deleteSchoolWholeClass,
);
schoolSectionRouter.patch(
  "/:id",
  validate(sectionIdParamsSchema, "params"),
  validate(updateSectionSchema),
  updateSchoolSection,
);
schoolSectionRouter.delete(
  "/:id",
  validate(sectionIdParamsSchema, "params"),
  deleteSchoolSection,
);

/** Admin: /schools/:schoolId/sections */
export const adminSchoolSectionRouter = Router({ mergeParams: true });
adminSchoolSectionRouter.use(requireAdmin);
adminSchoolSectionRouter.get(
  "/",
  validate(schoolIdParams, "params"),
  listAdminSchoolSections,
);
adminSchoolSectionRouter.get(
  "/strength",
  validate(schoolIdParams, "params"),
  getAdminSchoolSectionStrength,
);
adminSchoolSectionRouter.post(
  "/",
  validate(schoolIdParams, "params"),
  validate(createSectionSchema),
  createAdminSchoolSection,
);
adminSchoolSectionRouter.patch(
  "/:id",
  validate(schoolSectionParams, "params"),
  validate(updateSectionSchema),
  updateAdminSchoolSection,
);
adminSchoolSectionRouter.delete(
  "/:id",
  validate(schoolSectionParams, "params"),
  deleteAdminSchoolSection,
);
