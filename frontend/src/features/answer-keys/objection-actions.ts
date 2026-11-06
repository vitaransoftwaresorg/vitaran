"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ApiError } from "@/services/api-client";
import {
  listAdminAnswerKeyObjections,
  listSchoolAnswerKeyObjections,
  listTeacherAnswerKeyObjections,
  raiseSchoolAnswerKeyObjection,
  raiseTeacherAnswerKeyObjection,
  resolveAdminAnswerKeyObjection,
} from "@/services/answer-keys";
import type {
  AnswerKeyObjection,
  AnswerKeyObjectionStatus,
  ResolveAnswerKeyObjectionInput,
  ResolveAnswerKeyObjectionResult,
} from "@/types/answer-key-objection";
import { ANSWER_KEYS_PATH, SCHOOL_ANSWER_KEYS_PATH, TEACHER_ANSWER_KEYS_PATH } from "./constants";

/** `form` holds message, questionNumber, proposedAnswer and an optional `image` file. */
export async function raisePortalObjectionAction(
  role: "school" | "teacher",
  answerKeyId: string,
  form: FormData,
): Promise<{ ok: true; objection: AnswerKeyObjection } | { ok: false; message: string }> {
  try {
    const objection =
      role === "school"
        ? await raiseSchoolAnswerKeyObjection(answerKeyId, form)
        : await raiseTeacherAnswerKeyObjection(answerKeyId, form);
    revalidatePath(
      role === "school" ? SCHOOL_ANSWER_KEYS_PATH : TEACHER_ANSWER_KEYS_PATH,
      "layout",
    );
    return { ok: true, objection };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: "Could not raise the objection." };
  }
}

export async function listPortalObjectionsAction(
  role: "school" | "teacher",
  answerKeyId: string,
): Promise<AnswerKeyObjection[]> {
  try {
    return role === "school"
      ? await listSchoolAnswerKeyObjections(answerKeyId)
      : await listTeacherAnswerKeyObjections(answerKeyId);
  } catch {
    return [];
  }
}

export async function resolveObjectionAction(
  id: string,
  input: ResolveAnswerKeyObjectionInput,
): Promise<
  { ok: true; objection: ResolveAnswerKeyObjectionResult } | { ok: false; message: string }
> {
  try {
    const objection = await resolveAdminAnswerKeyObjection(id, input);
    revalidatePath(`${ANSWER_KEYS_PATH}/objections`);
    revalidatePath(ANSWER_KEYS_PATH);
    return { ok: true, objection };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: "Could not update the objection." };
  }
}

export async function loadAdminObjectionsAction(status?: AnswerKeyObjectionStatus) {
  return listAdminAnswerKeyObjections({ status, pageSize: 100 });
}
