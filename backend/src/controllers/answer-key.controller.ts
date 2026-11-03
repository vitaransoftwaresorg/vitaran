import type { RequestHandler } from "express";
import type {
  ListAnswerKeysQuery,
  SaveAnswerKeyAnswersInput,
  SchoolTestsQuery,
  SetAnswerKeyTestIdInput,
  UpdateAnswerKeyQuery,
  UploadAnswerKeyQuery,
} from "../schemas/answer-key.schema.js";
import type { PublishBody } from "../schemas/publish.schema.js";
import * as answerKeyService from "../services/answer-key.service.js";
import type { ContentActor } from "../services/content-access.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { sendPdf } from "../utils/pdf.js";

type IdParams = { id: string };

export const listAnswerKeys: RequestHandler = async (req, res) => {
  sendSuccess(res, await answerKeyService.listRecentAnswerKeys(req.query as unknown as ListAnswerKeysQuery));
};

export const listSchoolTests: RequestHandler = async (req, res) => {
  const { schoolId } = req.query as unknown as SchoolTestsQuery;
  sendSuccess(res, await answerKeyService.listSchoolTestsForResults(schoolId));
};

export const getAnswerKeyStats: RequestHandler = async (_req, res) => {
  sendSuccess(res, await answerKeyService.getAnswerKeyStats());
};

export const getAnswerKey: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await answerKeyService.getAnswerKey(req.params.id));
};

export const uploadAnswerKey: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await answerKeyService.uploadAnswerKey(req.query as unknown as UploadAnswerKeyQuery, req.body),
    201,
  );
};

export const updateAnswerKey: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(
    res,
    await answerKeyService.updateAnswerKey(
      req.params.id,
      req.query as unknown as UpdateAnswerKeyQuery,
      req.body,
    ),
  );
};

export const getAnswerKeyFile: RequestHandler<IdParams> = async (req, res) => {
  sendPdf(res, await answerKeyService.getAnswerKeyFile(req.params.id));
};

export const listSchoolAnswerKeys: RequestHandler = async (_req, res) => {
  sendSuccess(res, await answerKeyService.listSchoolAnswerKeys(res.locals.school as SchoolAccountDto));
};

export const getSchoolAnswerKey: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(
    res,
    await answerKeyService.getVisibleAnswerKey(req.params.id, {
      kind: "school",
      school: res.locals.school as SchoolAccountDto,
    }),
  );
};

export const getSchoolAnswerKeyFile: RequestHandler<IdParams> = async (req, res) => {
  sendPdf(
    res,
    await answerKeyService.getAnswerKeyFile(req.params.id, res.locals.school as SchoolAccountDto),
  );
};

export const listTeacherAnswerKeys: RequestHandler = async (_req, res) => {
  const actor: ContentActor = { kind: "teacher", teacher: res.locals.teacher as TeacherAccountDto };
  sendSuccess(res, await answerKeyService.listVisibleAnswerKeys(actor));
};

export const getTeacherAnswerKey: RequestHandler<IdParams> = async (req, res) => {
  const actor: ContentActor = { kind: "teacher", teacher: res.locals.teacher as TeacherAccountDto };
  sendSuccess(res, await answerKeyService.getVisibleAnswerKey(req.params.id, actor));
};

export const getTeacherAnswerKeyFile: RequestHandler<IdParams> = async (req, res) => {
  const actor: ContentActor = { kind: "teacher", teacher: res.locals.teacher as TeacherAccountDto };
  sendPdf(res, await answerKeyService.getAnswerKeyFile(req.params.id, actor));
};

export const setAnswerKeyPublished: RequestHandler<IdParams> = async (req, res) => {
  const { published } = req.body as PublishBody;
  sendSuccess(res, await answerKeyService.setAnswerKeyPublished(req.params.id, published));
};

export const deleteAnswerKey: RequestHandler<IdParams> = async (req, res) => {
  await answerKeyService.deleteAnswerKey(req.params.id);
  res.status(204).end();
};

export const setAnswerKeyTestId: RequestHandler<IdParams, unknown, SetAnswerKeyTestIdInput> = async (
  req,
  res,
) => {
  sendSuccess(res, await answerKeyService.setAnswerKeyTestId(req.params.id, req.body.testId));
};

export const saveAnswerKeyAnswers: RequestHandler<IdParams, unknown, SaveAnswerKeyAnswersInput> = async (
  req,
  res,
) => {
  sendSuccess(res, await answerKeyService.saveAnswerKeyAnswers(req.params.id, req.body));
};

export const reparseAnswerKey: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await answerKeyService.reparseAnswerKey(req.params.id));
};
