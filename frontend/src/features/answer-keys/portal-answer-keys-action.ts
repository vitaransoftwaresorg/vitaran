"use server";

import {
  getSchoolAnswerKey,
  getTeacherAnswerKey,
  listSchoolAnswerKeys,
  listTeacherAnswerKeys,
} from "@/services/answer-keys";
import type { AnswerKeyDetail } from "@/types/answer-key";
import type { PdfDocument } from "@/types/document";

export async function loadSchoolPortalAnswerKeysAction(): Promise<PdfDocument[]> {
  return listSchoolAnswerKeys();
}

export async function loadTeacherPortalAnswerKeysAction(): Promise<PdfDocument[]> {
  return listTeacherAnswerKeys();
}

export async function loadSchoolAnswerKeyAction(id: string): Promise<AnswerKeyDetail | null> {
  return getSchoolAnswerKey(id);
}

export async function loadTeacherAnswerKeyAction(id: string): Promise<AnswerKeyDetail | null> {
  return getTeacherAnswerKey(id);
}
