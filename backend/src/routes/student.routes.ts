import { Router } from "express";
import { z } from "zod";
import { getTeacherDashboard } from "../controllers/portal.controller.js";
import {
  createAdminSchoolStudent,
  createAdminSchoolStudentsBulk,
  createStudent,
  createStudentsBulk,
  deleteAdminSchoolStudent,
  deleteAdminStudent,
  deleteStudent,
  getAdminSchoolStudent,
  getAdminStudent,
  getAdminStudentPerformance,
  getStudent,
  getStudentPerformance,
  getTeacherStudent,
  getTeacherStudentPerformance,
  getAdminSchoolStudentCounts,
  getSchoolStudentCounts,
  listAdminSchoolStudents,
  listAdminStudents,
  listStudents,
  listTeacherStudents,
  setStudentStatus,
  updateAdminSchoolStudent,
  updateAdminStudent,
  updateStudent,
} from "../controllers/student.controller.js";
import { requireAdmin, requireSchool, requireTeacher } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createStudentSchema,
  createStudentsBulkSchema,
  listStudentsQuerySchema,
  setStudentStatusSchema,
  studentIdParamsSchema,
  updateStudentSchema,
} from "../schemas/student.schema.js";

const validateStudentId = validate(studentIdParamsSchema, "params");
const schoolIdParams = z.object({ schoolId: z.uuid() });
const schoolStudentParams = z.object({ schoolId: z.uuid(), id: z.uuid() });

/** School portal: manage this school's students. */
export const schoolStudentRouter = Router();
schoolStudentRouter.use(requireSchool);
schoolStudentRouter.get("/counts", getSchoolStudentCounts);
schoolStudentRouter.get("/", validate(listStudentsQuerySchema, "query"), listStudents);
schoolStudentRouter.post("/", validate(createStudentSchema), createStudent);
schoolStudentRouter.post("/bulk", validate(createStudentsBulkSchema), createStudentsBulk);
schoolStudentRouter.get("/:id", validateStudentId, getStudent);
schoolStudentRouter.get("/:id/performance", validateStudentId, getStudentPerformance);
schoolStudentRouter.patch("/:id", validateStudentId, validate(updateStudentSchema), updateStudent);
schoolStudentRouter.patch(
  "/:id/status",
  validateStudentId,
  validate(setStudentStatusSchema),
  setStudentStatus,
);
schoolStudentRouter.delete("/:id", validateStudentId, deleteStudent);

/** Admin: students under a school. */
export const adminSchoolStudentRouter = Router({ mergeParams: true });
adminSchoolStudentRouter.use(requireAdmin);
adminSchoolStudentRouter.get(
  "/counts",
  validate(schoolIdParams, "params"),
  getAdminSchoolStudentCounts,
);
adminSchoolStudentRouter.get(
  "/",
  validate(schoolIdParams, "params"),
  validate(listStudentsQuerySchema, "query"),
  listAdminSchoolStudents,
);
adminSchoolStudentRouter.post(
  "/",
  validate(schoolIdParams, "params"),
  validate(createStudentSchema),
  createAdminSchoolStudent,
);
adminSchoolStudentRouter.post(
  "/bulk",
  validate(schoolIdParams, "params"),
  validate(createStudentsBulkSchema),
  createAdminSchoolStudentsBulk,
);
adminSchoolStudentRouter.get(
  "/:id",
  validate(schoolStudentParams, "params"),
  getAdminSchoolStudent,
);
adminSchoolStudentRouter.patch(
  "/:id",
  validate(schoolStudentParams, "params"),
  validate(updateStudentSchema),
  updateAdminSchoolStudent,
);
adminSchoolStudentRouter.delete(
  "/:id",
  validate(schoolStudentParams, "params"),
  deleteAdminSchoolStudent,
);

/** Admin: flat student routes (short URLs — no school id in path). */
export const adminStudentRouter = Router();
adminStudentRouter.use(requireAdmin);
adminStudentRouter.get("/", validate(listStudentsQuerySchema, "query"), listAdminStudents);
adminStudentRouter.get("/:id", validateStudentId, getAdminStudent);
adminStudentRouter.get("/:id/performance", validateStudentId, getAdminStudentPerformance);
adminStudentRouter.patch("/:id", validateStudentId, validate(updateStudentSchema), updateAdminStudent);
adminStudentRouter.delete("/:id", validateStudentId, deleteAdminStudent);

/** Teacher portal: roster for assigned / class-teacher classes. */
export const teacherStudentRouter = Router();
teacherStudentRouter.use(requireTeacher);
teacherStudentRouter.get("/dashboard", getTeacherDashboard);
teacherStudentRouter.get("/", validate(listStudentsQuerySchema, "query"), listTeacherStudents);
teacherStudentRouter.get("/:id", validateStudentId, getTeacherStudent);
teacherStudentRouter.get("/:id/performance", validateStudentId, getTeacherStudentPerformance);
