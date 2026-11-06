import type { RequestHandler, Response } from "express";
import type {
  ListAnswerKeyObjectionsQuery,
  RaiseAnswerKeyObjectionInput,
  ResolveAnswerKeyObjectionInput,
} from "../schemas/answer-key-objection.schema.js";
import * as objectionService from "../services/answer-key-objection.service.js";
import type { ContentActor } from "../services/content-access.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { sendSuccess } from "../utils/api-response.js";

type AnswerKeyIdParams = { id: string };
type ObjectionIdParams = { id: string };

export const raiseSchoolObjection: RequestHandler<
  AnswerKeyIdParams,
  unknown,
  RaiseAnswerKeyObjectionInput
> = async (req, res) => {
  const actor: ContentActor = {
    kind: "school",
    school: res.locals.school as SchoolAccountDto,
  };
  sendSuccess(res, await objectionService.raiseObjection(req.params.id, actor, req.body, req.file), 201);
};

function sendImage(res: Response, image: { data: Uint8Array; mimeType: string }) {
  res.setHeader("Content-Type", image.mimeType);
  res.setHeader("Content-Disposition", 'inline; filename="objection.jpg"');
  res.send(Buffer.from(image.data));
}

export const getAdminObjectionImage: RequestHandler<ObjectionIdParams> = async (req, res) => {
  sendImage(res, await objectionService.getObjectionImage(req.params.id));
};

export const getSchoolObjectionImage: RequestHandler<ObjectionIdParams> = async (req, res) => {
  const actor: ContentActor = { kind: "school", school: res.locals.school as SchoolAccountDto };
  sendImage(res, await objectionService.getObjectionImage(req.params.id, actor));
};

export const getTeacherObjectionImage: RequestHandler<ObjectionIdParams> = async (req, res) => {
  const actor: ContentActor = { kind: "teacher", teacher: res.locals.teacher as TeacherAccountDto };
  sendImage(res, await objectionService.getObjectionImage(req.params.id, actor));
};

export const listSchoolObjectionsForKey: RequestHandler<AnswerKeyIdParams> = async (req, res) => {
  const actor: ContentActor = {
    kind: "school",
    school: res.locals.school as SchoolAccountDto,
  };
  sendSuccess(res, await objectionService.listPortalObjectionsForKey(req.params.id, actor));
};

export const raiseTeacherObjection: RequestHandler<
  AnswerKeyIdParams,
  unknown,
  RaiseAnswerKeyObjectionInput
> = async (req, res) => {
  const actor: ContentActor = {
    kind: "teacher",
    teacher: res.locals.teacher as TeacherAccountDto,
  };
  sendSuccess(res, await objectionService.raiseObjection(req.params.id, actor, req.body, req.file), 201);
};

export const listTeacherObjectionsForKey: RequestHandler<AnswerKeyIdParams> = async (req, res) => {
  const actor: ContentActor = {
    kind: "teacher",
    teacher: res.locals.teacher as TeacherAccountDto,
  };
  sendSuccess(res, await objectionService.listPortalObjectionsForKey(req.params.id, actor));
};

export const listAdminObjections: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await objectionService.listAdminObjections(
      req.query as unknown as ListAnswerKeyObjectionsQuery,
    ),
  );
};

export const countOpenObjections: RequestHandler = async (_req, res) => {
  sendSuccess(res, await objectionService.countOpenObjections());
};

export const getAdminObjection: RequestHandler<ObjectionIdParams> = async (req, res) => {
  sendSuccess(res, await objectionService.getAdminObjection(req.params.id));
};

export const resolveAdminObjection: RequestHandler<
  ObjectionIdParams,
  unknown,
  ResolveAnswerKeyObjectionInput
> = async (req, res) => {
  sendSuccess(res, await objectionService.resolveObjection(req.params.id, req.body));
};
