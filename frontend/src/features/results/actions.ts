"use server";

import { revalidatePath } from "next/cache";
import { deleteDocument, publishDocument } from "@/features/documents/save";
import { ApiError } from "@/services/api-client";
import * as resultService from "@/services/results";
import { RESULTS_PATH, SCHOOL_RESULTS_PATH, TEACHER_RESULTS_PATH } from "./constants";

const NOUN = "result";

/** Admin + school/teacher portals must see replaces/publishes without a hard refresh. */
function revalidateResultViews() {
  revalidatePath(RESULTS_PATH);
  revalidatePath(SCHOOL_RESULTS_PATH);
  revalidatePath(TEACHER_RESULTS_PATH);
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

export async function setResultPublishedAction(id: string, published: boolean) {
  // No revalidatePath — refreshes the current page and blinks every publish switch.
  // Optimistic UI + SSE update portals / other tabs.
  return publishDocument(
    () => resultService.setResultSetPublished(id, published),
    RESULTS_PATH,
    NOUN,
    false,
  );
}

export async function setResultSheetPublishedAction(
  id: string,
  classLevel: number,
  published: boolean,
) {
  return publishDocument(
    () => resultService.setResultSheetPublished(id, classLevel, published),
    RESULTS_PATH,
    NOUN,
    false,
  );
}

export async function deleteResultAction(id: string) {
  const result = await deleteDocument(
    () => resultService.deleteResultSet(id),
    RESULTS_PATH,
    NOUN,
  );
  if (result.ok) revalidateResultViews();
  return result;
}

/** Delete one class sheet (and the parent set if it was the last class). */
export async function deleteResultSheetAction(id: string, classLevel: number) {
  const result = await deleteDocument(
    () => resultService.deleteResultSheet(id, classLevel),
    RESULTS_PATH,
    "class result",
  );
  if (result.ok) revalidateResultViews();
  return result;
}
