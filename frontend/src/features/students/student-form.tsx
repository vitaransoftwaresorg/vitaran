"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Form from "next/form";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createStudentAction,
  updateStudentAction,
  type StudentFormState,
} from "@/features/students/actions";
import { displaySectionName } from "@/features/schools/section-label";
import { capitalizeWords, toPhoneDigits } from "@/features/schools/schema";
import type { SchoolProgramOffering } from "@/types/program";
import type { SchoolSection } from "@/types/section";
import { capitalizeInput } from "@/lib/name-case";
import type { StudentDetail } from "@/types/student";

type StudentFormField =
  | "name"
  | "rollNo"
  | "email"
  | "parentName"
  | "parentPhone"
  | "programId"
  | "classLevel"
  | "sectionId";

type StudentFormAction = (
  state: StudentFormState,
  formData: FormData,
) => Promise<StudentFormState>;

type StudentFormProps = {
  schoolPrograms: SchoolProgramOffering[];
  sections: SchoolSection[];
  student?: StudentDetail | null;
  defaults?: {
    programId?: string;
    classLevel?: number;
    sectionId?: string | null;
  };
  lockPlacement?: boolean;
  returnTo: string;
  /** Override create/update action (e.g. admin portal). */
  formActionOverride?: StudentFormAction;
  /** Stay on the page and call onSuccess instead of redirecting. */
  stayInPlace?: boolean;
  onSuccess?: (studentId: string) => void;
};

const NONE = "__none__";

export function StudentForm({
  schoolPrograms,
  sections,
  student,
  defaults,
  lockPlacement = false,
  returnTo,
  formActionOverride,
  stayInPlace = false,
  onSuccess,
}: StudentFormProps) {
  const isEdit = Boolean(student);
  const action: StudentFormAction =
    formActionOverride ??
    (isEdit
      ? (updateStudentAction.bind(null, student!.id) as StudentFormAction)
      : createStudentAction);

  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => {
    if (state.success && state.studentId) onSuccess?.(state.studentId);
  }, [state.success, state.studentId, onSuccess]);

  const initial = {
    name: student?.name ?? "",
    rollNo: student?.rollNo ?? "",
    email: student?.email ?? "",
    parentName: student?.parentName ?? "",
    parentPhone: student?.parentPhone ?? "",
    programId: student?.programId ?? defaults?.programId ?? "",
    classLevel: student?.classLevel ?? defaults?.classLevel,
    sectionId: student?.sectionId ?? defaults?.sectionId ?? null,
  };

  const [name, setName] = useState(state.values?.name ?? initial.name);
  const [rollNo, setRollNo] = useState(state.values?.rollNo ?? initial.rollNo);
  const [email, setEmail] = useState((state.values?.email ?? initial.email) || "");
  const [parentName, setParentName] = useState(
    state.values?.parentName ?? initial.parentName,
  );
  const [parentPhone, setParentPhone] = useState(
    toPhoneDigits(state.values?.parentPhone ?? initial.parentPhone),
  );
  const [programId, setProgramId] = useState(state.values?.programId ?? initial.programId);
  const [classLevel, setClassLevel] = useState<number | undefined>(
    state.values?.classLevel ?? initial.classLevel,
  );
  const [sectionId, setSectionId] = useState<string>(
    (state.values?.sectionId !== undefined
      ? state.values.sectionId
      : initial.sectionId) ?? NONE,
  );
  const [clientErrors, setClientErrors] = useState<Partial<Record<StudentFormField, string>>>(
    {},
  );

  const [baseline] = useState(() => ({
    name: initial.name,
    rollNo: initial.rollNo,
    email: initial.email || "",
    parentName: initial.parentName,
    parentPhone: toPhoneDigits(initial.parentPhone),
    programId: initial.programId,
    classLevel: initial.classLevel,
    sectionId: initial.sectionId ?? NONE,
  }));

  const dirty =
    !isEdit ||
    name.trim() !== baseline.name ||
    rollNo.trim() !== baseline.rollNo ||
    email.trim() !== baseline.email ||
    parentName.trim() !== baseline.parentName ||
    parentPhone !== baseline.parentPhone ||
    programId !== baseline.programId ||
    classLevel !== baseline.classLevel ||
    sectionId !== baseline.sectionId;

  const programItems = useMemo(
    () => schoolPrograms.map((p) => ({ value: p.programId, label: p.programName })),
    [schoolPrograms],
  );

  const classOptions = useMemo(() => {
    const offering = schoolPrograms.find((p) => p.programId === programId);
    return (offering?.classes ?? []).map((c) => c.classLevel).sort((a, b) => a - b);
  }, [schoolPrograms, programId]);

  const classItems = useMemo(
    () => classOptions.map((level) => ({ value: String(level), label: `Class ${level}` })),
    [classOptions],
  );

  const placementReady = Boolean(programId) && classLevel != null;

  const sectionOptions = useMemo(() => {
    if (!placementReady) return [];
    return sections.filter(
      (s) => s.programId === programId && s.classLevel === classLevel,
    );
  }, [sections, programId, classLevel, placementReady]);

  const hasNamedSections = sectionOptions.length > 0;

  // Whole class (no named sections) → Section A. Named sections → pick one (no blank "none").
  useEffect(() => {
    if (!placementReady) return;
    if (!hasNamedSections) {
      if (sectionId !== NONE) setSectionId(NONE);
      return;
    }
    if (sectionId === NONE) return;
    if (!sectionOptions.some((s) => s.id === sectionId)) {
      setSectionId(NONE);
    }
  }, [placementReady, hasNamedSections, sectionOptions, sectionId]);

  const sectionItems = useMemo(() => {
    if (!placementReady) return [];
    if (!hasNamedSections) {
      return [{ value: NONE, label: `Section ${displaySectionName(null)}` }];
    }
    return sectionOptions.map((s) => ({
      value: s.id,
      label: `Section ${s.name}`,
    }));
  }, [placementReady, hasNamedSections, sectionOptions]);

  const sectionSelectValue = !placementReady
    ? null
    : hasNamedSections
      ? sectionId === NONE
        ? null
        : sectionId
      : NONE;

  const placementLabel = useMemo(() => {
    const program = schoolPrograms.find((p) => p.programId === programId);
    const section = sections.find((s) => s.id === sectionId);
    return [
      program?.programName,
      classLevel != null ? `Class ${classLevel}` : null,
      `Section ${displaySectionName(section?.name)}`,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [schoolPrograms, sections, programId, classLevel, sectionId]);

  const errors = {
    ...clientErrors,
    ...(state.fieldErrors
      ? Object.fromEntries(
          Object.entries(state.fieldErrors).map(([key, value]) => [key, value?.[0]]),
        )
      : {}),
  } as Partial<Record<StudentFormField, string>>;

  function validateBeforeSubmit(): boolean {
    const next: typeof clientErrors = {};
    if (name.trim().length < 2) next.name = "Enter the student name";
    if (!/^\d{7}$/.test(rollNo.trim())) next.rollNo = "Enter the 7-digit registration number";
    if (parentName.trim().length < 2) next.parentName = "Enter the parent / guardian name";
    if (!/^\d{10}$/.test(parentPhone)) next.parentPhone = "Enter a 10-digit mobile number";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid parent / guardian email";
    }
    if (!programId) next.programId = "Pick a program";
    if (classLevel == null) next.classLevel = "Pick a class";
    if (hasNamedSections && (sectionId === NONE || !sectionId)) {
      next.sectionId = "Pick a section";
    }
    setClientErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <Form
      action={formAction}
      className="space-y-4"
      onSubmit={(event) => {
        if (!validateBeforeSubmit()) {
          event.preventDefault();
          return;
        }
        if (isEdit && !dirty) event.preventDefault();
      }}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      {stayInPlace ? <input type="hidden" name="stay" value="1" /> : null}
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="classLevel" value={classLevel ?? ""} />
      <input type="hidden" name="sectionId" value={sectionId === NONE ? "" : sectionId} />

      {state.message && !state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {lockPlacement ? (
        <p className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm font-medium text-brand-950">
          {capitalizeWords(placementLabel)}
        </p>
      ) : null}

      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="name">Student name *</FieldLabel>
          <Input
            id="name"
            name="name"
            autoCapitalize="words"
            value={name}
            className="h-9"
            onChange={(e) => {
              setName(capitalizeInput(e.currentTarget));
              setClientErrors((prev) => ({ ...prev, name: undefined }));
            }}
          />
          {errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </Field>

        <Field data-invalid={errors.rollNo ? true : undefined}>
          <FieldLabel htmlFor="rollNo">Registration number *</FieldLabel>
          <Input
            id="rollNo"
            name="rollNo"
            value={rollNo}
            inputMode="numeric"
            maxLength={7}
            placeholder="7 digits"
            className="h-9"
            onChange={(e) => {
              setRollNo(e.currentTarget.value.replace(/\D/g, "").slice(0, 7));
              setClientErrors((prev) => ({ ...prev, rollNo: undefined }));
            }}
          />
          {errors.rollNo ? <FieldError>{errors.rollNo}</FieldError> : null}
        </Field>

        <Field data-invalid={errors.parentName ? true : undefined}>
          <FieldLabel htmlFor="parentName">Parent / guardian name *</FieldLabel>
          <Input
            id="parentName"
            name="parentName"
            autoCapitalize="words"
            value={parentName}
            className="h-9"
            onChange={(e) => {
              setParentName(capitalizeInput(e.currentTarget));
              setClientErrors((prev) => ({ ...prev, parentName: undefined }));
            }}
          />
          {errors.parentName ? <FieldError>{errors.parentName}</FieldError> : null}
        </Field>

        <Field data-invalid={errors.parentPhone ? true : undefined}>
          <FieldLabel htmlFor="parentPhone">Parent mobile number *</FieldLabel>
          <Input
            id="parentPhone"
            name="parentPhone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={parentPhone}
            className="h-9"
            placeholder="10-digit mobile"
            maxLength={10}
            onChange={(e) => {
              setParentPhone(toPhoneDigits(e.currentTarget.value));
              setClientErrors((prev) => ({ ...prev, parentPhone: undefined }));
            }}
          />
          {errors.parentPhone ? <FieldError>{errors.parentPhone}</FieldError> : null}
        </Field>

        <Field data-invalid={errors.email ? true : undefined} className="sm:col-span-2">
          <FieldLabel htmlFor="email">Parent / guardian email (optional)</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            className="h-9"
            placeholder="parent@example.com"
            onChange={(e) => {
              setEmail(e.currentTarget.value);
              setClientErrors((prev) => ({ ...prev, email: undefined }));
            }}
          />
          {errors.email ? <FieldError>{errors.email}</FieldError> : null}
        </Field>

        {!lockPlacement ? (
          <>
            <Field data-invalid={errors.programId ? true : undefined}>
              <FieldLabel>Program *</FieldLabel>
              <Select
                value={programId || null}
                items={programItems}
                onValueChange={(v) => {
                  setProgramId(v ?? "");
                  setClassLevel(undefined);
                  setSectionId(NONE);
                  setClientErrors((prev) => ({
                    ...prev,
                    programId: undefined,
                    classLevel: undefined,
                    sectionId: undefined,
                  }));
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.programId ? <FieldError>{errors.programId}</FieldError> : null}
            </Field>

            <Field data-invalid={errors.classLevel ? true : undefined}>
              <FieldLabel>Class *</FieldLabel>
              <Select
                value={classLevel != null ? String(classLevel) : null}
                items={classItems}
                onValueChange={(v) => {
                  setClassLevel(v ? Number(v) : undefined);
                  setSectionId(NONE);
                  setClientErrors((prev) => ({
                    ...prev,
                    classLevel: undefined,
                    sectionId: undefined,
                  }));
                }}
                disabled={!programId}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.classLevel ? <FieldError>{errors.classLevel}</FieldError> : null}
            </Field>

            <Field data-invalid={errors.sectionId ? true : undefined} className="sm:col-span-2">
              <FieldLabel>
                Section {hasNamedSections ? "*" : placementReady ? "(Section A)" : ""}
              </FieldLabel>
              <Select
                value={sectionSelectValue}
                items={sectionItems}
                onValueChange={(v) => {
                  setSectionId(v ?? NONE);
                  setClientErrors((prev) => ({ ...prev, sectionId: undefined }));
                }}
                disabled={!placementReady || (!hasNamedSections && placementReady)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue
                    placeholder={
                      !placementReady
                        ? "Pick program and class first"
                        : hasNamedSections
                          ? "Select section"
                          : `Section ${displaySectionName(null)}`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {sectionItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sectionId ? <FieldError>{errors.sectionId}</FieldError> : null}
            </Field>
          </>
        ) : null}
      </FieldGroup>

      {dirty ? (
        <Button type="submit" disabled={pending} className="gap-1.5">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isEdit ? (
            <Save className="size-4" />
          ) : null}
          {isEdit ? "Save changes" : "Add student"}
        </Button>
      ) : null}
    </Form>
  );
}
