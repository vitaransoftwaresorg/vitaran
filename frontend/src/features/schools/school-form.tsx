"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
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
  type Subject,
} from "@/types/school";
import type { HeadOfficeListItem } from "@/types/head-office";
import type { LearningProgram } from "@/types/program";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { smoothScrollToElement, useSmoothWheelScroll } from "@/hooks/use-smooth-scroll";
import {
  createSchoolAction,
  isEmailTakenAction,
  isSchoolCodeTakenAction,
  updateSchoolAction,
  updateSchoolTypeAction,
} from "./actions";
import {
  BOARD_LABELS,
  INDIAN_STATES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "./constants";
import {
  AdminSchoolClassesPanel,
  type DeferredClassChanges,
  type DeferredClassCreate,
} from "./admin-school-classes-panel";
import {
  CUSTOM_DRAFT_PROGRAM_ID,
  catalogProgramsForForm,
  liveOfferingsFromForm,
  parseOfferingToken,
  pickRegularProgramForClass,
  replaceClassSubjectOfferings,
  schoolProgramsToTokens,
  seedRegularOfferingTokens,
} from "./offerings";
import {
  SCHOOL_FORM_STEPS,
  STEP_SEARCH_PARAM,
  firstStepWithErrors,
  getReachableStep,
  pickStepErrors,
  resolveInitialStep,
  schoolFormSteps,
} from "./form-steps";
import { StudentResourcesStep } from "./student-resources-step";
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
import type { ClassOrganization } from "@/types/section";
import type { SchoolStudentCounts } from "@/types/student";
import type { ClassTeacherSlot } from "@/types/teacher";

type SchoolClassesPanelData = {
  organization: ClassOrganization;
  classTeacherSlots: ClassTeacherSlot[];
  seatsUsedLabel: string;
  teachersHref: string;
  /** School total strength budget — class/section seats cannot exceed this. */
  strength?: { studentStrength: number | null; used: number };
  /** ACTIVE roster counts — same list Students / Results use (not seat capacity). */
  rosterCounts?: SchoolStudentCounts | null;
};

type SchoolFormProps = {
  school?: SchoolDetail;
  catalog: LearningProgram[];
  headOffices?: HeadOfficeListItem[];
  /** Existing classes on edit; register keeps new classes until Submit. */
  classesPanel?: SchoolClassesPanelData;
};

const HEAD_OFFICE_NONE = "__none__";

const boardItems = SCHOOL_BOARDS.map((value) => ({ value, label: BOARD_LABELS[value] }));
const typeItems = SCHOOL_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));
const statusItems = SCHOOL_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));
const stateItems = INDIAN_STATES.map((value) => ({ value, label: value }));

function headOfficeSelectItems(offices: HeadOfficeListItem[]) {
  return [
    { value: HEAD_OFFICE_NONE, label: "None" },
    ...[...offices]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((office) => ({
        value: office.id,
        label: `${office.name} (${office.code})`,
      })),
  ];
}

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
      headOfficeId: HEAD_OFFICE_NONE,
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
    customProgramName:
      custom?.programName &&
      custom.programName.trim().toLowerCase() !== school.name.trim().toLowerCase()
        ? custom.programName
        : "",
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
    headOfficeId: school.headOfficeId ?? HEAD_OFFICE_NONE,
  };
}

export function SchoolForm({ school, catalog, headOffices = [], classesPanel }: SchoolFormProps) {
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
      key={failed?.submittedAt ?? school?.id ?? "new"}
      mode={school ? "edit" : "create"}
      schoolId={school?.id}
      hasLogo={Boolean(school?.hasLogo)}
      logoVersion={school?.updatedAt}
      catalog={catalog}
      headOffices={headOffices}
      schoolPrograms={school?.schoolPrograms}
      classesPanel={classesPanel}
      action={formAction}
      pending={pending}
      initialValues={failed?.values ?? draft.values ?? toFormValues(school)}
      initialClassCreates={keepDraft ? draft.pendingSectionCreates : []}
      initialClassDeletes={keepDraft ? draft.pendingSectionDeletes : []}
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
  headOffices?: HeadOfficeListItem[];
  schoolPrograms?: SchoolDetail["schoolPrograms"];
  classesPanel?: SchoolClassesPanelData;
  action: (formData: FormData) => void;
  pending: boolean;
  initialValues: SchoolFormValues;
  initialClassCreates?: DeferredClassCreate[];
  initialClassDeletes?: string[];
  /** The school as stored; edits only offer Save once the form differs from it. */
  savedValues?: SchoolFormValues;
  serverErrors: SchoolFormErrors;
  errorMessage?: string;
  cancelHref: string;
  onCancel?: () => void;
  onDraftChange?: (
    form: HTMLFormElement,
    classDrafts?: { creates: DeferredClassCreate[]; deleteSectionIds: string[] },
  ) => void;
};

function SchoolFormWizard({
  mode,
  schoolId,
  hasLogo = false,
  logoVersion,
  catalog,
  headOffices = [],
  schoolPrograms = [],
  classesPanel,
  action,
  pending,
  initialValues,
  initialClassCreates = [],
  initialClassDeletes = [],
  savedValues,
  serverErrors,
  errorMessage,
  cancelHref,
  onCancel,
  onDraftChange,
}: SchoolFormWizardProps) {
  const isEdit = mode === "edit";
  useSmoothWheelScroll(isEdit);
  const router = useRouter();
  const [typePending, startTypeTransition] = useTransition();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  // Inputs are uncontrolled, so their defaults must stay fixed after mount;
  // the parent re-reads the saved draft on every render.
  const [values] = useState(initialValues);
  const [schoolType, setSchoolType] = useState<SchoolType>(
    initialValues.type === "CUSTOMIZED" ? "CUSTOMIZED" : "REGULAR",
  );
  const [customProgramName, setCustomProgramName] = useState(
    () => (initialValues.customProgramName ?? "").trim(),
  );
  const customProgramId =
    schoolPrograms.find((row) => row.type === "CUSTOMIZED")?.programId ??
    CUSTOM_DRAFT_PROGRAM_ID;
  const [customClasses, setCustomClasses] = useState(initialValues.customClasses ?? []);
  const [offerings, setOfferings] = useState(() => {
    const initial = initialValues.offerings ?? [];
    if (initialValues.type !== "CUSTOMIZED") return initial;
    // Customized schools keep regular catalog tokens only.
    return initial.filter((token) => {
      const parsed = parseOfferingToken(token);
      if (!parsed || parsed.programId === CUSTOM_DRAFT_PROGRAM_ID) return false;
      const enrolled = schoolPrograms.find((row) => row.programId === parsed.programId);
      return (enrolled?.type ?? "REGULAR") !== "CUSTOMIZED";
    });
  });
  const [classDrafts, setClassDrafts] = useState<DeferredClassChanges>({
    creates: initialClassCreates,
    deleteSectionIds: initialClassDeletes,
  });
  const classDraftsRef = useRef(classDrafts);
  classDraftsRef.current = classDrafts;
  const classDraftsDirty =
    classDrafts.creates.length > 0 || classDrafts.deleteSectionIds.length > 0;
  /** Regular catalog is always available; customized schools also get their own program. */
  const regularCatalog = catalog.filter((program) => (program.type ?? "REGULAR") === "REGULAR");
  const typeCatalog = schoolType === "CUSTOMIZED" ? regularCatalog : regularCatalog;
  const headOfficeItems = useMemo(() => headOfficeSelectItems(headOffices), [headOffices]);
  const liveSchoolPrograms = useMemo(
    () =>
      liveOfferingsFromForm({
        schoolType,
        offerings,
        customClasses,
        customProgramName,
        catalog: typeCatalog,
        savedPrograms: schoolPrograms,
      }),
    [schoolType, offerings, customClasses, customProgramName, typeCatalog, schoolPrograms],
  );
  /** Regular catalog only — customized schools do not get a per-school LearningProgram. */
  const panelSchoolPrograms = useMemo(
    () => catalogProgramsForForm(typeCatalog, liveSchoolPrograms, schoolPrograms),
    [typeCatalog, liveSchoolPrograms, schoolPrograms],
  );
  const [step, setStep] = useState(() =>
    resolveInitialStep(searchParams.get(STEP_SEARCH_PARAM), values, serverErrors, mode),
  );
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [maxReached, setMaxReached] = useState(() => getReachableStep(values, mode));
  const [clientErrors, setClientErrors] = useState<SchoolFormErrors>({});
  const [takenEmails, setTakenEmails] = useState<string[]>([]);
  const [takenCodes, setTakenCodes] = useState<string[]>([]);
  const codeCheckTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [formDirty, setFormDirty] = useState(
    () => !!savedValues && !sameFormValues(initialValues, savedValues),
  );
  const dirty = formDirty || classDraftsDirty;
  const unsaved = useUnsavedChanges(dirty, formRef);
  const emailCheckTimers = useRef<Partial<Record<EmailField, ReturnType<typeof setTimeout>>>>({});
  const emptyOrganization = useMemo<ClassOrganization>(
    () => ({ wholeClasses: [], sections: [] }),
    [],
  );
  /**
   * Remap class rows onto the live program list so dropdowns never show a stale
   * custom program UUID after Customized ↔ Regular flips.
   */
  const panelOrganization = useMemo(() => {
    const org = classesPanel?.organization ?? emptyOrganization;
    const byId = new Map(panelSchoolPrograms.map((row) => [row.programId, row]));
    function remapRow<T extends {
      programId: string;
      programCode: string;
      programName: string;
      classLevel: number;
    }>(row: T): T {
      const exact = byId.get(row.programId);
      if (exact) {
        return {
          ...row,
          programCode: exact.programCode,
          programName: exact.programName || row.programName,
        };
      }
      // Stale custom draft id → live customized program.
      if (row.programId === CUSTOM_DRAFT_PROGRAM_ID) {
        const custom = panelSchoolPrograms.find((program) => program.type === "CUSTOMIZED");
        if (custom) {
          return {
            ...row,
            programId: custom.programId,
            programCode: custom.programCode,
            programName: custom.programName,
          };
        }
      }
      const covering = panelSchoolPrograms
        .filter(
          (program) =>
            program.classes.some((cls) => cls.classLevel === row.classLevel) ||
            (row.classLevel >= program.classFrom && row.classLevel <= program.classTo),
        )
        .sort(
          (a, b) =>
            a.classTo - a.classFrom - (b.classTo - b.classFrom) ||
            a.programName.localeCompare(b.programName),
        );
      const pick = covering[0];
      if (!pick) return row;
      return {
        ...row,
        programId: pick.programId,
        programCode: pick.programCode,
        programName: pick.programName,
      };
    }
    return {
      wholeClasses: org.wholeClasses.map(remapRow),
      sections: org.sections.map(remapRow),
    };
  }, [classesPanel?.organization, emptyOrganization, panelSchoolPrograms]);

  // If type is already Customized but class picks are empty, seed from existing roster rows.
  useEffect(() => {
    if (schoolType !== "CUSTOMIZED") return;
    if (customClasses.length > 0) return;
    const org = classesPanel?.organization ?? emptyOrganization;
    const levels = [
      ...new Set([
        ...org.wholeClasses.map((row) => row.classLevel),
        ...org.sections.map((row) => row.classLevel),
        ...classDraftsRef.current.creates.map((row) => row.classLevel),
      ]),
    ]
      .filter((level) => Number.isInteger(level) && level >= 1 && level <= 12)
      .sort((a, b) => a - b);
    if (levels.length === 0) return;
    const sourceTokens =
      offerings.length > 0
        ? offerings
        : schoolProgramsToTokens(
            schoolPrograms.filter((row) => (row.type ?? "REGULAR") === "REGULAR"),
          );
    const regularTokens = sourceTokens.filter((token) => {
      const parsed = parseOfferingToken(token);
      return parsed != null && parsed.programId !== CUSTOM_DRAFT_PROGRAM_ID;
    });
    setCustomClasses(levels.map(String));
    setOfferings(regularTokens);
    // Run once when Customized + empty class picks; avoid looping on offerings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolType]);

  useEffect(() => {
    const timers = emailCheckTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      clearTimeout(codeCheckTimer.current);
    };
  }, []);

  const errors: SchoolFormErrors = { ...serverErrors, ...clientErrors };
  const formSteps = schoolFormSteps(schoolType, mode);
  const lastStep = formSteps.length - 1;
  const isLast = step === lastStep;

  // Drop off the resources step when switching away from Customized.
  useEffect(() => {
    if (isEdit) return;
    if (schoolType !== "CUSTOMIZED" && step > SCHOOL_FORM_STEPS.length - 1) {
      setStep(SCHOOL_FORM_STEPS.length - 1);
    }
  }, [schoolType, step, isEdit]);

  // Replace (not push) so steps never add history entries: the browser and
  // header Back buttons leave the form, while the URL still restores the step.
  useEffect(() => {
    if (isEdit) return;
    const params = new URLSearchParams(window.location.search);
    params.set(STEP_SEARCH_PARAM, formSteps[step]?.id ?? SCHOOL_FORM_STEPS[0].id);
    window.history.replaceState(null, "", `?${params}`);
  }, [step, isEdit, schoolType, mode]);

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
    if (onDraftChange && formRef.current) {
      onDraftChange(formRef.current, {
        creates: classDraftsRef.current.creates,
        deleteSectionIds: classDraftsRef.current.deleteSectionIds,
      });
    }
  };

  // Keep added classes in session draft so refresh does not wipe them.
  useEffect(() => {
    if (!onDraftChange || !formRef.current) return;
    onDraftChange(formRef.current, {
      creates: classDrafts.creates,
      deleteSectionIds: classDrafts.deleteSectionIds,
    });
  }, [classDrafts, onDraftChange]);

  const updateDirty = () => {
    if (!formRef.current) return;
    const baseline = savedValues ?? values;
    setFormDirty(!sameFormValues(readValues(), baseline));
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
        return;
      }
      unsaved.markClean();
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
      return;
    }
    unsaved.markClean();
  };

  const handleChange = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as HTMLInputElement;
    // Programs & classes checkboxes update dirty/draft in their own handlers.
    // Re-running form-wide dirty here makes those clicks feel tied to Classes & sections.
    if (
      target.type === "checkbox" &&
      (!target.name || target.name === "customClasses" || target.name === "offerings")
    ) {
      return;
    }
    saveDraft();
    updateDirty();
    const field = target.name as SchoolFormField;
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
              steps={formSteps}
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
                  <Input
                    {...fieldProps("name")}
                    autoCapitalize="words"
                    autoComplete="organization"
                    placeholder="e.g. Delhi Public School, Banjara Hills"
                    onInput={(event) => {
                      const input = event.currentTarget;
                      const next = capitalizeWords(input.value);
                      if (next !== input.value) {
                        const { selectionStart, selectionEnd } = input;
                        input.value = next;
                        input.setSelectionRange(selectionStart, selectionEnd);
                      }
                      saveDraftSoon();
                    }}
                  />
              {error("name")}
                </Field>

            <SchoolLogoField
              schoolId={schoolId}
              hasLogo={hasLogo}
              logoVersion={logoVersion}
              error={errors.logo?.[0]}
              onDirty={() => {
                if (isEdit) setFormDirty(true);
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
                    value={schoolType}
                    disabled={typePending || pending}
                    onValueChange={(next) => {
                      if (next == null) return;
                      const type = next as SchoolType;
                      const previousType = schoolType;
                      if (type === previousType) return;

                      const applyLocalType = (nextType: SchoolType) => {
                        setSchoolType(nextType);
                        if (nextType === "CUSTOMIZED") {
                          // Keep regular catalog offerings only — no per-school LearningProgram.
                          const regularTokens =
                            offerings.length > 0
                              ? offerings.filter((token) => {
                                  const parsed = parseOfferingToken(token);
                                  return (
                                    parsed != null &&
                                    parsed.programId !== CUSTOM_DRAFT_PROGRAM_ID
                                  );
                                })
                              : schoolProgramsToTokens(
                                  schoolPrograms.filter(
                                    (row) => (row.type ?? "REGULAR") === "REGULAR",
                                  ),
                                );
                          const org = classesPanel?.organization ?? emptyOrganization;
                          const levels = [
                            ...new Set([
                              ...org.wholeClasses.map((row) => row.classLevel),
                              ...org.sections.map((row) => row.classLevel),
                              ...classDraftsRef.current.creates.map((row) => row.classLevel),
                            ]),
                          ]
                            .filter((level) => Number.isInteger(level) && level >= 1 && level <= 12)
                            .sort((a, b) => a - b);
                          setCustomClasses(levels.map(String));
                          setOfferings(regularTokens);
                          setClassDrafts((prev) => ({
                            ...prev,
                            creates: prev.creates.map((row) => {
                              if (row.programId !== CUSTOM_DRAFT_PROGRAM_ID) return row;
                              const pick = pickRegularProgramForClass(regularCatalog, row.classLevel);
                              if (!pick) return row;
                              return {
                                ...row,
                                programId: pick.id,
                                programName: pick.name,
                              };
                            }),
                          }));
                        } else {
                          // Customized → Regular: seed Regular catalog offerings from current classes.
                          const org = classesPanel?.organization ?? emptyOrganization;
                          const subjectsByClass = new Map<number, Subject[]>();
                          for (const token of offerings) {
                            const parsed = parseOfferingToken(token);
                            if (!parsed) continue;
                            const list = subjectsByClass.get(parsed.classLevel) ?? [];
                            if (!list.includes(parsed.subject)) list.push(parsed.subject);
                            subjectsByClass.set(parsed.classLevel, list);
                          }
                          const levels = [
                            ...new Set([
                              ...org.wholeClasses.map((row) => row.classLevel),
                              ...org.sections.map((row) => row.classLevel),
                              ...customClasses.map(Number),
                              ...classDraftsRef.current.creates.map((row) => row.classLevel),
                              ...[...subjectsByClass.keys()],
                            ]),
                          ]
                            .filter((level) => Number.isInteger(level) && level >= 1 && level <= 12)
                            .sort((a, b) => a - b);
                          const regularCatalog = catalog.filter(
                            (program) => (program.type ?? "REGULAR") === "REGULAR",
                          );
                          const nextOfferings = seedRegularOfferingTokens(
                            regularCatalog,
                            levels,
                            subjectsByClass,
                          );
                          setOfferings(nextOfferings);
                          setCustomClasses([]);
                          setClassDrafts((prev) => ({
                            ...prev,
                            creates: prev.creates.map((row) => {
                              const pick = pickRegularProgramForClass(regularCatalog, row.classLevel);
                              if (!pick) return row;
                              return {
                                ...row,
                                programId: pick.id,
                                programName: pick.name,
                              };
                            }),
                          }));
                        }
                        saveDraftSoon();
                      };

                      applyLocalType(type);

                      // Edit page: persist type immediately so classes remap without Save.
                      if (isEdit && schoolId) {
                        startTypeTransition(async () => {
                          const result = await updateSchoolTypeAction(schoolId, type);
                          if (!result.ok) {
                            applyLocalType(previousType);
                            toast.error(result.message);
                            return;
                          }
                          toast.success(
                            type === "CUSTOMIZED"
                              ? "School type set to Customized"
                              : "School type set to Regular",
                          );
                          router.refresh();
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="type" className="w-full" aria-invalid={invalid("type")}>
                      <SelectValue />
                      {typePending ? <Loader2 className="ml-auto size-4 animate-spin" /> : null}
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

            <Field data-invalid={invalid("headOfficeId")} className="md:col-span-2 lg:col-span-3">
              <FieldLabel htmlFor="headOfficeId">Head Office</FieldLabel>
              <Select
                name="headOfficeId"
                items={headOfficeItems}
                defaultValue={values.headOfficeId || HEAD_OFFICE_NONE}
                onValueChange={saveDraftSoon}
              >
                <SelectTrigger
                  id="headOfficeId"
                  className="w-full"
                  aria-invalid={invalid("headOfficeId")}
                >
                  <SelectValue placeholder="None (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {headOfficeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500">Optional — leave as None if not needed.</p>
              {error("headOfficeId")}
            </Field>

                <Field data-invalid={invalid("principalName")} className="lg:col-span-3">
              <FieldLabel htmlFor="principalName">Principal name</FieldLabel>
                  <Input {...fieldProps("principalName")} {...capitalized} placeholder="Optional" />
              {error("principalName")}
            </Field>

                <Field data-invalid={invalid("studentStrength")} className="lg:col-span-3">
              <FieldLabel htmlFor="studentStrength">School seat limit</FieldLabel>
              <Input
                {...fieldProps("studentStrength")}
                inputMode="numeric"
                placeholder="e.g. 1200"
              />
              <p className="text-xs text-neutral-500">
                Maximum seats across classes — not the student list. Add students under Students.
              </p>
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
                    <HintedInput
                      {...fieldProps("contactPhone")}
                      {...phoneInput}
                      error={error("contactPhone")}
                      autoComplete="tel"
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Address">
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                  <Field data-invalid={invalid("addressLine")} className="md:col-span-3">
                    <FieldLabel htmlFor="addressLine">Street address *</FieldLabel>
                    <Input
                      {...fieldProps("addressLine")}
                      {...capitalized}
                      autoComplete="street-address"
                    />
                    {error("addressLine")}
                  </Field>
                  <Field data-invalid={invalid("city")}>
                    <FieldLabel htmlFor="city">City *</FieldLabel>
                    <Input {...fieldProps("city")} {...capitalized} autoComplete="address-level2" />
                    {error("city")}
                  </Field>
                  <Field data-invalid={invalid("state")}>
                    <FieldLabel htmlFor="state">State *</FieldLabel>
                    <Select
                      name="state"
                      items={stateItems}
                      defaultValue={values.state || null}
                      onValueChange={saveDraftSoon}
                    >
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
                    <Input
                      {...fieldProps("pincode")}
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="postal-code"
                    />
                    {error("pincode")}
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Internal notes">
                <Field data-invalid={invalid("notes")}>
                  <Textarea
                    {...fieldProps("notes")}
                    rows={3}
                    aria-label="Internal notes"
                    placeholder="Optional. Not visible to the school."
                  />
                  {error("notes")}
                </Field>
              </FormSection>
            </div>

            <div {...panel(2)}>
              <FormSection title="Programs & classes">
                <p className="-mt-1 text-sm text-neutral-500">
                  Add classes and sections, choose the program, and set subject access.
                </p>
                {schoolType === "CUSTOMIZED" ? (
                  <>
                    <input type="hidden" name="customProgramName" value={customProgramName || "Custom Program"} />
                    <input type="hidden" name="customProgramId" value={customProgramId} />
                  </>
                ) : null}
                {errors.customClasses?.[0] ? (
                  <FieldError>{errors.customClasses[0]}</FieldError>
                ) : null}
                {errors.offerings?.[0] ? <FieldError>{errors.offerings[0]}</FieldError> : null}

                <AdminSchoolClassesPanel
                  schoolId={schoolId}
                  schoolName={values.name ?? ""}
                  schoolPrograms={panelSchoolPrograms}
                  organization={panelOrganization}
                  classTeacherSlots={classesPanel?.classTeacherSlots ?? []}
                  seatsUsedLabel={
                    classesPanel?.seatsUsedLabel ??
                    (classDrafts.creates.length
                      ? `${classDrafts.creates.length} class${classDrafts.creates.length === 1 ? "" : "es"} ready to save`
                      : "No seats assigned yet")
                  }
                  teachersHref={classesPanel?.teachersHref ?? "/admin/teachers"}
                  embedded
                  strength={classesPanel?.strength}
                  rosterCounts={classesPanel?.rosterCounts}
                  persist={schoolId ? "immediate" : "deferred"}
                  initialCreates={initialClassCreates}
                  initialDeletes={initialClassDeletes}
                  onDeferredChange={setClassDrafts}
                  onSubjectAccessChange={(programId, classLevel, subjects) => {
                    const next = replaceClassSubjectOfferings(
                      offerings,
                      programId,
                      classLevel,
                      subjects,
                    );
                    setOfferings(next);
                    if (schoolType === "CUSTOMIZED") {
                      const levels = new Set(
                        [
                          ...customClasses,
                          String(classLevel),
                          ...next
                            .map((token) => parseOfferingToken(token)?.classLevel)
                            .filter((level): level is number => level != null)
                            .map(String),
                        ].filter(Boolean),
                      );
                      setCustomClasses([...levels].sort((a, b) => Number(a) - Number(b)));
                    }
                    const baseline = savedValues ?? values;
                    setFormDirty(
                      !sameFormValues(
                        {
                          ...readValues(),
                          offerings: next,
                          customClasses:
                            schoolType === "CUSTOMIZED"
                              ? [
                                  ...new Set([
                                    ...customClasses,
                                    String(classLevel),
                                  ]),
                                ]
                              : customClasses,
                        },
                        baseline,
                      ),
                    );
                    saveDraftSoon();
                  }}
                />
              </FormSection>
              {customClasses.map((level) => (
                <input key={level} type="hidden" name="customClasses" value={level} />
              ))}
              <input
                type="hidden"
                name="pendingSectionCreates"
                value={JSON.stringify(classDrafts.creates)}
              />
              <input
                type="hidden"
                name="pendingSectionDeletes"
                value={JSON.stringify(classDrafts.deleteSectionIds)}
              />
            </div>

            {!isEdit && schoolType === "CUSTOMIZED" ? (
              <div {...panel(3)}>
                <StudentResourcesStep
                  programs={(() => {
                    // Resources use regular catalog program names only — not the school's own custom program.
                    const byProgram = new Map<string, { programName: string; levels: Set<number> }>();
                    const remember = (
                      programId: string,
                      programCode: string,
                      programName: string,
                      classLevel: number,
                    ) => {
                      if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 10) return;
                      const catalog = regularCatalog.find((row) => row.id === programId);
                      if (!catalog && (programId === CUSTOM_DRAFT_PROGRAM_ID || !programCode)) {
                        return;
                      }
                      if (catalog && (catalog.type ?? "REGULAR") !== "REGULAR") return;
                      const code = catalog?.code ?? programCode;
                      const name = catalog?.name ?? programName;
                      if (!code) return;
                      const entry = byProgram.get(code) ?? {
                        programName: name,
                        levels: new Set<number>(),
                      };
                      entry.levels.add(classLevel);
                      byProgram.set(code, entry);
                    };
                    for (const row of classDrafts.creates) {
                      remember(row.programId, "", row.programName, row.classLevel);
                    }
                    for (const token of offerings) {
                      const parsed = parseOfferingToken(token);
                      if (!parsed) continue;
                      const catalog = regularCatalog.find((row) => row.id === parsed.programId);
                      if (!catalog) continue;
                      remember(
                        catalog.id,
                        catalog.code,
                        catalog.name,
                        parsed.classLevel,
                      );
                    }
                    return [...byProgram.entries()]
                      .map(([programCode, row]) => ({
                        programCode,
                        programName: row.programName,
                        classLevels: [...row.levels].sort((a, b) => a - b),
                      }))
                      .filter((row) => row.classLevels.length > 0);
                  })()}
                />
              </div>
            ) : null}

            {offerings.map((token) => (
              <input key={token} type="hidden" name="offerings" value={token} />
            ))}
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
            <Link
              href={cancelHref}
              onClick={(event) => {
                unsaved.guardCancelClick(cancelHref)(event);
                if (!event.defaultPrevented) onCancel?.();
              }}
              className={buttonVariants({ variant: "ghost" })}
            >
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
                  Submit
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
