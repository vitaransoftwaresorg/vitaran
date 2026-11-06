import { Router } from "express";
import multer from "multer";
import {
  deleteResultSet,
  getResultSet,
  getResultSheet,
  getResultSheetFile,
  getClassResultTemplate,
  getRankCards,
  getResultStats,
  getSchoolResultSet,
  getSchoolResultSheet,
  getSchoolResultSheetFile,
  getTeacherResultSet,
  getTeacherResultSheet,
  getTeacherResultSheetFile,
  listResultSets,
  listSchoolResultSets,
  listTeacherResultSets,
  saveManualResultSheet,
  setResultSetPublished,
  updateResultSet,
  uploadResultSet,
} from "../controllers/result.controller.js";
import { requireAdmin, requireSchool, requireTeacher } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  CLASS_LEVELS,
  classFileField,
  classResultTemplateQuerySchema,
  listResultSetsQuerySchema,
  manualResultSheetSchema,
  resultSetFieldsSchema,
  resultSetIdParamsSchema,
  resultSheetParamsSchema,
} from "../schemas/result.schema.js";
import { publishBodySchema } from "../schemas/publish.schema.js";
import { EXCEL_MAX_BYTES } from "../utils/excel.js";

const validateId = validate(resultSetIdParamsSchema, "params");
const validateSheet = validate(resultSheetParamsSchema, "params");

/** One optional .xlsx per class, kept in memory: the parsed rows and the file go to the database. */
const readClassFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EXCEL_MAX_BYTES, files: CLASS_LEVELS.length, fields: 10 },
}).fields(CLASS_LEVELS.map((level) => ({ name: classFileField(level), maxCount: 1 })));

const validateFields = validate(resultSetFieldsSchema, "body");

export const resultRouter = Router();

resultRouter.use(requireAdmin);

resultRouter.get("/", validate(listResultSetsQuerySchema, "query"), listResultSets);
resultRouter.post("/", readClassFiles, validateFields, uploadResultSet);
resultRouter.post("/manual", validate(manualResultSheetSchema), saveManualResultSheet);
resultRouter.get("/class-template", validate(classResultTemplateQuerySchema, "query"), getClassResultTemplate);
resultRouter.get("/stats", getResultStats);
resultRouter.get("/:id", validateId, getResultSet);
resultRouter.patch("/:id", validateId, readClassFiles, validateFields, updateResultSet);
resultRouter.delete("/:id", validateId, deleteResultSet);
resultRouter.patch("/:id/publish", validateId, validate(publishBodySchema, "body"), setResultSetPublished);
resultRouter.get("/:id/classes/:classLevel", validateSheet, getResultSheet);
resultRouter.get("/:id/classes/:classLevel/file", validateSheet, getResultSheetFile);
resultRouter.get("/:id/classes/:classLevel/rank-cards", validateSheet, getRankCards);

/** Results as seen by a signed-in school: only its own. */
export const schoolResultRouter = Router();

schoolResultRouter.use(requireSchool);

schoolResultRouter.get("/", listSchoolResultSets);
schoolResultRouter.get("/:id", validateId, getSchoolResultSet);
schoolResultRouter.get("/:id/classes/:classLevel", validateSheet, getSchoolResultSheet);
schoolResultRouter.get("/:id/classes/:classLevel/file", validateSheet, getSchoolResultSheetFile);

/** Results as seen by a signed-in teacher (class-scoped). */
export const teacherResultRouter = Router();

teacherResultRouter.use(requireTeacher);

teacherResultRouter.get("/", listTeacherResultSets);
teacherResultRouter.get("/:id", validateId, getTeacherResultSet);
teacherResultRouter.get("/:id/classes/:classLevel", validateSheet, getTeacherResultSheet);
teacherResultRouter.get("/:id/classes/:classLevel/file", validateSheet, getTeacherResultSheetFile);

