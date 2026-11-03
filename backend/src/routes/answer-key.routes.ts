import { Router } from "express";
import {
  deleteAnswerKey,
  getAnswerKey,
  getAnswerKeyFile,
  getAnswerKeyStats,
  getSchoolAnswerKey,
  getSchoolAnswerKeyFile,
  getTeacherAnswerKey,
  getTeacherAnswerKeyFile,
  listAnswerKeys,
  listSchoolAnswerKeys,
  listSchoolTests,
  listTeacherAnswerKeys,
  reparseAnswerKey,
  saveAnswerKeyAnswers,
  setAnswerKeyPublished,
  setAnswerKeyTestId,
  updateAnswerKey,
  uploadAnswerKey,
} from "../controllers/answer-key.controller.js";
import { requireAdmin, requireSchool, requireTeacher } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  answerKeyIdParamsSchema,
  listAnswerKeysQuerySchema,
  saveAnswerKeyAnswersSchema,
  schoolTestsQuerySchema,
  setAnswerKeyTestIdSchema,
  updateAnswerKeyQuerySchema,
  uploadAnswerKeyQuerySchema,
} from "../schemas/answer-key.schema.js";
import { publishBodySchema } from "../schemas/publish.schema.js";
import { readPdfBody } from "../utils/pdf.js";

const validateId = validate(answerKeyIdParamsSchema, "params");

export const answerKeyRouter = Router();

answerKeyRouter.use(requireAdmin);

answerKeyRouter.get("/", validate(listAnswerKeysQuerySchema, "query"), listAnswerKeys);
answerKeyRouter.post("/", validate(uploadAnswerKeyQuerySchema, "query"), readPdfBody, uploadAnswerKey);
answerKeyRouter.get("/stats", getAnswerKeyStats);
answerKeyRouter.get("/school-tests", validate(schoolTestsQuerySchema, "query"), listSchoolTests);
answerKeyRouter.get("/:id", validateId, getAnswerKey);
answerKeyRouter.patch(
  "/:id/test-id",
  validateId,
  validate(setAnswerKeyTestIdSchema),
  setAnswerKeyTestId,
);
answerKeyRouter.patch(
  "/:id/answers",
  validateId,
  validate(saveAnswerKeyAnswersSchema),
  saveAnswerKeyAnswers,
);
answerKeyRouter.post("/:id/parse", validateId, reparseAnswerKey);
answerKeyRouter.patch(
  "/:id",
  validateId,
  validate(updateAnswerKeyQuerySchema, "query"),
  readPdfBody,
  updateAnswerKey,
);
answerKeyRouter.patch("/:id/publish", validateId, validate(publishBodySchema, "body"), setAnswerKeyPublished);
answerKeyRouter.get("/:id/file", validateId, getAnswerKeyFile);
answerKeyRouter.delete("/:id", validateId, deleteAnswerKey);

/** Answer keys as seen by a signed-in school. */
export const schoolAnswerKeyRouter = Router();

schoolAnswerKeyRouter.use(requireSchool);

schoolAnswerKeyRouter.get("/", listSchoolAnswerKeys);
schoolAnswerKeyRouter.get("/:id", validateId, getSchoolAnswerKey);
schoolAnswerKeyRouter.get("/:id/file", validateId, getSchoolAnswerKeyFile);

/** Answer keys as seen by a signed-in teacher (class-scoped). */
export const teacherAnswerKeyRouter = Router();

teacherAnswerKeyRouter.use(requireTeacher);

teacherAnswerKeyRouter.get("/", listTeacherAnswerKeys);
teacherAnswerKeyRouter.get("/:id", validateId, getTeacherAnswerKey);
teacherAnswerKeyRouter.get("/:id/file", validateId, getTeacherAnswerKeyFile);
