import { Router } from "express";
import multer from "multer";
import {
  checkAnswerKeyTestId,
  deleteAnswerKey,
  getAnswerKey,
  getAnswerKeyStats,
  getSchoolAnswerKey,
  getSchoolAnswerKeyPdf,
  getTeacherAnswerKey,
  getTeacherAnswerKeyPdf,
  listAnswerKeys,
  listSchoolAnswerKeys,
  listSchoolTests,
  listTeacherAnswerKeys,
  saveAnswerKeyAnswers,
  setAnswerKeyPublished,
  setAnswerKeyTestId,
  updateAnswerKey,
  uploadAnswerKey,
} from "../controllers/answer-key.controller.js";
import {
  countOpenObjections,
  getAdminObjection,
  getAdminObjectionImage,
  getSchoolObjectionImage,
  getTeacherObjectionImage,
  listAdminObjections,
  listSchoolObjectionsForKey,
  listTeacherObjectionsForKey,
  raiseSchoolObjection,
  raiseTeacherObjection,
  resolveAdminObjection,
} from "../controllers/answer-key-objection.controller.js";
import { requireAdmin, requireSchool, requireTeacher } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  answerKeyIdParamsSchema,
  checkTestIdQuerySchema,
  listAnswerKeysQuerySchema,
  saveAnswerKeyAnswersSchema,
  schoolTestsQuerySchema,
  setAnswerKeyTestIdSchema,
  updateAnswerKeyQuerySchema,
  uploadAnswerKeyQuerySchema,
} from "../schemas/answer-key.schema.js";
import {
  answerKeyObjectionIdParamsSchema,
  listAnswerKeyObjectionsQuerySchema,
  raiseAnswerKeyObjectionSchema,
  resolveAnswerKeyObjectionSchema,
} from "../schemas/answer-key-objection.schema.js";
import { publishBodySchema } from "../schemas/publish.schema.js";

const validateId = validate(answerKeyIdParamsSchema, "params");
const validateObjectionId = validate(answerKeyObjectionIdParamsSchema, "params");

/** Optional photo on a raised objection (phone camera or laptop upload). */
const readObjectionImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 10 },
}).single("image");

export const answerKeyRouter = Router();

answerKeyRouter.use(requireAdmin);

answerKeyRouter.get("/", validate(listAnswerKeysQuerySchema, "query"), listAnswerKeys);
answerKeyRouter.post("/", validate(uploadAnswerKeyQuerySchema, "query"), uploadAnswerKey);
answerKeyRouter.get("/stats", getAnswerKeyStats);
answerKeyRouter.get("/test-id/check", validate(checkTestIdQuerySchema, "query"), checkAnswerKeyTestId);
answerKeyRouter.get("/school-tests", validate(schoolTestsQuerySchema, "query"), listSchoolTests);
answerKeyRouter.get(
  "/objections",
  validate(listAnswerKeyObjectionsQuerySchema, "query"),
  listAdminObjections,
);
answerKeyRouter.get("/objections/open-count", countOpenObjections);
answerKeyRouter.get("/objections/:id", validateObjectionId, getAdminObjection);
answerKeyRouter.get("/objections/:id/image", validateObjectionId, getAdminObjectionImage);
answerKeyRouter.patch(
  "/objections/:id",
  validateObjectionId,
  validate(resolveAnswerKeyObjectionSchema),
  resolveAdminObjection,
);
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
answerKeyRouter.patch(
  "/:id",
  validateId,
  validate(updateAnswerKeyQuerySchema, "query"),
  updateAnswerKey,
);
answerKeyRouter.patch("/:id/publish", validateId, validate(publishBodySchema, "body"), setAnswerKeyPublished);
answerKeyRouter.delete("/:id", validateId, deleteAnswerKey);

/** Answer keys as seen by a signed-in school. */
export const schoolAnswerKeyRouter = Router();

schoolAnswerKeyRouter.use(requireSchool);

schoolAnswerKeyRouter.get("/", listSchoolAnswerKeys);
schoolAnswerKeyRouter.get("/:id", validateId, getSchoolAnswerKey);
schoolAnswerKeyRouter.get("/:id/pdf", validateId, getSchoolAnswerKeyPdf);
schoolAnswerKeyRouter.get("/objections/:id/image", validateObjectionId, getSchoolObjectionImage);
schoolAnswerKeyRouter.get("/:id/objections", validateId, listSchoolObjectionsForKey);
schoolAnswerKeyRouter.post(
  "/:id/objections",
  validateId,
  readObjectionImage,
  validate(raiseAnswerKeyObjectionSchema),
  raiseSchoolObjection,
);

/** Answer keys as seen by a signed-in teacher (class-scoped). */
export const teacherAnswerKeyRouter = Router();

teacherAnswerKeyRouter.use(requireTeacher);

teacherAnswerKeyRouter.get("/", listTeacherAnswerKeys);
teacherAnswerKeyRouter.get("/:id", validateId, getTeacherAnswerKey);
teacherAnswerKeyRouter.get("/:id/pdf", validateId, getTeacherAnswerKeyPdf);
teacherAnswerKeyRouter.get("/objections/:id/image", validateObjectionId, getTeacherObjectionImage);
teacherAnswerKeyRouter.get("/:id/objections", validateId, listTeacherObjectionsForKey);
teacherAnswerKeyRouter.post(
  "/:id/objections",
  validateId,
  readObjectionImage,
  validate(raiseAnswerKeyObjectionSchema),
  raiseTeacherObjection,
);
