import type { RequestHandler, Response } from "express";
import type {
  ClassResultTemplateQuery,
  ListResultSetsQuery,
  ManualResultSheetInput,
  ResultSheetParams,
} from "../schemas/result.schema.js";
import type { PublishBody } from "../schemas/publish.schema.js";
import * as resultService from "../services/result.service.js";
import { getClassResultPdf, getRankCards as getRankCardFiles } from "../services/rank-card.service.js";
import type { ContentActor } from "../services/content-access.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { EXCEL_MIME_TYPE } from "../utils/excel.js";

type IdParams = { id: string };

const signedInSchool = (res: Response) => res.locals.school as SchoolAccountDto;
const signedInTeacher = (res: Response): ContentActor => ({
  kind: "teacher",
  teacher: res.locals.teacher as TeacherAccountDto,
});
const sheetParams = (params: unknown) => params as ResultSheetParams;

function sendExcel(res: Response, { fileName, data }: { fileName: string; data: Uint8Array }) {
  res
    .type(EXCEL_MIME_TYPE)
    .set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    .send(Buffer.from(data));
}

export const listResultSets: RequestHandler = async (req, res) => {
  sendSuccess(res, await resultService.listResultSets(req.query as unknown as ListResultSetsQuery));
};

export const getResultStats: RequestHandler = async (_req, res) => {
  sendSuccess(res, await resultService.getResultStats());
};

export const getResultSet: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await resultService.getResultSet(req.params.id));
};

export const getClassResultTemplate: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await resultService.getClassResultTemplate(req.query as unknown as ClassResultTemplateQuery),
  );
};

export const saveManualResultSheet: RequestHandler = async (req, res) => {
  sendSuccess(res, await resultService.saveManualResultSheet(req.body as ManualResultSheetInput), 201);
};

export const setResultSetPublished: RequestHandler<IdParams> = async (req, res) => {
  const { published } = req.body as PublishBody;
  sendSuccess(res, await resultService.setResultSetPublished(req.params.id, published));
};

export const deleteResultSet: RequestHandler<IdParams> = async (req, res) => {
  await resultService.deleteResultSet(req.params.id);
  res.status(204).end();
};

export const getResultSheet: RequestHandler = async (req, res) => {
  sendSuccess(res, await resultService.getResultSheet(sheetParams(req.params)));
};

function rankCardsHandler(viewerOf: (res: Response) => ContentActor | SchoolAccountDto | undefined): RequestHandler {
  return async (req, res) => {
    const roll = typeof req.query.roll === "string" ? req.query.roll.trim().slice(0, 64) : "";
    const format = req.query.format === "jpg" ? "jpg" : "pdf";
    const file = await getRankCardFiles(sheetParams(req.params), { roll: roll || undefined, format }, viewerOf(res));
    res
      .type(file.type)
      .set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
      .set("Cache-Control", "private, no-store")
      .send(file.data);
  };
}

function classResultPdfHandler(viewerOf: (res: Response) => ContentActor | SchoolAccountDto | undefined): RequestHandler {
  return async (req, res) => {
    const file = await getClassResultPdf(sheetParams(req.params), viewerOf(res));
    res
      .type(file.type)
      .set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
      .set("Cache-Control", "private, no-store")
      .send(file.data);
  };
}

export const getClassResultPdfFile = classResultPdfHandler(() => undefined);
export const getSchoolClassResultPdf = classResultPdfHandler(signedInSchool);
export const getTeacherClassResultPdf = classResultPdfHandler(signedInTeacher);

export const getRankCards = rankCardsHandler(() => undefined);
export const getSchoolRankCards = rankCardsHandler(signedInSchool);
export const getTeacherRankCards = rankCardsHandler(signedInTeacher);

export const getResultSheetFile: RequestHandler = async (req, res) => {
  sendExcel(res, await resultService.getResultSheetFile(sheetParams(req.params)));
};

export const listSchoolResultSets: RequestHandler = async (_req, res) => {
  sendSuccess(res, await resultService.listSchoolResultSets(signedInSchool(res)));
};

export const getSchoolResultSet: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await resultService.getResultSet(req.params.id, signedInSchool(res)));
};

export const getSchoolResultSheet: RequestHandler = async (req, res) => {
  sendSuccess(res, await resultService.getResultSheet(sheetParams(req.params), signedInSchool(res)));
};

export const getSchoolResultSheetFile: RequestHandler = async (req, res) => {
  sendExcel(res, await resultService.getResultSheetFile(sheetParams(req.params), signedInSchool(res)));
};

export const listTeacherResultSets: RequestHandler = async (_req, res) => {
  sendSuccess(res, await resultService.listVisibleResultSets(signedInTeacher(res)));
};

export const getTeacherResultSet: RequestHandler<IdParams> = async (req, res) => {
  sendSuccess(res, await resultService.getResultSet(req.params.id, signedInTeacher(res)));
};

export const getTeacherResultSheet: RequestHandler = async (req, res) => {
  sendSuccess(res, await resultService.getResultSheet(sheetParams(req.params), signedInTeacher(res)));
};

export const getTeacherResultSheetFile: RequestHandler = async (req, res) => {
  sendExcel(res, await resultService.getResultSheetFile(sheetParams(req.params), signedInTeacher(res)));
};

