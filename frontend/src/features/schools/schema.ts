import { z } from "zod";
import {
  SCHOOL_BOARDS,
  SCHOOL_STATUSES,
  SCHOOL_TYPES,
  type SchoolInput,
} from "@/types/school";
import { SCHOOLS_PAGE_SIZE, subjectsForClassLevel } from "./constants";
import { offeringsToPrograms, parseOfferingToken } from "./offerings";

const emptyToNull = (value: string) => (value === "" ? null : value);

const emailField = z
  .email({ error: "Enter a valid email address." })
  .trim()
  .toLowerCase();

const phoneField = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Enter a 10-digit phone number.");

export const getEmailHint = (value: string) =>
  emailField.safeParse(value).success ? null : "Email should be like name@example.com";

export const getPhoneHint = (value: string) =>
  /^\d{10}$/.test(value) ? null : `Phone number should be 10 digits (${value.length}/10)`;

export const toPhoneDigits = (value: string) => value.replace(/\D/g, "").slice(0, 10);

/** Uppercases the first letter of every word, leaving the rest as typed (e.g. "DPS"). */
export const capitalizeWords = (value: string) =>
  value.replace(/(^|\s)(\p{L})/gu, (_match, space: string, letter: string) => space + letter.toUpperCase());

const offeringToken = z
  .string()
  .refine((value) => {
    const parsed = parseOfferingToken(value);
    return parsed !== null && parsed.subject.length >= 2;
  }, "Invalid class or subject selection.");

const schoolCodeField = z
  .string()
  .trim()
  .min(1, "Enter the school ID.")
  .max(64, "Keep the school ID under 64 characters.");

const schoolFields = z.object({
  code: schoolCodeField,
  name: z
    .string()
    .trim()
    .min(2, "Enter the school name.")
    .max(200, "Keep the name under 200 characters.")
    .transform(capitalizeWords),
  board: z.enum(SCHOOL_BOARDS, { error: "Select a board." }),
  type: z.enum(SCHOOL_TYPES, { error: "Select a type." }),
  status: z.enum(SCHOOL_STATUSES, { error: "Select a status." }),
  offerings: z.array(offeringToken).default([]),
  customProgramName: z.string().trim().max(120).optional().default(""),
  customClasses: z.array(z.string()).optional().default([]),
  principalName: z
    .string()
    .trim()
    .max(120)
    .transform((value) => emptyToNull(capitalizeWords(value))),
  contactName: z
    .string()
    .trim()
    .min(2, "Enter the contact person's name.")
    .max(120)
    .transform(capitalizeWords),
  contactEmail: emailField,
  contactPhone: phoneField,
  addressLine: z
    .string()
    .trim()
    .min(5, "Enter the street address.")
    .max(300)
    .transform(capitalizeWords),
  city: z.string().trim().min(2, "Enter the city.").max(100).transform(capitalizeWords),
  state: z.string().trim().min(2, "Select a state.").max(100),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode."),
  studentStrength: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 100_000),
      "Enter a number between 1 and 100,000.",
    )
    .transform((value) => (value === "" ? null : Number(value))),
  notes: z
    .string()
    .trim()
    .max(1000, "Keep notes under 1000 characters.")
    .transform(emptyToNull),
  accountEmail: emailField,
  accountPhone: phoneField,
  password: z.string().max(128, "Keep the password under 128 characters."),
});

function withCustomProgramRules<T extends z.ZodType>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const data = value as z.output<typeof schoolFields>;
    if (data.type !== "CUSTOMIZED") return;

    if (!data.customProgramName || data.customProgramName.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["customProgramName"],
        message: "Enter the program name.",
      });
    }
    if (!data.customClasses?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["customClasses"],
        message: "Select at least one class.",
      });
    }
  });
}

/** On edit, a blank password keeps the current one. */
export function getSchoolFormSchema(mode: "create" | "edit") {
  const base =
    mode === "edit"
      ? schoolFields
      : schoolFields.extend({
          password: schoolFields.shape.password.min(1, "Enter a password."),
        });
  return withCustomProgramRules(base);
}

export type SchoolFormMode = Parameters<typeof getSchoolFormSchema>[0];
export type SchoolFormField = keyof z.input<typeof schoolFields>;

export function toSchoolInput({
  password,
  offerings,
  customProgramName,
  customClasses,
  ...input
}: z.output<typeof schoolFields>): SchoolInput {
  if (input.type === "CUSTOMIZED") {
    const classes = [...new Set(customClasses)]
      .map(Number)
      .filter((level) => Number.isInteger(level) && level >= 1 && level <= 12)
      .sort((a, b) => a - b)
      .map((classLevel) => ({ classLevel, subjects: subjectsForClassLevel(classLevel) }));
    const payload = {
      ...input,
      programs: [] as SchoolInput["programs"],
      customProgram: { name: customProgramName.trim(), classes },
    };
    return password ? { ...payload, password } : payload;
  }

  const programs = offeringsToPrograms(offerings);
  return password ? { ...input, programs, password } : { ...input, programs };
}

/** Checkbox groups; every other field is a single text value. */
export const LIST_FIELDS = ["offerings", "customClasses"] as const;
export type ListField = (typeof LIST_FIELDS)[number];
export type TextField = Exclude<SchoolFormField, ListField>;

export type SchoolFormValues = Partial<Record<TextField, string>> &
  Partial<Record<ListField, string[]>>;

export type SchoolFormErrors = Partial<Record<SchoolFormField, string[]>>;

export type SchoolFormState =
  | {
      status: "error";
      message?: string;
      fieldErrors?: SchoolFormErrors;
      values: SchoolFormValues;
      submittedAt: number;
    }
  | { status: "success"; schoolId: string; submittedAt: number }
  | undefined;

const TEXT_FIELDS = Object.keys(schoolFields.shape).filter(
  (field) => !(LIST_FIELDS as readonly string[]).includes(field),
) as TextField[];

export function readFormValues(formData: FormData): SchoolFormValues {
  const values: SchoolFormValues = {};

  for (const field of LIST_FIELDS) {
    values[field] = formData.getAll(field).map(String);
  }
  for (const field of TEXT_FIELDS) {
    values[field] = String(formData.get(field) ?? "");
  }

  return values;
}

/** True when both hold the same field values, ignoring checkbox order. */
export function sameFormValues(a: SchoolFormValues, b: SchoolFormValues): boolean {
  const list = (values: SchoolFormValues, field: ListField) =>
    [...(values[field] ?? [])].sort().join(",");

  return (
    LIST_FIELDS.every((field) => list(a, field) === list(b, field)) &&
    TEXT_FIELDS.every((field) => (a[field] ?? "") === (b[field] ?? ""))
  );
}

/** New-school passwords are never echoed back or stored in drafts. */
export function withoutPasswords({ password, ...values }: SchoolFormValues): SchoolFormValues {
  void password;
  return values;
}

export function getFormErrors(
  values: SchoolFormValues,
  mode: SchoolFormMode,
): SchoolFormErrors {
  const result = getSchoolFormSchema(mode).safeParse(values);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);

export const schoolListParamsSchema = z.object({
  search: z.string().trim().max(100).optional().catch(undefined),
  status: optionalEnum(SCHOOL_STATUSES),
  board: optionalEnum(SCHOOL_BOARDS),
  type: optionalEnum(SCHOOL_TYPES),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(SCHOOLS_PAGE_SIZE),
});
