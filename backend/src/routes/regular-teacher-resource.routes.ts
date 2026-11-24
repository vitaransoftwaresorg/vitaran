import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import {
  deleteAdminRegularTeacherResource,
  getAdminRegularTeacherResourceFile,
  getPublicRegularTeacherResourceFile,
  listAdminRegularTeacherResources,
  listPublicRegularTeacherResources,
  uploadAdminRegularTeacherResource,
} from "../controllers/regular-teacher-resource.controller.js";
import { requireAdmin } from "../middleware/authenticate.js";
import { optionalAnyAuth } from "../middleware/optional-auth.js";
import { validate } from "../middleware/validate.js";

const slotParams = z.object({
  programCode: z.string().trim().min(2).max(64),
  classLevel: z.coerce.number().int().min(1).max(12),
  subject: z.string().trim().min(2).max(64),
});

const readPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 1 },
}).single("file");

/** Admin: /admin/teacher-resources */
export const adminRegularTeacherResourceRouter = Router();
adminRegularTeacherResourceRouter.use(requireAdmin);
adminRegularTeacherResourceRouter.get("/", listAdminRegularTeacherResources);
adminRegularTeacherResourceRouter.put("/", readPdf, uploadAdminRegularTeacherResource);
adminRegularTeacherResourceRouter.get(
  "/:programCode/:classLevel/:subject",
  validate(slotParams, "params"),
  getAdminRegularTeacherResourceFile,
);
adminRegularTeacherResourceRouter.delete(
  "/:programCode/:classLevel/:subject",
  validate(slotParams, "params"),
  deleteAdminRegularTeacherResource,
);

/** Public / portal: /public/teacher-resources (optional bearer → private access) */
export const publicRegularTeacherResourceRouter = Router();
publicRegularTeacherResourceRouter.use(optionalAnyAuth);
publicRegularTeacherResourceRouter.get("/", listPublicRegularTeacherResources);
publicRegularTeacherResourceRouter.get(
  "/:programCode/:classLevel/:subject",
  validate(slotParams, "params"),
  getPublicRegularTeacherResourceFile,
);
