import { z } from "zod";
import { PDF_MAX_BYTES } from "./constants";

export type DocumentFormMode = "create" | "edit";

const pdfFile = z
  .instanceof(File, { error: "Choose a PDF file." })
  .refine((file) => file.size > 0, "Choose a PDF file.")
  .refine(
    (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    "Only PDF files can be uploaded.",
  )
  .refine((file) => file.size <= PDF_MAX_BYTES, "Keep the file under 10 MB.");

/** Browsers submit an empty file when nothing was chosen. */
const optionalPdfFile = z.preprocess(
  (value) => (value instanceof File && value.size === 0 ? undefined : value),
  pdfFile.optional(),
);

/** The PDF is required on upload and only replaces the current one on edit. */
export const pdfFileField = (mode: DocumentFormMode) => (mode === "create" ? pdfFile : optionalPdfFile);

export const testNumberField = z.coerce
  .number({ error: "Select a test number." })
  .int()
  .min(1, "Select a test number from 1 to 18.")
  .max(18, "Select a test number from 1 to 18.");

export const classLevelField = z.coerce
  .number({ error: "Select a class." })
  .int()
  .min(1, "Select a class.")
  .max(12);

export type DocumentFormState<Field extends string> =
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<Field, string[]>>;
      /** Select values to restore after a failed save; files can't be restored. */
      values: Partial<Record<Exclude<Field, "file">, string>>;
      submittedAt: number;
    }
  | { status: "success"; submittedAt: number }
  | undefined;

export function readTextFields<Field extends string>(formData: FormData, fields: readonly Field[]) {
  return Object.fromEntries(
    fields.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === "string" ? value : ""];
    }),
  ) as Record<Field, string>;
}
