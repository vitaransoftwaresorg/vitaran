import {
  getFormErrors,
  type SchoolFormErrors,
  type SchoolFormField,
  type SchoolFormMode,
  type SchoolFormValues,
} from "./schema";

export type SchoolFormStep = {
  id: string;
  title: string;
  fields: readonly SchoolFormField[];
};

export const SCHOOL_FORM_STEPS = [
  {
    id: "school",
    title: "School",
    fields: [
      "code",
      "name",
      "logo",
      "board",
      "type",
      "status",
      "principalName",
      "studentStrength",
      "accountEmail",
      "accountPhone",
      "password",
    ],
  },
  {
    id: "contact",
    title: "Contact & address",
    fields: [
      "contactName",
      "contactEmail",
      "contactPhone",
      "addressLine",
      "city",
      "state",
      "pincode",
      "notes",
    ],
  },
  {
    id: "programs",
    title: "Programs & classes",
    fields: ["offerings", "customProgramName", "customClasses"],
  },
] as const satisfies readonly SchoolFormStep[];

/** Customized registration only — upload PDFs for classes 1–10. */
export const SCHOOL_FORM_RESOURCES_STEP = {
  id: "resources",
  title: "Student resources",
  fields: [] as const satisfies readonly SchoolFormField[],
} as const satisfies SchoolFormStep;

export const STEP_SEARCH_PARAM = "step";
export const LAST_STEP = SCHOOL_FORM_STEPS.length - 1;

function asSchoolType(value: string | undefined): "REGULAR" | "CUSTOMIZED" {
  return value === "CUSTOMIZED" ? "CUSTOMIZED" : "REGULAR";
}

export function schoolFormSteps(type: "REGULAR" | "CUSTOMIZED", mode: SchoolFormMode) {
  if (mode === "create" && type === "CUSTOMIZED") {
    return [...SCHOOL_FORM_STEPS, SCHOOL_FORM_RESOURCES_STEP] as const;
  }
  return SCHOOL_FORM_STEPS;
}

export function firstStepWithErrors(
  errors: SchoolFormErrors,
  from = 0,
  to = LAST_STEP,
): number {
  const lastFieldStep = SCHOOL_FORM_STEPS.length - 1;
  const end = Math.min(to, lastFieldStep);
  for (let index = from; index <= end; index++) {
    if (SCHOOL_FORM_STEPS[index]!.fields.some((field) => errors[field]?.length)) {
      return index;
    }
  }
  return -1;
}

/** Keeps keys with `undefined` so merging clears errors that were fixed. */
export function pickStepErrors(
  errors: SchoolFormErrors,
  from: number,
  to: number,
): SchoolFormErrors {
  const picked: SchoolFormErrors = {};
  const lastFieldStep = SCHOOL_FORM_STEPS.length - 1;
  for (const step of SCHOOL_FORM_STEPS.slice(from, Math.min(to, lastFieldStep) + 1)) {
    for (const field of step.fields) picked[field] = errors[field];
  }
  return picked;
}

export function getReachableStep(
  values: SchoolFormValues,
  mode: SchoolFormMode,
  type: "REGULAR" | "CUSTOMIZED" = asSchoolType(values.type),
): number {
  const steps = schoolFormSteps(type, mode);
  const last = steps.length - 1;
  const blocking = firstStepWithErrors(getFormErrors(values, mode));
  return blocking === -1 ? last : blocking;
}

/** A step can only be opened once every step before it is valid. */
export function resolveInitialStep(
  requested: string | null,
  values: SchoolFormValues,
  serverErrors: SchoolFormErrors,
  mode: SchoolFormMode,
): number {
  const type = asSchoolType(values.type);
  const steps = schoolFormSteps(type, mode);
  const serverErrorStep = firstStepWithErrors(serverErrors);
  if (serverErrorStep !== -1) return serverErrorStep;

  // Legacy bookmark `?step=classes` now maps to Programs & classes.
  const stepId = requested === "classes" ? "programs" : requested;
  const requestedStep = Math.max(
    steps.findIndex((step) => step.id === stepId),
    0,
  );
  return Math.min(requestedStep, getReachableStep(values, mode, type));
}
