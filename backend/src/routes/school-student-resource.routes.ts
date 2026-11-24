import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import {
  deleteAdminSchoolStudentResource,
  getAdminSchoolStudentResourceFile,
  getSchoolPortalStudentResourceFile,
  getTeacherPortalStudentResourceFile,
  listAdminSchoolStudentResources,
  listSchoolPortalStudentResources,
  listTeacherPortalStudentResources,
  uploadAdminSchoolStudentResource,
} from "../controllers/school-student-resource.controller.js";
import { requireAdmin, requireSchool, requireTeacher } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";

const schoolIdParams = z.object({ id: z.uuid() });
const slotParams = z.object({
  id: z.uuid(),
  programCode: z.string().trim().min(2).max(64),
  classLevel: z.coerce.number().int().min(1).max(10),
  subject: z.string().trim().min(2).max(64),
});
const portalSlotParams = z.object({
  programCode: z.string().trim().min(2).max(64),
  classLevel: z.coerce.number().int().min(1).max(10),
  subject: z.string().trim().min(2).max(64),
});

const readPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
}).single("file");

/** Admin: /schools/:id/student-resources */
export const adminSchoolStudentResourceRouter = Router({ mergeParams: true });
adminSchoolStudentResourceRouter.use(requireAdmin);
adminSchoolStudentResourceRouter.get(
  "/",
  validate(schoolIdParams, "params"),
  listAdminSchoolStudentResources,
);
adminSchoolStudentResourceRouter.put(
  "/",
  validate(schoolIdParams, "params"),
  readPdf,
  uploadAdminSchoolStudentResource,
);
adminSchoolStudentResourceRouter.get(
  "/:programCode/:classLevel/:subject",
  validate(slotParams, "params"),
  getAdminSchoolStudentResourceFile,
);
adminSchoolStudentResourceRouter.delete(
  "/:programCode/:classLevel/:subject",
  validate(slotParams, "params"),
  deleteAdminSchoolStudentResource,
);

/** School portal: /school/student-resources */
export const schoolStudentResourceRouter = Router();
schoolStudentResourceRouter.use(requireSchool);
schoolStudentResourceRouter.get("/", listSchoolPortalStudentResources);
schoolStudentResourceRouter.get(
  "/:programCode/:classLevel/:subject",
  validate(portalSlotParams, "params"),
  getSchoolPortalStudentResourceFile,
);

/** Teacher portal: /teacher/student-resources (customized school PDFs) */
export const teacherStudentResourceRouter = Router();
teacherStudentResourceRouter.use(requireTeacher);
teacherStudentResourceRouter.get("/", listTeacherPortalStudentResources);
teacherStudentResourceRouter.get(
  "/:programCode/:classLevel/:subject",
  validate(portalSlotParams, "params"),
  getTeacherPortalStudentResourceFile,
);
