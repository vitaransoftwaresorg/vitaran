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
    id: "programs",
    title: "Programs & classes",
    fields: ["offerings", "customProgramName", "customClasses"],
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
] as const satisfies readonly SchoolFormStep[];

export const STEP_SEARCH_PARAM = "step";
export const LAST_STEP = SCHOOL_FORM_STEPS.length - 1;

export function firstStepWithErrors(
  errors: SchoolFormErrors,
  from = 0,
  to = LAST_STEP,
): number {
  for (let index = from; index <= to; index++) {
    if (SCHOOL_FORM_STEPS[index].fields.some((field) => errors[field]?.length)) {
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
  for (const step of SCHOOL_FORM_STEPS.slice(from, to + 1)) {
    for (const field of step.fields) picked[field] = errors[field];
  }
  return picked;
}

export function getReachableStep(values: SchoolFormValues, mode: SchoolFormMode): number {
  const blocking = firstStepWithErrors(getFormErrors(values, mode));
  return blocking === -1 ? LAST_STEP : blocking;
}

/** A step can only be opened once every step before it is valid. */
export function resolveInitialStep(
  requested: string | null,
  values: SchoolFormValues,
  serverErrors: SchoolFormErrors,
  mode: SchoolFormMode,
): number {
  const serverErrorStep = firstStepWithErrors(serverErrors);
  if (serverErrorStep !== -1) return serverErrorStep;

  const requestedStep = Math.max(
    SCHOOL_FORM_STEPS.findIndex((step) => step.id === requested),
    0,
  );
  return Math.min(requestedStep, getReachableStep(values, mode));
}
