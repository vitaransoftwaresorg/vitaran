import { Router } from "express";
import {
  deleteResultSet,
  getResultSet,
  getResultSheet,
  getResultSheetFile,
  getClassResultTemplate,
  getClassResultPdfFile,
  getSchoolClassResultPdf,
  getTeacherClassResultPdf,
  getRankCards,
  getResultStats,
  getSchoolResultSet,
  getSchoolResultSheet,
  getSchoolRankCards,
  getSchoolResultSheetFile,
  getTeacherResultSet,
  getTeacherResultSheet,
  getTeacherRankCards,
  getTeacherResultSheetFile,
  listResultSets,
  listSchoolResultSets,
  listTeacherResultSets,
  saveManualResultSheet,
  setResultSetPublished,
} from "../controllers/result.controller.js";
import { requireAdmin, requireSchool, requireTeacher } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  classResultTemplateQuerySchema,
  listResultSetsQuerySchema,
  manualResultSheetSchema,
  resultSetIdParamsSchema,
  resultSheetParamsSchema,
} from "../schemas/result.schema.js";
import { publishBodySchema } from "../schemas/publish.schema.js";

const validateId = validate(resultSetIdParamsSchema, "params");
const validateSheet = validate(resultSheetParamsSchema, "params");

export const resultRouter = Router();

resultRouter.use(requireAdmin);

resultRouter.get("/", validate(listResultSetsQuerySchema, "query"), listResultSets);
resultRouter.post("/manual", validate(manualResultSheetSchema), saveManualResultSheet);
resultRouter.get("/class-template", validate(classResultTemplateQuerySchema, "query"), getClassResultTemplate);
resultRouter.get("/stats", getResultStats);
resultRouter.get("/:id", validateId, getResultSet);
resultRouter.delete("/:id", validateId, deleteResultSet);
resultRouter.patch("/:id/publish", validateId, validate(publishBodySchema, "body"), setResultSetPublished);
resultRouter.get("/:id/classes/:classLevel", validateSheet, getResultSheet);
resultRouter.get("/:id/classes/:classLevel/file", validateSheet, getResultSheetFile);
resultRouter.get("/:id/classes/:classLevel/rank-cards", validateSheet, getRankCards);
resultRouter.get("/:id/classes/:classLevel/result-pdf", validateSheet, getClassResultPdfFile);

/** Results as seen by a signed-in school: only its own. */
export const schoolResultRouter = Router();

schoolResultRouter.use(requireSchool);

schoolResultRouter.get("/", listSchoolResultSets);
schoolResultRouter.get("/:id", validateId, getSchoolResultSet);
schoolResultRouter.get("/:id/classes/:classLevel", validateSheet, getSchoolResultSheet);
schoolResultRouter.get("/:id/classes/:classLevel/file", validateSheet, getSchoolResultSheetFile);
schoolResultRouter.get("/:id/classes/:classLevel/rank-cards", validateSheet, getSchoolRankCards);
schoolResultRouter.get("/:id/classes/:classLevel/result-pdf", validateSheet, getSchoolClassResultPdf);

/** Results as seen by a signed-in teacher (class-scoped). */
export const teacherResultRouter = Router();

teacherResultRouter.use(requireTeacher);

teacherResultRouter.get("/", listTeacherResultSets);
teacherResultRouter.get("/:id", validateId, getTeacherResultSet);
teacherResultRouter.get("/:id/classes/:classLevel", validateSheet, getTeacherResultSheet);
teacherResultRouter.get("/:id/classes/:classLevel/file", validateSheet, getTeacherResultSheetFile);
teacherResultRouter.get("/:id/classes/:classLevel/rank-cards", validateSheet, getTeacherRankCards);
teacherResultRouter.get("/:id/classes/:classLevel/result-pdf", validateSheet, getTeacherClassResultPdf);

