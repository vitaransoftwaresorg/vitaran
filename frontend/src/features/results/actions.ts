"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_BASE_PATH, SCHOOL_BASE_PATH, TEACHER_BASE_PATH } from "@/constants/auth";
import { deleteDocument, publishDocument } from "@/features/documents/save";
import { ApiError } from "@/services/api-client";
import * as resultService from "@/services/results";
import { SCHOOL_RESULTS_PATH, TEACHER_RESULTS_PATH } from "./constants";

const NOUN = "result";

/** Admin + school/teacher portals must see replaces/publishes without a hard refresh. */
function revalidateResultViews() {
  revalidatePath(ADMIN_BASE_PATH, "layout");
  revalidatePath(SCHOOL_RESULTS_PATH);
  revalidatePath(TEACHER_RESULTS_PATH);
  revalidatePath(SCHOOL_BASE_PATH, "layout");
  revalidatePath(TEACHER_BASE_PATH, "layout");
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
