import { z } from "zod";
import {
  classLevelField,
  testNumberField,
  type DocumentFormState,
} from "@/features/documents/schema";
import { SCHOOL_TYPES } from "@/types/school";

export function getAnswerKeySchema() {
  return z
    .object({
      program: z.string().trim().min(1, "Select a program.").max(64),
      type: z.enum(SCHOOL_TYPES, { error: "Select a type." }),
      schoolId: z.string().trim().optional(),
      testId: z.string().trim().min(1, "Enter the test ID.").max(64, "Keep the test ID under 64 characters."),
      testNumber: testNumberField,
      classLevel: classLevelField,
    })
    .refine((value) => value.type === "REGULAR" || value.schoolId, {
      path: ["schoolId"],
      message: "Select a school.",
    })
    .transform(({ schoolId, ...value }) =>
      value.type === "CUSTOMIZED" ? { ...value, schoolId } : value,
    );
}

export const ANSWER_KEY_FIELDS = ["program", "type", "schoolId", "testId", "testNumber", "classLevel"] as const;

export type AnswerKeyField = (typeof ANSWER_KEY_FIELDS)[number];
export type AnswerKeyFormState = DocumentFormState<AnswerKeyField>;
export type AnswerKeyFormValues = Exclude<AnswerKeyFormState, undefined | { status: "success" }>["values"];
