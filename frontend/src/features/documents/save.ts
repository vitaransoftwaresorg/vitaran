import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/services/api-client";
import type { DeleteResult } from "@/types/document";
import { readTextFields, type DocumentFormState } from "./schema";

type FieldErrors<Field extends string> = Partial<Record<Field, string[]>>;

function fieldErrorsFromApi<Field extends string>(details: unknown) {
  if (!Array.isArray(details)) return undefined;

  const fieldErrors: FieldErrors<Field> = {};
  for (const issue of details) {
    const field = issue?.path?.[0] as Field | undefined;
    if (field && typeof issue.message === "string") (fieldErrors[field] ??= []).push(issue.message);
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

type SaveDocumentOptions<Field extends string, Input> = {
  formData: FormData;
  /** Select fields to read and echo back after a failed save. */
  fields: readonly Exclude<Field, "file">[];
  /** File inputs to validate; files can't be echoed back. */
  fileFields?: readonly Field[];
  schema: z.ZodType<Input>;
  save: (input: Input) => Promise<unknown>;
  /** Admin section to refresh, e.g. `/admin/results`. */
  revalidate: string;
  /** Lowercase, e.g. "answer key". */
  noun: string;
};

/** Validates a document form, sends it to the API and maps API errors back onto fields. */
export async function saveDocument<Field extends string, Input>({
  formData,
  fields,
  fileFields = ["file" as Field],
  schema,
  save,
  revalidate,
  noun,
}: SaveDocumentOptions<Field, Input>): Promise<DocumentFormState<Field>> {
  const values = readTextFields(formData, fields);
  const fail = (extra: { message?: string; fieldErrors?: FieldErrors<Field> }) =>
    ({ status: "error", values, submittedAt: Date.now(), ...extra }) as const;

  const files = Object.fromEntries(fileFields.map((field) => [field, formData.get(field)]));
  const parsed = schema.safeParse({ ...values, ...files });
  if (!parsed.success) {
    return fail({ fieldErrors: z.flattenError(parsed.error).fieldErrors as unknown as FieldErrors<Field> });
  }

  try {
    await save(parsed.data);
    revalidatePath(revalidate, "layout");
    return { status: "success", submittedAt: Date.now() };
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof ApiError && error.status === 404) {
      return fail({ message: `This ${noun} no longer exists.` });
    }
    if (error instanceof ApiError && error.status < 500) {
      const fieldErrors = fieldErrorsFromApi<Field>(error.details);
      return fail(fieldErrors ? { fieldErrors } : { message: error.message });
    }

    console.error(`Failed to save ${noun}`, error);
    return fail({ message: `We couldn't save the ${noun} right now. Please try again.` });
  }
}

/** Shows or hides a document from schools. */
export async function publishDocument(
  publish: () => Promise<unknown>,
  revalidate: string,
  noun: string,
): Promise<DeleteResult> {
  try {
    await publish();
    revalidatePath(revalidate, "layout");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof ApiError && error.status === 404) {
      revalidatePath(revalidate, "layout");
      return { ok: false, message: `This ${noun} no longer exists.` };
    }
    return { ok: false, message: `We couldn't update the ${noun}. Please try again.` };
  }
}

export async function deleteDocument(
  remove: () => Promise<unknown>,
  revalidate: string,
  noun: string,
): Promise<DeleteResult> {
  try {
    await remove();
    revalidatePath(revalidate, "layout");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof ApiError && error.status === 404) {
      revalidatePath(revalidate, "layout");
      return { ok: false, message: `This ${noun} was already deleted.` };
    }
    return { ok: false, message: `We couldn't delete the ${noun}. Please try again.` };
  }
}
