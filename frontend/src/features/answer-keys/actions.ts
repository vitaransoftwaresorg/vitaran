"use server";

import { revalidatePath } from "next/cache";
import { SCHOOL_BASE_PATH, TEACHER_BASE_PATH } from "@/constants/auth";
import { deleteDocument, publishDocument, saveDocument } from "@/features/documents/save";
import * as answerKeyService from "@/services/answer-keys";
import type { SubjectRange, TestIdAvailability } from "@/types/answer-key";
import { ANSWER_KEY_NOUN, ANSWER_KEYS_PATH } from "./constants";
import {
  ANSWER_KEY_FIELDS,
  getAnswerKeySchema,
  type AnswerKeyField,
  type AnswerKeyFormState,
} from "./schema";

function revalidateAnswerKeyViews() {
  revalidatePath(ANSWER_KEYS_PATH, "layout");
  revalidatePath(`${SCHOOL_BASE_PATH}/answer-keys`, "layout");
  revalidatePath(`${TEACHER_BASE_PATH}/answer-keys`, "layout");
}

type AnswerKeySaveInput = ReturnType<typeof getAnswerKeySchema>["_output"];

const options = {
  fields: ANSWER_KEY_FIELDS,
  fileFields: [] as readonly AnswerKeyField[],
  revalidate: ANSWER_KEYS_PATH,
  noun: ANSWER_KEY_NOUN,
};

export async function createAnswerKeyFormAction(
  _state: AnswerKeyFormState,
  formData: FormData,
): Promise<AnswerKeyFormState> {
  const result = await saveDocument<AnswerKeyField, AnswerKeySaveInput>({
    ...options,
    formData,
    schema: getAnswerKeySchema(),
    save: answerKeyService.createAnswerKey,
  });
  if (result?.status === "success") revalidateAnswerKeyViews();
  return result;
}

export async function updateAnswerKeyAction(
  id: string,
  _state: AnswerKeyFormState,
  formData: FormData,
): Promise<AnswerKeyFormState> {
  const result = await saveDocument<AnswerKeyField, AnswerKeySaveInput>({
    ...options,
    formData,
    schema: getAnswerKeySchema(),
    save: (input) => answerKeyService.updateAnswerKey(id, input),
  });
  if (result?.status === "success") revalidateAnswerKeyViews();
  return result;
}

export async function createAnswerKeyAction(input: {
  program: string;
  type: "REGULAR" | "CUSTOMIZED";
  schoolId?: string;
  testNumber: number;
  classLevel: number;
  testId?: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const created = await answerKeyService.createAnswerKey({
      program: input.program,
      type: input.type,
      schoolId: input.schoolId,
      ...(input.testId?.trim() ? { testId: input.testId.trim() } : {}),
      testNumber: input.testNumber,
      classLevel: input.classLevel,
    });
    revalidateAnswerKeyViews();
    return { ok: true, id: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create this answer key.";
    return { ok: false, message };
  }
}

export async function checkAnswerKeyTestIdAction(
  testId: string,
  exceptId?: string,
): Promise<({ ok: true } & TestIdAvailability) | { ok: false; message: string }> {
  try {
    return { ok: true, ...(await answerKeyService.checkAnswerKeyTestId(testId, exceptId)) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not check this test ID." };
  }
}

export async function setAnswerKeyTestIdAction(id: string, testId: string) {
  const next = testId.trim();
  if (!next) return { ok: false as const, message: "Enter the test ID" };
  try {
    await answerKeyService.setAnswerKeyTestId(id, next);
    revalidateAnswerKeyViews();
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Could not save this test ID.",
    };
  }
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
    testId?: string;
    correctMarks: number;
    wrongMarks: number;
  },
) {
  const result = await answerKeyService.saveAnswerKeyAnswers(id, input);
  revalidateAnswerKeyViews();
  return result;
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
