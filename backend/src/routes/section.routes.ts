import { Router } from "express";
import { z } from "zod";
import {
  createAdminSchoolSection,
  deleteAdminSchoolSection,
  getAdminSchoolSectionStrength,
  getSchoolSectionStrength,
  listAdminSchoolSections,
  listSchoolClassOrganization,
  listSchoolSections,
  updateAdminSchoolSection,
  updateAdminSchoolWholeClass,
} from "../controllers/section.controller.js";
import { requireAdmin, requireSchool } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createSectionSchema,
  updateSchoolClassSchema,
  updateSectionSchema,
} from "../schemas/section.schema.js";

const schoolIdParams = z.object({ schoolId: z.uuid() });
const schoolSectionParams = z.object({ schoolId: z.uuid(), id: z.uuid() });

/**
 * School portal: /school/sections — view only.
 * Creating/updating/deleting classes & sections is admin-only.
 * Class-teacher assignment stays on /school/teachers/class-teacher.
 */
export const schoolSectionRouter = Router();
schoolSectionRouter.use(requireSchool);
schoolSectionRouter.get("/", listSchoolSections);
schoolSectionRouter.get("/organization", listSchoolClassOrganization);
schoolSectionRouter.get("/strength", getSchoolSectionStrength);

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
  "/classes/:id",
  validate(schoolSectionParams, "params"),
  validate(updateSchoolClassSchema),
  updateAdminSchoolWholeClass,
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
