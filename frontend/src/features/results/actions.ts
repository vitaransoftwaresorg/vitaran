"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_BASE_PATH, SCHOOL_BASE_PATH, TEACHER_BASE_PATH } from "@/constants/auth";
import { deleteDocument, publishDocument, saveDocument } from "@/features/documents/save";
import { ApiError } from "@/services/api-client";
import * as resultService from "@/services/results";
import { SCHOOL_RESULTS_PATH, TEACHER_RESULTS_PATH } from "./constants";
import {
  CLASS_FILE_FIELDS,
  RESULT_FIELDS,
  resultSetSchema,
  type ResultField,
  type ResultFormState,
  type ResultSetInput,
} from "./schema";

const NOUN = "result";

/** Admin + school/teacher portals must see replaces/publishes without a hard refresh. */
function revalidateResultViews() {
  revalidatePath(ADMIN_BASE_PATH, "layout");
  revalidatePath(SCHOOL_RESULTS_PATH);
  revalidatePath(TEACHER_RESULTS_PATH);
  revalidatePath(SCHOOL_BASE_PATH, "layout");
  revalidatePath(TEACHER_BASE_PATH, "layout");
}

const options = {
  fields: RESULT_FIELDS,
  fileFields: CLASS_FILE_FIELDS,
  schema: resultSetSchema,
  revalidate: ADMIN_BASE_PATH,
  noun: NOUN,
};

/** Rebuilds the multipart body the API expects from validated input only. */
function toApiForm(input: ResultSetInput) {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof File) form.append(key, value, value.name);
    else if (value !== undefined && value !== "") form.append(key, String(value));
  }
  return form;
}

export async function uploadResultAction(
  _state: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  const result = await saveDocument<ResultField, ResultSetInput>({
    ...options,
    formData,
    save: (input) => resultService.uploadResultSet(toApiForm(input)),
  });
  if (result?.status === "success") revalidateResultViews();
  return result;
}

export async function saveManualResultAction(input: resultService.ManualResultSheetInput) {
  try {
    const resultSet = await resultService.saveManualResultSheet(input);
    revalidateResultViews();
    return { ok: true as const, resultSet };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Couldn't save results";
    return { ok: false as const, message };
  }
}

export async function updateResultAction(
  id: string,
  _state: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  const result = await saveDocument<ResultField, ResultSetInput>({
    ...options,
    formData,
    save: (input) => resultService.updateResultSet(id, toApiForm(input)),
  });
  if (result?.status === "success") revalidateResultViews();
  return result;
}

export async function setResultPublishedAction(id: string, published: boolean) {
  const result = await publishDocument(
    () => resultService.setResultSetPublished(id, published),
    ADMIN_BASE_PATH,
    NOUN,
  );
  if (result.ok) revalidateResultViews();
  return result;
}

export async function deleteResultAction(id: string) {
  const result = await deleteDocument(
    () => resultService.deleteResultSet(id),
    ADMIN_BASE_PATH,
    NOUN,
  );
  if (result.ok) revalidateResultViews();
  return result;
}
