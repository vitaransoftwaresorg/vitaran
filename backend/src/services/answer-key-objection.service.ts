import {
  AnswerKeyObjectionRaisedBy,
  AnswerKeyObjectionStatus,
} from "../generated/prisma/enums.js";
import * as objectionRepository from "../repositories/answer-key-objection.repository.js";
import type {
  ListAnswerKeyObjectionsQuery,
  RaiseAnswerKeyObjectionInput,
  ResolveAnswerKeyObjectionInput,
} from "../schemas/answer-key-objection.schema.js";
import sharp from "sharp";
import type { Prisma } from "../generated/prisma/client.js";
import { env, getCorsOrigins } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { asAnswers, asSubjectRanges, parseKeyAnswer } from "../utils/answer-key-parse.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { answerKeyAccessFilter, type ContentActor } from "./content-access.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import type { ObjectionRecord } from "../repositories/answer-key-objection.repository.js";
import { sendObjectionAlertEmail } from "./mail.service.js";
import * as settingsService from "./settings.service.js";

const KIND = "objections" as const;
const ANSWER_KEYS_KIND = "answer-keys" as const;

function subjectForQuestion(subjectRanges: unknown, questionNumber: number | null) {
  if (questionNumber == null) return null;
  const ranges = asSubjectRanges(subjectRanges);
  const match = ranges.find((range) => questionNumber >= range.from && questionNumber <= range.to);
  return match?.subject ?? null;
}

function subjectDisplay(code: string | null) {
  if (!code) return null;
  return code
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function notifyObjectionEmails(row: ObjectionRecord, subjectCode: string | null) {
  const settings = await settingsService.getAppSettings();
  const sme = await settingsService.smeEmailsForSubject(subjectCode);
  const recipients = [
    ...(settings.vitaranEmail ? [settings.vitaranEmail] : []),
    ...sme.map((row) => row.email),
  ];
  if (recipients.length === 0) return;

  const base = (env.APP_URL ?? getCorsOrigins()[0] ?? "http://localhost:3000").replace(/\/$/, "");
  await sendObjectionAlertEmail({
    to: recipients,
    schoolName: row.school.name,
    schoolCode: row.school.code,
    raisedBy: row.raisedBy === AnswerKeyObjectionRaisedBy.TEACHER ? "Teacher" : "School",
    teacherName: row.teacher?.name ?? null,
    programCode: row.answerKey.programCode,
    testNumber: row.answerKey.testNumber,
    testId: row.answerKey.testId ?? "",
    classLevel: row.answerKey.classLevel,
    questionNumber: row.questionNumber,
    subjectLabel: subjectDisplay(subjectCode),
    proposedAnswer: row.proposedAnswer,
    message: row.message,
    adminObjectionsUrl: `${base}/admin/answer-keys/objections`,
  });
}

function toObjectionDto(row: ObjectionRecord) {
  return {
    id: row.id,
    answerKeyId: row.answerKeyId,
    schoolId: row.schoolId,
    school: row.school,
    raisedBy: row.raisedBy,
    teacherId: row.teacherId,
    teacher: row.teacher
      ? { id: row.teacher.id, name: row.teacher.name, email: row.teacher.email }
      : null,
    questionNumber: row.questionNumber,
    proposedAnswer: row.proposedAnswer,
    message: row.message,
    hasImage: Boolean(row.imageMimeType),
    status: row.status,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    answerKey: {
      id: row.answerKey.id,
      programCode: row.answerKey.programCode,
      testId: row.answerKey.testId ?? "",
      testNumber: row.answerKey.testNumber,
      classLevel: row.answerKey.classLevel,
      type: row.answerKey.type,
    },
  };
}

async function assertAnswerKeyVisible(answerKeyId: string, actor: ContentActor) {
  const row = await answerKeyRepository.findVisibleAnswerKey(
    answerKeyId,
    answerKeyAccessFilter(actor),
  );
  if (!row) throw new AppError(404, "Answer key not found");
  return row;
}

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Phone photos are large; keep a readable JPEG (max 1600px) with EXIF rotation applied. */
async function prepareImage(file?: Express.Multer.File) {
  if (!file || file.size === 0) return null;
  if (!file.mimetype.startsWith("image/")) throw new AppError(400, "Attach an image (JPG, PNG, HEIC…)");
  if (file.size > IMAGE_MAX_BYTES) throw new AppError(413, "Image is too large (max 10 MB)");
  try {
    const data = await sharp(file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { data: new Uint8Array(data), mimeType: "image/jpeg" };
  } catch {
    throw new AppError(400, "Could not read this image. Try a JPG or PNG.");
  }
}

export async function raiseObjection(
  answerKeyId: string,
  actor: ContentActor,
  input: RaiseAnswerKeyObjectionInput,
  file?: Express.Multer.File,
) {
  await assertAnswerKeyVisible(answerKeyId, actor);
  const image = await prepareImage(file);

  const schoolId =
    actor.kind === "school" ? actor.school.id : actor.teacher.school.id;
  const raisedBy =
    actor.kind === "school"
      ? AnswerKeyObjectionRaisedBy.SCHOOL
      : AnswerKeyObjectionRaisedBy.TEACHER;
  const teacherId = actor.kind === "teacher" ? actor.teacher.id : null;

  const key = await answerKeyRepository.findAnswerKeyById(answerKeyId);
  const subjectCode = subjectForQuestion(
    key?.subjectRanges,
    input.questionNumber ?? null,
  );

  const row = await objectionRepository.createObjection({
    answerKeyId,
    schoolId,
    raisedBy,
    teacherId,
    questionNumber: input.questionNumber ?? null,
    proposedAnswer: input.proposedAnswer ?? null,
    message: input.message.trim(),
    image,
  });
  notifyContentChanged({ kind: KIND, schoolId });
  void notifyObjectionEmails(row, subjectCode);
  return toObjectionDto(row);
}

export async function listPortalObjectionsForKey(answerKeyId: string, actor: ContentActor) {
  await assertAnswerKeyVisible(answerKeyId, actor);
  const schoolId =
    actor.kind === "school" ? actor.school.id : actor.teacher.school.id;
  const { items } = await objectionRepository.listObjections({
    answerKeyId,
    schoolId,
    page: 1,
    pageSize: 50,
  });
  return items.map(toObjectionDto);
}

export async function listAdminObjections(query: ListAnswerKeyObjectionsQuery) {
  const { items, total } = await objectionRepository.listObjections(query);
  return {
    items: items.map(toObjectionDto),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function countOpenObjections() {
  return { open: await objectionRepository.countOpenObjections() };
}

/** Admin sees every photo; schools and teachers only their own school's. */
export async function getObjectionImage(id: string, actor?: ContentActor) {
  const row = await objectionRepository.findObjectionImage(id);
  const schoolId = actor ? (actor.kind === "school" ? actor.school.id : actor.teacher.school.id) : null;
  if (!row?.imageData || (schoolId && row.schoolId !== schoolId)) {
    throw new AppError(404, "Image not found");
  }
  return { data: row.imageData, mimeType: row.imageMimeType ?? "image/jpeg" };
}

export async function getAdminObjection(id: string) {
  const row = await objectionRepository.findObjectionById(id);
  if (!row) throw new AppError(404, "Objection not found");
  return toObjectionDto(row);
}

/** Apply proposed option(s)/ADD to the live key when admin accepts. Skip NONE. */
async function applyProposedAnswerToKey(existing: ObjectionRecord) {
  const questionNumber = existing.questionNumber;
  const proposed = existing.proposedAnswer?.trim().toUpperCase() ?? "";
  if (questionNumber == null || !proposed || proposed === "NONE") return false;

  const nextAnswer = parseKeyAnswer(proposed);
  if (!nextAnswer) return false;

  const key = await answerKeyRepository.findAnswerKeyById(existing.answerKeyId);
  if (!key) return false;

  const questionKey = String(questionNumber);
  const answers = asAnswers(key.answers);
  if (answers[questionKey] === nextAnswer) return false;

  answers[questionKey] = nextAnswer;
  const updated = await answerKeyRepository.updateAnswerKey(existing.answerKeyId, {
    answers: answers as Prisma.InputJsonValue,
  });
  notifyContentChanged({
    kind: ANSWER_KEYS_KIND,
    schoolId: updated.school?.id ?? null,
  });
  return true;
}

export async function resolveObjection(id: string, input: ResolveAnswerKeyObjectionInput) {
  const existing = await objectionRepository.findObjectionById(id);
  if (!existing) throw new AppError(404, "Objection not found");
  if (existing.status !== AnswerKeyObjectionStatus.OPEN) {
    throw new AppError(400, "This objection was already reviewed");
  }

  let keyUpdated = false;
  if (input.status === AnswerKeyObjectionStatus.RESOLVED) {
    keyUpdated = await applyProposedAnswerToKey(existing);
  }

  const row = await objectionRepository.resolveObjection(id, {
    status: input.status,
    resolutionNote: input.resolutionNote.trim(),
  });
  notifyContentChanged({ kind: KIND, schoolId: existing.schoolId });
  return { ...toObjectionDto(row), keyUpdated };
}
