"use server";

import { revalidatePath } from "next/cache";
import { SCHOOL_BASE_PATH, TEACHER_BASE_PATH } from "@/constants/auth";
import { deleteDocument, publishDocument, saveDocument } from "@/features/documents/save";
import * as answerKeyService from "@/services/answer-keys";
import type { SubjectRange } from "@/types/answer-key";
import { ANSWER_KEY_NOUN, ANSWER_KEYS_PATH } from "./constants";
import { ANSWER_KEY_FIELDS, getAnswerKeySchema, type AnswerKeyFormState } from "./schema";

function revalidateAnswerKeyViews() {
  revalidatePath(ANSWER_KEYS_PATH, "layout");
  revalidatePath(`${SCHOOL_BASE_PATH}/answer-keys`, "layout");
  revalidatePath(`${TEACHER_BASE_PATH}/answer-keys`, "layout");
}

const options = { fields: ANSWER_KEY_FIELDS, revalidate: ANSWER_KEYS_PATH, noun: ANSWER_KEY_NOUN };

export async function uploadAnswerKeyAction(
  _state: AnswerKeyFormState,
  formData: FormData,
): Promise<AnswerKeyFormState> {
  const result = await saveDocument({
    ...options,
    formData,
    schema: getAnswerKeySchema("create"),
    save: answerKeyService.uploadAnswerKey,
  });
  if (result?.status === "success") revalidateAnswerKeyViews();
  return result;
}

export async function updateAnswerKeyAction(
  id: string,
  _state: AnswerKeyFormState,
  formData: FormData,
): Promise<AnswerKeyFormState> {
  const result = await saveDocument({
    ...options,
    formData,
    schema: getAnswerKeySchema("edit"),
    save: (input) => answerKeyService.updateAnswerKey(id, input),
  });
  if (result?.status === "success") revalidateAnswerKeyViews();
  return result;
}

export async function setAnswerKeyPublishedAction(id: string, published: boolean) {
  const result = await publishDocument(
    () => answerKeyService.setAnswerKeyPublished(id, published),
    ANSWER_KEYS_PATH,
    ANSWER_KEY_NOUN,
  );
  if (result.ok) revalidateAnswerKeyViews();
  return result;
}

export async function saveAnswerKeyAnswersAction(
  id: string,
  input: {
    answers: Record<string, string>;
    explanations: Record<string, string>;
    printedAnswers?: Record<string, string>;
    subjectRanges: SubjectRange[];
    pattern?: "MAINS" | "ADVANCED";
  },
) {
  const result = await answerKeyService.saveAnswerKeyAnswers(id, input);
  revalidateAnswerKeyViews();
  return result;
}

export async function reparseAnswerKeyAction(id: string) {
  return answerKeyService.reparseAnswerKey(id);
}

export async function deleteAnswerKeyAction(id: string) {
  const result = await deleteDocument(
    () => answerKeyService.deleteAnswerKey(id),
    ANSWER_KEYS_PATH,
    ANSWER_KEY_NOUN,
  );
  if (result.ok) revalidateAnswerKeyViews();
  return result;
}
