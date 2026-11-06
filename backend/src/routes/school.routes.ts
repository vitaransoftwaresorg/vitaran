import { Router } from "express";
import multer from "multer";
import {
  createSchool,
  deleteSchool,
  deleteSchoolLogo,
  getAccountAvailability,
  getSchool,
  getSchoolLogo,
  getSchoolStats,
  listSchoolOptions,
  listSchools,
  resetSchoolPassword,
  sendSchoolCredentials,
  updateSchool,
  uploadSchoolLogo,
} from "../controllers/school.controller.js";
import { requireAdmin } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  accountAvailabilityQuerySchema,
  createSchoolSchema,
  listSchoolOptionsQuerySchema,
  listSchoolsQuerySchema,
  resetSchoolPasswordSchema,
  schoolIdParamsSchema,
  updateSchoolSchema,
} from "../schemas/school.schema.js";

const readLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
}).single("logo");

export const schoolRouter = Router();

schoolRouter.use(requireAdmin);

schoolRouter.get("/", validate(listSchoolsQuerySchema, "query"), listSchools);
schoolRouter.get("/stats", getSchoolStats);
schoolRouter.get(
  "/options",
  validate(listSchoolOptionsQuerySchema, "query"),
  listSchoolOptions,
);
schoolRouter.get(
  "/account-availability",
  validate(accountAvailabilityQuerySchema, "query"),
  getAccountAvailability,
);
schoolRouter.post("/", validate(createSchoolSchema), createSchool);
schoolRouter.get("/:id", validate(schoolIdParamsSchema, "params"), getSchool);
schoolRouter.patch(
  "/:id",
  validate(schoolIdParamsSchema, "params"),
  validate(updateSchoolSchema),
  updateSchool,
);
schoolRouter.put(
  "/:id/logo",
  validate(schoolIdParamsSchema, "params"),
  readLogo,
  uploadSchoolLogo,
);
schoolRouter.get(
  "/:id/logo",
  validate(schoolIdParamsSchema, "params"),
  getSchoolLogo,
);
schoolRouter.delete(
  "/:id/logo",
  validate(schoolIdParamsSchema, "params"),
  deleteSchoolLogo,
);
schoolRouter.post(
  "/:id/send-credentials",
  validate(schoolIdParamsSchema, "params"),
  sendSchoolCredentials,
);
schoolRouter.post(
  "/:id/reset-password",
  validate(schoolIdParamsSchema, "params"),
  validate(resetSchoolPasswordSchema),
  resetSchoolPassword,
);
schoolRouter.delete(
  "/:id",
  validate(schoolIdParamsSchema, "params"),
  deleteSchool,
);
