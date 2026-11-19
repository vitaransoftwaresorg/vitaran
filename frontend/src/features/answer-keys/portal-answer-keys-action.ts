"use server";

import {
  getSchoolAnswerKey,
  getTeacherAnswerKey,
  listSchoolAnswerKeys,
  listTeacherAnswerKeys,
} from "@/services/answer-keys";
import type { AnswerKey, AnswerKeyDetail } from "@/types/answer-key";

export async function loadSchoolPortalAnswerKeysAction(): Promise<AnswerKey[]> {
  return listSchoolAnswerKeys();
}

export async function loadTeacherPortalAnswerKeysAction(): Promise<AnswerKey[]> {
  return listTeacherAnswerKeys();
}

export async function loadSchoolAnswerKeyAction(id: string): Promise<AnswerKeyDetail | null> {
  return getSchoolAnswerKey(id);
}

export async function loadTeacherAnswerKeyAction(id: string): Promise<AnswerKeyDetail | null> {
  return getTeacherAnswerKey(id);
}
