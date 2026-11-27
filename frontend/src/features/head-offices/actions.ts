"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/services/api-client";
import * as headOfficeService from "@/services/head-offices";

const PATH = "/admin/head-offices";

const officeSchema = z.object({
  name: z.string().trim().min(2, "Enter the office name.").max(200),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Office code must be 6 digits.")
    .optional(),
  contactName: z.string().trim().min(2, "Enter the contact name.").max(120),
  contactEmail: z.string().trim().email("Enter a valid email.").max(254),
  contactPhone: z.string().trim().min(8, "Enter a phone number.").max(20),
  addressLine: z.string().trim().min(3, "Enter the address.").max(300),
  city: z.string().trim().min(2, "Enter the city.").max(100),
  state: z.string().trim().min(2, "Enter the state.").max(100),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode."),
  notes: z.string().trim().max(1000).optional(),
  password: z
    .string()
    .min(4, "Enter a password (at least 4 characters).")
    .max(128, "Keep the password under 128 characters."),
  schoolIds: z.array(z.string().uuid()).default([]),
});

export type HeadOfficeFormValues = {
  name: string;
  code: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  password: string;
  schoolIds: string[];
};

export type HeadOfficeFormState =
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<keyof HeadOfficeFormValues, string[]>>;
      values: HeadOfficeFormValues;
    }
  | { status: "success"; officeId: string }
  | undefined;

function fieldErrorsFromApi(details: unknown) {
  if (!Array.isArray(details)) return undefined;
  const fieldErrors: Partial<Record<keyof HeadOfficeFormValues, string[]>> = {};
  for (const issue of details) {
    const field = issue?.path?.[0] as keyof HeadOfficeFormValues | undefined;
    if (field && typeof issue.message === "string") {
      (fieldErrors[field] ??= []).push(issue.message);
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

function readValues(formData: FormData): HeadOfficeFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    addressLine: String(formData.get("addressLine") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    pincode: String(formData.get("pincode") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    password: String(formData.get("password") ?? ""),
    schoolIds: formData.getAll("schoolIds").map(String),
  };
}

async function save(
  formData: FormData,
  persist: (input: z.infer<typeof officeSchema>) => Promise<{ id: string }>,
): Promise<HeadOfficeFormState> {
  const values = readValues(formData);
  const parsed = officeSchema.safeParse({
    ...values,
    code: values.code.trim() || undefined,
    notes: values.notes.trim() || undefined,
    password: values.password.trim(),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  try {
    const office = await persist(parsed.data);
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${office.id}`);
    revalidatePath("/admin/schools");
    return { status: "success", officeId: office.id };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return {
        status: "error",
        message: error.message,
        fieldErrors: fieldErrorsFromApi(error.details),
        values,
      };
    }
    return { status: "error", message: "Could not save the head office.", values };
  }
}

export async function createHeadOfficeAction(
  _state: HeadOfficeFormState,
  formData: FormData,
): Promise<HeadOfficeFormState> {
  return save(formData, (input) => headOfficeService.createHeadOffice(input));
}

export async function updateHeadOfficeAction(
  id: string,
  _state: HeadOfficeFormState,
  formData: FormData,
): Promise<HeadOfficeFormState> {
  return save(formData, (input) => headOfficeService.updateHeadOffice(id, input));
}

export async function deleteHeadOfficeAction(id: string) {
  try {
    await headOfficeService.deleteHeadOffice(id);
    revalidatePath(PATH);
    revalidatePath("/admin/schools");
    return { ok: true as const };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "Could not delete the head office." };
  }
}

export async function isHeadOfficeCodeTakenAction(code: string, excludeId?: string) {
  try {
    const result = await headOfficeService.getHeadOfficeCodeAvailability(code, excludeId);
    return result.taken;
  } catch {
    return false;
  }
}

/** Fails open: create/update still rejects duplicates on save. */
export async function isHeadOfficeEmailTakenAction(
  email: string,
  excludeId?: string,
): Promise<{ taken: boolean; message: string | null }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { taken: false, message: null };
  }
  try {
    return await headOfficeService.getHeadOfficeEmailAvailability(normalized, excludeId);
  } catch {
    return { taken: false, message: null };
  }
}

export async function getNextHeadOfficeCodeAction() {
  try {
    return await headOfficeService.getNextHeadOfficeCode();
  } catch {
    return null;
  }
}
