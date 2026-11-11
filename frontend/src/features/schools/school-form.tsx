"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Crop, ImagePlus, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  SCHOOL_BOARDS,
  SCHOOL_STATUSES,
  SCHOOL_TYPES,
  type SchoolDetail,
  type SchoolType,
} from "@/types/school";
import type { LearningProgram } from "@/types/program";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { smoothScrollToElement, useSmoothWheelScroll } from "@/hooks/use-smooth-scroll";
import {
  createSchoolAction,
  isEmailTakenAction,
  isSchoolCodeTakenAction,
  updateSchoolAction,
} from "./actions";
import {
  BOARD_LABELS,
  INDIAN_STATES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "./constants";
import { CustomSchoolProgramField } from "./custom-school-program-field";
import { schoolProgramsToTokens } from "./offerings";
import { ProgramOfferingsField } from "./program-offerings-field";
import {
  LAST_STEP,
  SCHOOL_FORM_STEPS,
  STEP_SEARCH_PARAM,
  firstStepWithErrors,
  getReachableStep,
  pickStepErrors,
  resolveInitialStep,
} from "./form-steps";
import { clearSchoolDraft, saveSchoolDraft, useSchoolDraft } from "./school-draft";
import { HintedInput } from "./hinted-input";
import { LogoCropper } from "./logo-cropper";
import { SchoolFormStepper } from "./school-form-stepper";
import {
  capitalizeWords,
  getEmailHint,
  getFormErrors,
  getPhoneHint,
  toPhoneDigits,
  readFormValues,
  sameFormValues,
  type SchoolFormErrors,
  type SchoolFormField,
  type SchoolFormMode,
  type SchoolFormState,
  type SchoolFormValues,
  type TextField,
} from "./schema";

type SchoolFormProps = { school?: SchoolDetail; catalog: LearningProgram[] };

const boardItems = SCHOOL_BOARDS.map((value) => ({ value, label: BOARD_LABELS[value] }));
const typeItems = SCHOOL_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));
const statusItems = SCHOOL_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));
const stateItems = INDIAN_STATES.map((value) => ({ value, label: value }));

const emailInput = { type: "email", getHint: getEmailHint } as const;

const EMAIL_TAKEN = "Email already exists";
const EMAIL_FIELDS = ["accountEmail", "contactEmail"] as const;
type EmailField = (typeof EMAIL_FIELDS)[number];
const EMAIL_CHECK_DELAY_MS = 400;
const normalizeEmail = (value = "") => value.trim().toLowerCase();
const CODE_TAKEN = "This school ID already exists";
const normalizeCode = (value = "") => value.trim().toUpperCase();

const phoneInput = {
  type: "tel",
  inputMode: "numeric",
  maxLength: 10,
  placeholder: "9876543210",
  getHint: getPhoneHint,
  sanitize: toPhoneDigits,
} as const;

const capitalized = {
  autoCapitalize: "words",
  onInput: (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const next = capitalizeWords(input.value);
    if (next === input.value) return;
    const { selectionStart, selectionEnd } = input;
    input.value = next;
    input.setSelectionRange(selectionStart, selectionEnd);
  },
};

// Pages are black and white; blue is reserved for the step connectors.
const NEUTRAL_THEME =
  "text-neutral-950 [--primary:var(--color-neutral-950)] [--primary-foreground:var(--color-white)] [--foreground:var(--color-neutral-950)] [--muted:var(--color-neutral-100)] [--muted-foreground:var(--color-neutral-500)] [--border:var(--color-neutral-200)] [--input:var(--color-neutral-300)] [--ring:var(--color-neutral-400)]";

const ROOMY_CONTROLS =
  "[&_[data-slot=input]]:h-10 [&_[data-slot=input]]:px-3 [&_[data-slot=select-trigger]]:h-10! [&_[data-slot=select-trigger]]:px-3";

// The edit page lists every section at once, so its headings need more weight.
const BOLD_SECTION_HEADINGS =
  "[&_[data-slot=section-heading]]:text-sm [&_[data-slot=section-heading]]:font-bold [&_[data-slot=section-heading]]:text-neutral-950";

function customOffering(school: SchoolDetail) {
  return (
    school.schoolPrograms.find((program) => program.type === "CUSTOMIZED") ??
    (school.type === "CUSTOMIZED" ? school.schoolPrograms[0] : undefined)
  );
}

function toFormValues(school?: SchoolDetail): SchoolFormValues {
  if (!school) {
    return {
      type: "REGULAR",
      status: "ACTIVE",
      offerings: [],
      customClasses: [],
    };
  }

  const custom = customOffering(school);

  return {
    code: school.code,
    name: school.name,
    board: school.board,
    type: school.type,
    status: school.status,
    offerings: schoolProgramsToTokens(
      school.schoolPrograms.filter((program) => (program.type ?? "REGULAR") === school.type),
    ),
    customProgramName: custom?.programName ?? (school.type === "CUSTOMIZED" ? school.name : ""),
    customClasses: custom?.classes.map((row) => String(row.classLevel)) ?? [],
    principalName: school.principalName ?? "",
    contactName: school.contactName,
    contactEmail: school.contactEmail,
    contactPhone: school.contactPhone,
    addressLine: school.addressLine,
    city: school.city,
    state: school.state,
    pincode: school.pincode,
    studentStrength: school.studentStrength?.toString() ?? "",
    notes: school.notes ?? "",
    accountEmail: school.accountEmail ?? "",
    accountPhone: school.accountPhone ?? "",
    password: school.password ?? "",
  };
}

export function SchoolForm({ school, catalog }: SchoolFormProps) {
  const router = useRouter();
  const keepDraft = !school;
  const draft = useSchoolDraft(keepDraft);
  const action = school
    ? updateSchoolAction.bind(null, school.id)
    : createSchoolAction;
  const [state, formAction, pending] = useActionState<SchoolFormState, FormData>(
    action,
    undefined,
  );

  useEffect(() => {
    if (state?.status === "success") {
      if (keepDraft) clearSchoolDraft();
      toast.success(school ? "School updated" : "School registered");
      router.replace(`/admin/schools/${state.schoolId}`);
    } else if (state?.status === "error" && state.message && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, school, keepDraft, router]);

  if (draft.loading) return <SchoolFormSkeleton />;

  const failed = state?.status === "error" ? state : undefined;
  const cancelHref = school ? `/admin/schools/${school.id}` : "/admin/schools";

  return (
    <SchoolFormWizard
      key={failed?.submittedAt ?? school?.updatedAt ?? "new"}
      mode={school ? "edit" : "create"}
      schoolId={school?.id}
      hasLogo={Boolean(school?.hasLogo)}
      logoVersion={school?.updatedAt}
      catalog={catalog}
      action={formAction}
      pending={pending}
      initialValues={failed?.values ?? draft.values ?? toFormValues(school)}
      savedValues={school ? toFormValues(school) : undefined}
      serverErrors={failed?.fieldErrors ?? {}}
      errorMessage={failed?.fieldErrors ? failed.message : undefined}
      cancelHref={cancelHref}
      onCancel={keepDraft ? clearSchoolDraft : undefined}
      onDraftChange={keepDraft ? saveSchoolDraft : undefined}
    />
  );
}

type SchoolFormWizardProps = {
  mode: SchoolFormMode;
  schoolId?: string;
  hasLogo?: boolean;
  /** Changes whenever the school is saved, so the browser fetches a replaced logo. */
  logoVersion?: string;
  catalog: LearningProgram[];
  action: (formData: FormData) => void;
  pending: boolean;
  initialValues: SchoolFormValues;
  /** The school as stored; edits only offer Save once the form differs from it. */
  savedValues?: SchoolFormValues;
  serverErrors: SchoolFormErrors;
  errorMessage?: string;
  cancelHref: string;
  onCancel?: () => void;
  onDraftChange?: (form: HTMLFormElement) => void;
};

function SchoolFormWizard({
  mode,
  schoolId,
  hasLogo = false,
  logoVersion,
  catalog,
  action,
  pending,
  initialValues,
  savedValues,
  serverErrors,
  errorMessage,
  cancelHref,
  onCancel,
  onDraftChange,
}: SchoolFormWizardProps) {
  const isEdit = mode === "edit";
  useSmoothWheelScroll(isEdit);
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  // Inputs are uncontrolled, so their defaults must stay fixed after mount;
  // the parent re-reads the saved draft on every render.
  const [values] = useState(initialValues);
  const [offerings, setOfferings] = useState(initialValues.offerings ?? []);
  const [customClasses, setCustomClasses] = useState(initialValues.customClasses ?? []);
  const [schoolType, setSchoolType] = useState<SchoolType>(
    initialValues.type === "CUSTOMIZED" ? "CUSTOMIZED" : "REGULAR",
  );
  const typeCatalog = catalog.filter((program) => (program.type ?? "REGULAR") === schoolType);
  const [step, setStep] = useState(() =>
    resolveInitialStep(searchParams.get(STEP_SEARCH_PARAM), values, serverErrors, mode),
  );
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [maxReached, setMaxReached] = useState(() => getReachableStep(values, mode));
  const [clientErrors, setClientErrors] = useState<SchoolFormErrors>({});
  const [takenEmails, setTakenEmails] = useState<string[]>([]);
  const [takenCodes, setTakenCodes] = useState<string[]>([]);
  const codeCheckTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [dirty, setDirty] = useState(
    () => !!savedValues && !sameFormValues(initialValues, savedValues),
  );
  const unsaved = useUnsavedChanges(isEdit && dirty, formRef);
  const emailCheckTimers = useRef<Partial<Record<EmailField, ReturnType<typeof setTimeout>>>>({});

  useEffect(() => {
    const timers = emailCheckTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      clearTimeout(codeCheckTimer.current);
    };
  }, []);

  useEffect(() => {
    if (schoolType !== "CUSTOMIZED") return;
    const programName = formRef.current?.elements.namedItem("customProgramName") as HTMLInputElement | null;
    const schoolName = formRef.current?.elements.namedItem("name") as HTMLInputElement | null;
    if (programName && !programName.value.trim() && schoolName?.value.trim()) {
      programName.value = capitalizeWords(schoolName.value.trim());
    }
  }, [schoolType]);

  const errors: SchoolFormErrors = { ...serverErrors, ...clientErrors };
  const isLast = step === LAST_STEP;

  // Replace (not push) so steps never add history entries: the browser and
  // header Back buttons leave the form, while the URL still restores the step.
  useEffect(() => {
    if (isEdit) return;
    const params = new URLSearchParams(window.location.search);
    params.set(STEP_SEARCH_PARAM, SCHOOL_FORM_STEPS[step].id);
    window.history.replaceState(null, "", `?${params}`);
  }, [step, isEdit]);

  const readValues = () => readFormValues(new FormData(formRef.current!));

  const validate = (formValues: SchoolFormValues) => {
    const formErrors = getFormErrors(formValues, mode);
    for (const field of EMAIL_FIELDS) {
      const email = normalizeEmail(formValues[field]);
      if (email && takenEmails.includes(email)) formErrors[field] = [EMAIL_TAKEN];
    }
    const code = normalizeCode(formValues.code);
    if (code && takenCodes.includes(code)) formErrors.code = [CODE_TAKEN];
    return formErrors;
  };

  const checkEmailTaken = (field: EmailField, value: string) => {
    clearTimeout(emailCheckTimers.current[field]);
    const email = normalizeEmail(value);
    if (getEmailHint(email)) return;
    if (takenEmails.includes(email)) {
      setClientErrors((prev) => ({ ...prev, [field]: [EMAIL_TAKEN] }));
      return;
    }

    emailCheckTimers.current[field] = setTimeout(async () => {
      const taken = await isEmailTakenAction(email, schoolId);
      if (!taken) return;
      setTakenEmails((prev) => [...prev, email]);
      const input = formRef.current?.elements.namedItem(field) as HTMLInputElement | null;
      if (normalizeEmail(input?.value) === email) {
        setClientErrors((prev) => ({ ...prev, [field]: [EMAIL_TAKEN] }));
      }
    }, EMAIL_CHECK_DELAY_MS);
  };

  /** Only speaks up when the ID is taken; a free ID shows nothing. */
  const checkCodeTaken = (value: string) => {
    clearTimeout(codeCheckTimer.current);
    const code = normalizeCode(value);
    if (!code) return;
    if (takenCodes.includes(code)) {
      setClientErrors((prev) => ({ ...prev, code: [CODE_TAKEN] }));
      return;
    }
    codeCheckTimer.current = setTimeout(async () => {
      const taken = await isSchoolCodeTakenAction(code, schoolId);
      if (!taken) return;
      setTakenCodes((prev) => [...prev, code]);
      const input = formRef.current?.elements.namedItem("code") as HTMLInputElement | null;
      if (normalizeCode(input?.value) === code) setClientErrors((prev) => ({ ...prev, code: [CODE_TAKEN] }));
    }, EMAIL_CHECK_DELAY_MS);
  };

  const saveDraft = () => {
    if (onDraftChange && formRef.current) onDraftChange(formRef.current);
  };

  const updateDirty = () => {
    if (savedValues && formRef.current) setDirty(!sameFormValues(readValues(), savedValues));
  };

  // Base UI updates its hidden inputs after the change callback returns.
  const saveDraftSoon = () =>
    setTimeout(() => {
      saveDraft();
      updateDirty();
    });

  const scrollToFirstInvalid = () =>
    requestAnimationFrame(() => {
      const invalidField = formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]");
      if (!invalidField) return;
      smoothScrollToElement(invalidField);
      invalidField.focus({ preventScroll: true });
    });

  const showStep = (index: number) => {
    setDirection(index >= step ? "next" : "prev");
    setStep(index);
    setMaxReached((max) => Math.max(max, index));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goToStep = (target: number) => {
    saveDraft();
    if (target <= step) return showStep(target);

    const formErrors = validate(readValues());
    const blocking = firstStepWithErrors(formErrors, step, target - 1);
    const validatedUpTo = blocking === -1 ? target - 1 : blocking;

    setClientErrors((prev) => ({
      ...prev,
      ...pickStepErrors(formErrors, step, validatedUpTo),
    }));
    showStep(blocking === -1 ? target : blocking);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (isEdit) {
      if (!dirty) {
        event.preventDefault();
        return;
      }
      const formErrors = validate(readValues());
      if (Object.keys(formErrors).length > 0) {
        event.preventDefault();
        setClientErrors(formErrors);
        scrollToFirstInvalid();
      }
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent = submitter?.dataset.intent ?? (isLast ? "submit" : "next");

    if (intent === "next") {
      event.preventDefault();
      goToStep(step + 1);
      return;
    }

    const formErrors = validate(readValues());
    const blocking = firstStepWithErrors(formErrors);
    if (blocking !== -1) {
      event.preventDefault();
      setClientErrors(pickStepErrors(formErrors, 0, blocking));
      showStep(blocking);
    }
  };

  const handleChange = (event: FormEvent<HTMLFormElement>) => {
    saveDraft();
    updateDirty();
    const field = (event.target as HTMLInputElement).name as SchoolFormField;
    if (!errors[field]) return;
    const fieldErrors = validate(readValues())[field];
    setClientErrors((prev) => ({ ...prev, [field]: fieldErrors }));
  };

  const fieldProps = (name: TextField) => ({
    id: name,
    name,
    defaultValue: values[name],
    "aria-invalid": errors[name] ? true : undefined,
  });

  const error = (name: SchoolFormField) =>
    errors[name] ? <FieldError>{errors[name]?.[0]}</FieldError> : null;

  const invalid = (name: SchoolFormField) => (errors[name] ? true : undefined);

  // Editing shows every section on one page; registering goes step by step.
  const panel = (index: number) =>
    isEdit
      ? { hidden: false, className: "space-y-6" }
      : {
          hidden: step !== index,
          className: cn(
            "space-y-6",
            direction === "next" ? "animate-step-in-next" : "animate-step-in-prev",
          ),
        };

  return (
    <>
    <Form
      ref={formRef}
      action={action}
      onSubmit={handleSubmit}
      onChange={handleChange}
      noValidate
      className={cn(
        "scroll-mt-20 space-y-4",
        NEUTRAL_THEME,
        ROOMY_CONTROLS,
        isEdit && BOLD_SECTION_HEADINGS,
      )}
    >
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* `overflow-clip` (not hidden) keeps the sticky edit footer working. */}
      <div className="overflow-clip rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {!isEdit && (
          <div className="border-b border-neutral-200 px-5 py-5 md:px-8">
            <SchoolFormStepper
              steps={SCHOOL_FORM_STEPS}
              current={step}
              reachable={Math.max(maxReached, step)}
              onSelect={goToStep}
            />
          </div>
        )}

        <div className="overflow-clip">
          <div className={cn("p-5 md:p-8", isEdit && "space-y-8")}>
            <div {...panel(0)}>
              {isEdit && <SectionHeading>School details</SectionHeading>}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                <Field data-invalid={invalid("code")} className="md:col-span-1 lg:col-span-2">
                  <FieldLabel htmlFor="code">School ID *</FieldLabel>
                  <Input
                    {...fieldProps("code")}
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="numeric"
                    placeholder="e.g. 1018"
                    onInput={(event) => checkCodeTaken(event.currentTarget.value)}
                    className="font-mono"
                  />
                  {error("code")}
                </Field>

                <Field data-invalid={invalid("name")} className="md:col-span-2 lg:col-span-4">
                  <FieldLabel htmlFor="name" className="capitalize">School name *</FieldLabel>
                  <Input {...fieldProps("name")} {...capitalized} autoComplete="organization" placeholder="e.g. Delhi Public School, Banjara Hills" />
              {error("name")}
            </Field>

            <SchoolLogoField
              schoolId={schoolId}
              hasLogo={hasLogo}
              logoVersion={logoVersion}
              error={errors.logo?.[0]}
              onDirty={() => {
                if (isEdit) setDirty(true);
              }}
              onClearError={() =>
                setClientErrors((prev) => {
                  const next = { ...prev };
                  delete next.logo;
                  return next;
                })
              }
            />

            <Field data-invalid={invalid("board")}>
              <FieldLabel htmlFor="board">Board *</FieldLabel>
                  <Select name="board" items={boardItems} defaultValue={values.board ?? null} onValueChange={saveDraftSoon}>
                <SelectTrigger id="board" className="w-full" aria-invalid={invalid("board")}>
                  <SelectValue placeholder="Select a board" />
                </SelectTrigger>
                <SelectContent>
                  {boardItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error("board")}
            </Field>

                <Field data-invalid={invalid("type")}>
                  <FieldLabel htmlFor="type">Type *</FieldLabel>
                  <Select
                    name="type"
                    items={typeItems}
                    defaultValue={values.type ?? "REGULAR"}
                    onValueChange={(next) => {
                      const type = next as SchoolType;
                      setSchoolType(type);
                      setOfferings([]);
                      saveDraftSoon();
                    }}
                  >
                    <SelectTrigger id="type" className="w-full" aria-invalid={invalid("type")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {error("type")}
            </Field>

            <Field data-invalid={invalid("status")}>
              <FieldLabel htmlFor="status">Status *</FieldLabel>
                  <Select name="status" items={statusItems} defaultValue={values.status ?? "ACTIVE"} onValueChange={saveDraftSoon}>
                <SelectTrigger id="status" className="w-full" aria-invalid={invalid("status")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error("status")}
            </Field>

                <Field data-invalid={invalid("principalName")} className="lg:col-span-3">
              <FieldLabel htmlFor="principalName">Principal name</FieldLabel>
                  <Input {...fieldProps("principalName")} {...capitalized} placeholder="Optional" />
              {error("principalName")}
            </Field>

                <Field data-invalid={invalid("studentStrength")} className="lg:col-span-3">
              <FieldLabel htmlFor="studentStrength">Student strength</FieldLabel>
              <Input {...fieldProps("studentStrength")} inputMode="numeric" placeholder="e.g. 1200" />
              {error("studentStrength")}
            </Field>
              </div>

              <FormSection title="Sign-in details">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field data-invalid={invalid("accountEmail")}>
                    <FieldLabel htmlFor="accountEmail">School email *</FieldLabel>
                    <HintedInput
                      {...fieldProps("accountEmail")}
                      {...emailInput}
                      error={error("accountEmail")}
                      onInput={(event) => checkEmailTaken("accountEmail", event.currentTarget.value)}
                      autoComplete="off"
                      placeholder="school@example.com"
                    />
                  </Field>
                  <Field data-invalid={invalid("accountPhone")}>
                    <FieldLabel htmlFor="accountPhone">School phone number *</FieldLabel>
                    <HintedInput {...fieldProps("accountPhone")} {...phoneInput} error={error("accountPhone")} autoComplete="off" />
                </Field>
                  <Field data-invalid={invalid("password")}>
                    <FieldLabel htmlFor="password">
                      {isEdit ? "Password" : "Password *"}
              </FieldLabel>
                    <Input
                      {...fieldProps("password")}
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={isEdit ? "Set a password" : undefined}
                    />
                    {error("password")}
                  </Field>
                </div>
              </FormSection>
            </div>

            <div {...panel(1)}>
              <FormSection title="Programs & classes">
                <p className="-mt-1 text-sm text-neutral-500">
                  {schoolType === "CUSTOMIZED"
                    ? "Enter the program name and select classes. Subjects follow the regular catalog (1–5 Science, 6–10 Physics / Chemistry / Biology)."
                    : "Select a program, then check the classes this school offers."}
                </p>
                {schoolType === "CUSTOMIZED" ? (
                  <CustomSchoolProgramField
                    name={values.customProgramName ?? ""}
                    classes={customClasses}
                    onClassesChange={(next) => {
                      setCustomClasses(next);
                      if (savedValues) {
                        setDirty(
                          !sameFormValues({ ...readValues(), customClasses: next }, savedValues),
                        );
                      }
                      saveDraftSoon();
                    }}
                    errors={{
                      customProgramName: errors.customProgramName?.[0],
                      customClasses: errors.customClasses?.[0],
                    }}
                  />
                ) : (
                  <ProgramOfferingsField
                    key={schoolType}
                    catalog={typeCatalog}
                    value={offerings}
                    onChange={(next) => {
                      setOfferings(next);
                      if (savedValues) {
                        setDirty(!sameFormValues({ ...readValues(), offerings: next }, savedValues));
                      }
                      saveDraftSoon();
                    }}
                    error={errors.offerings?.[0]}
                  />
                )}
              </FormSection>
            </div>

            <div {...panel(2)}>
              <FormSection title="Contact person">
                <div className="grid gap-4 md:grid-cols-3">
            <Field data-invalid={invalid("contactName")}>
              <FieldLabel htmlFor="contactName">Full name *</FieldLabel>
                    <Input {...fieldProps("contactName")} {...capitalized} autoComplete="name" />
              {error("contactName")}
            </Field>
            <Field data-invalid={invalid("contactEmail")}>
              <FieldLabel htmlFor="contactEmail">Email *</FieldLabel>
                    <HintedInput
                      {...fieldProps("contactEmail")}
                      {...emailInput}
                      error={error("contactEmail")}
                      onInput={(event) => checkEmailTaken("contactEmail", event.currentTarget.value)}
                      autoComplete="email"
                      placeholder="name@example.com"
                    />
            </Field>
            <Field data-invalid={invalid("contactPhone")}>
              <FieldLabel htmlFor="contactPhone">Phone *</FieldLabel>
                    <HintedInput {...fieldProps("contactPhone")} {...phoneInput} error={error("contactPhone")} autoComplete="tel" />
            </Field>
                </div>
              </FormSection>

              <FormSection title="Address">
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Field data-invalid={invalid("addressLine")} className="md:col-span-3">
              <FieldLabel htmlFor="addressLine">Street address *</FieldLabel>
                    <Input {...fieldProps("addressLine")} {...capitalized} autoComplete="street-address" />
              {error("addressLine")}
            </Field>
            <Field data-invalid={invalid("city")}>
              <FieldLabel htmlFor="city">City *</FieldLabel>
                    <Input {...fieldProps("city")} {...capitalized} autoComplete="address-level2" />
              {error("city")}
            </Field>
            <Field data-invalid={invalid("state")}>
              <FieldLabel htmlFor="state">State *</FieldLabel>
                    <Select name="state" items={stateItems} defaultValue={values.state || null} onValueChange={saveDraftSoon}>
                <SelectTrigger id="state" className="w-full" aria-invalid={invalid("state")}>
                  <SelectValue placeholder="Select a state" />
                </SelectTrigger>
                <SelectContent>
                  {stateItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error("state")}
            </Field>
            <Field data-invalid={invalid("pincode")}>
              <FieldLabel htmlFor="pincode">Pincode *</FieldLabel>
              <Input {...fieldProps("pincode")} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
              {error("pincode")}
            </Field>
                </div>
              </FormSection>

              <FormSection title="Internal notes">
          <Field data-invalid={invalid("notes")}>
                  <Textarea {...fieldProps("notes")} rows={3} aria-label="Internal notes" placeholder="Optional. Not visible to the school." />
            {error("notes")}
          </Field>
              </FormSection>
            </div>
          </div>

          {isEdit ? (
            <footer className="sticky bottom-0 z-10 flex min-h-17 items-center justify-between gap-2 border-t border-neutral-200 bg-white/95 px-5 py-3 backdrop-blur md:px-8">
          <Link
                href={cancelHref}
                className={buttonVariants({ variant: "ghost" })}
                onClick={unsaved.guardCancelClick(cancelHref)}
          >
            Cancel
          </Link>
              {dirty && (
                <Button
                  type="submit"
                  disabled={pending}
                  className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
                >
                  {pending ? <Loader2 className="animate-spin" /> : <Save />}
                  Save changes
                </Button>
              )}
            </footer>
          ) : (
          <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-4 md:px-8">
            <Link href={cancelHref} onClick={onCancel} className={buttonVariants({ variant: "ghost" })}>
              Cancel
            </Link>
            <div className="flex gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => goToStep(step - 1)}>
                  <ArrowLeft />
                  Back
                </Button>
              )}
              {!isLast && (
                <Button type="submit" data-intent="next">
                  Continue
                  <ArrowRight />
                </Button>
              )}
              {isLast && (
                <Button type="submit" data-intent="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
                  Register school
          </Button>
              )}
            </div>
          </footer>
          )}
        </div>
        </div>
    </Form>
    {unsaved.dialog}
    </>
  );
}

function SchoolLogoField({
  schoolId,
  hasLogo,
  logoVersion,
  error,
  onDirty,
  onClearError,
}: {
  schoolId?: string;
  hasLogo: boolean;
  logoVersion?: string;
  error?: string;
  onDirty?: () => void;
  onClearError: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  /** The uncropped image, so Crop can be redone from the full picture. */
  const [original, setOriginal] = useState<{ url: string; name: string } | null>(null);
  const [cropping, setCropping] = useState<string | null>(null);

  const existingSrc =
    schoolId && hasLogo && !removeLogo && !preview
      ? `/admin/schools/${schoolId}/logo${logoVersion ? `?v=${encodeURIComponent(logoVersion)}` : ""}`
      : null;
  const shownSrc = preview ?? existingSrc;

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const originalUrl = original?.url;
  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  function applyCrop(file: File) {
    const input = inputRef.current;
    if (input) {
      const files = new DataTransfer();
      files.items.add(file);
      input.files = files.files;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setFileName(original?.name ?? file.name);
    setRemoveLogo(false);
    setCropping(null);
    onDirty?.();
    onClearError();
  }

  function cancelCrop() {
    // A new pick that was never cropped is dropped, so the old logo stays.
    if (!preview && inputRef.current) inputRef.current.value = "";
    if (!preview) setOriginal(null);
    setCropping(null);
  }

  return (
    <Field data-invalid={error ? true : undefined} className="md:col-span-2 lg:col-span-6">
      <FieldLabel htmlFor="logo">School logo</FieldLabel>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-neutral-50">
          {shownSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob / auth-proxied logo
            <img src={shownSrc} alt="School logo preview" className="size-full object-contain p-1" />
          ) : (
            <ImagePlus className="size-7 text-neutral-400" strokeWidth={1.75} />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              if (!file) return;
              if (preview) URL.revokeObjectURL(preview);
              setPreview(null);
              const url = URL.createObjectURL(file);
              setOriginal({ url, name: file.name });
              setCropping(url);
            }}
          />
          {removeLogo ? <input type="hidden" name="removeLogo" value="1" /> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="size-3.5" />
              {shownSrc ? "Replace logo" : "Upload logo"}
            </Button>
            {shownSrc ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCropping(original?.url ?? shownSrc)}
              >
                <Crop className="size-3.5" />
                Crop
              </Button>
            ) : null}
            {shownSrc ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-neutral-600"
                onClick={() => {
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(null);
                  setFileName("");
                  setOriginal(null);
                  if (inputRef.current) inputRef.current.value = "";
                  if (hasLogo) setRemoveLogo(true);
                  onDirty?.();
                  onClearError();
                }}
              >
                <X className="size-3.5" />
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-neutral-500">
            {fileName
              ? fileName
              : removeLogo
                ? "Logo will be removed on save"
                : "PNG, JPEG, or WebP · max 2 MB"}
          </p>
        </div>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <LogoCropper src={cropping} onCancel={cancelCrop} onCrop={applyCrop} />
    </Field>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3
      data-slot="section-heading"
      className="border-b border-neutral-200 pb-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase"
    >
      {children}
    </h3>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

function SchoolFormSkeleton() {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-neutral-200 bg-white", NEUTRAL_THEME)}>
      <div className="border-b border-neutral-200 px-5 py-5 md:px-8">
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="space-y-4 p-5 md:p-8">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
