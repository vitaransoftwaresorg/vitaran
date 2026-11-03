"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUBJECT_LABELS, subjectLabel, TYPE_LABELS } from "@/features/schools/constants";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { SCHOOL_TYPES, toSubjectCode } from "@/types/school";
import type { LearningProgram } from "@/types/program";
import { isProgramCodeTakenAction, type ProgramFormState, type ProgramFormValues } from "./actions";

const TYPE_OPTIONS = SCHOOL_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));
const CATALOG_SUBJECTS = Object.keys(SUBJECT_LABELS);
const CLASS_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, index) => String(new Date().getFullYear() - 1 + index));
const PROGRAM_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const CODE_CHECK_DELAY_MS = 400;

type ProgramFormProps = {
  program?: LearningProgram;
  action: (state: ProgramFormState, formData: FormData) => Promise<ProgramFormState>;
};

function toValues(program?: LearningProgram): ProgramFormValues {
  return {
    name: program?.name ?? "",
    type: program?.type ?? "",
    year: String(program?.year ?? new Date().getFullYear()),
    classFrom: program ? String(program.classFrom) : "",
    classTo: program ? String(program.classTo) : "",
    subjects: program?.subjects ?? [],
    code: program?.code ?? "",
  };
}

function toProgramCode(value: string) {
  return toSubjectCode(value);
}

export function ProgramForm({ program, action }: ProgramFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = state?.status === "error" ? state.values : toValues(program);
  const [subjects, setSubjects] = useState(values.subjects);
  const [type, setType] = useState(values.type);
  const [classFrom, setClassFrom] = useState(values.classFrom);
  const [classTo, setClassTo] = useState(values.classTo);
  const [code, setCode] = useState(values.code);
  const [codeTaken, setCodeTaken] = useState(false);
  const [codeChecking, setCodeChecking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const codeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCode = useRef(values.code);
  const errors = state?.status === "error" ? state.fieldErrors : undefined;
  const isEdit = !!program;
  const cancelHref = "/admin/programs";
  const normalizedCode = toProgramCode(code);
  const codeValid = PROGRAM_CODE.test(normalizedCode);
  const subjectOptions = useMemo(
    () => [...new Set([...CATALOG_SUBJECTS, ...values.subjects, ...subjects])],
    [subjects, values.subjects],
  );

  const toggleSubject = (subject: string, checked: boolean) => {
    if (isEdit) setDirty(true);
    setSubjects((prev) => {
      if (checked) return prev.includes(subject) ? prev : [...prev, subject];
      return prev.filter((item) => item !== subject);
    });
  };

  const checkCode = (value: string) => {
    if (codeTimer.current) clearTimeout(codeTimer.current);
    const next = toProgramCode(value);
    latestCode.current = next;
    setCode(next);
    setCodeTaken(false);
    if (!PROGRAM_CODE.test(next)) {
      setCodeChecking(false);
      return;
    }
    setCodeChecking(true);
    codeTimer.current = setTimeout(async () => {
      const taken = await isProgramCodeTakenAction(next, program?.id);
      if (latestCode.current !== next) return;
      setCodeChecking(false);
      setCodeTaken(taken);
    }, CODE_CHECK_DELAY_MS);
  };

  const { formRef, markClean, guardCancelClick, dialog } = useUnsavedChanges(isEdit && dirty);

  useEffect(() => {
    return () => {
      if (codeTimer.current) clearTimeout(codeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (state?.status === "success") {
      markClean();
      toast.success(isEdit ? "Program updated" : "Program created");
      router.replace(cancelHref);
    } else if (state?.status === "error" && state.message && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, isEdit, router, markClean]);

  const codeHint = !isEdit
    ? !normalizedCode
      ? null
      : !codeValid
        ? "Use letters, numbers and underscores (e.g. INTEGRATED)."
        : codeChecking
          ? "Checking…"
          : codeTaken
            ? "This code is already used."
            : "This code is available."
    : null;

  const canSubmit =
    Boolean(type) &&
    Boolean(classFrom) &&
    Boolean(classTo) &&
    subjects.length > 0 &&
    (isEdit || (codeValid && !codeTaken && !codeChecking));

  return (
    <>
    <Form
      key={program?.id ?? "new"}
      ref={formRef}
      action={formAction}
      autoComplete="off"
      className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:p-8"
      onChange={() => {
        if (isEdit) setDirty(true);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field data-invalid={errors?.name ? true : undefined} className="md:col-span-2">
          <FieldLabel htmlFor="name">Program name *</FieldLabel>
          <Input id="name" name="name" defaultValue={values.name} required />
          {errors?.name && <FieldError>{errors.name[0]}</FieldError>}
        </Field>

        <Field data-invalid={errors?.type ? true : undefined}>
          <FieldLabel htmlFor="type">Type *</FieldLabel>
          <input type="hidden" name="type" value={type} />
          <Select
            items={TYPE_OPTIONS}
            value={type || null}
            onValueChange={(next) => {
              if (isEdit) setDirty(true);
              setType(String(next ?? ""));
            }}
          >
            <SelectTrigger id="type" className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.type && <FieldError>{errors.type[0]}</FieldError>}
        </Field>

        <Field data-invalid={errors?.year ? true : undefined}>
          <FieldLabel htmlFor="year">Year *</FieldLabel>
          <Select name="year" items={YEAR_OPTIONS.map((value) => ({ value, label: value }))} defaultValue={values.year}>
            <SelectTrigger id="year" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.year && <FieldError>{errors.year[0]}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors?.code) || (!isEdit && codeTaken) || undefined}>
          <FieldLabel htmlFor="code">Code *</FieldLabel>
          {isEdit ? (
            <Input id="code" name="code" defaultValue={values.code} readOnly className="bg-neutral-50" />
          ) : (
            <Input
              id="code"
              name="code"
              value={code}
              required
              autoCapitalize="characters"
              placeholder="e.g. INTEGRATED"
              onChange={(event) => checkCode(event.currentTarget.value)}
            />
          )}
          {codeHint ? (
            <p
              className={
                !codeValid || codeTaken
                  ? "text-xs font-medium text-red-600"
                  : codeChecking
                    ? "text-xs font-medium text-neutral-500"
                    : "text-xs font-medium text-emerald-700"
              }
            >
              {codeHint}
            </p>
          ) : errors?.code ? (
            <FieldError>{errors.code[0]}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={errors?.classFrom ? true : undefined}>
          <FieldLabel htmlFor="classFrom">Class from *</FieldLabel>
          <input type="hidden" name="classFrom" value={classFrom} />
          <Select
            items={CLASS_OPTIONS.map((value) => ({ value, label: `Class ${value}` }))}
            value={classFrom || null}
            onValueChange={(next) => {
              if (isEdit) setDirty(true);
              setClassFrom(String(next ?? ""));
            }}
          >
            <SelectTrigger id="classFrom" className="w-full">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {CLASS_OPTIONS.map((level) => (
                <SelectItem key={level} value={level}>
                  Class {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.classFrom && <FieldError>{errors.classFrom[0]}</FieldError>}
        </Field>

        <Field data-invalid={errors?.classTo ? true : undefined}>
          <FieldLabel htmlFor="classTo">Class to *</FieldLabel>
          <input type="hidden" name="classTo" value={classTo} />
          <Select
            items={CLASS_OPTIONS.map((value) => ({ value, label: `Class ${value}` }))}
            value={classTo || null}
            onValueChange={(next) => {
              if (isEdit) setDirty(true);
              setClassTo(String(next ?? ""));
            }}
          >
            <SelectTrigger id="classTo" className="w-full">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {CLASS_OPTIONS.map((level) => (
                <SelectItem key={level} value={level}>
                  Class {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.classTo && <FieldError>{errors.classTo[0]}</FieldError>}
        </Field>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-neutral-950">Subjects *</h3>
          <p className="mt-1 text-sm text-neutral-500">Select the subjects this program covers.</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {subjectOptions.map((subject) => {
            const id = `subject-${subject}`;
            return (
              <label key={subject} htmlFor={id} className="flex cursor-pointer items-center gap-2">
                <input
                  id={id}
                  type="checkbox"
                  name="subjects"
                  value={subject}
                  className="size-4 rounded border-neutral-300 accent-brand-800"
                  checked={subjects.includes(subject)}
                  onChange={(event) => toggleSubject(subject, event.target.checked)}
                />
                <span className="text-sm font-medium text-neutral-900">{subjectLabel(subject)}</span>
              </label>
            );
          })}
        </div>
        {errors?.subjects && <FieldError>{errors.subjects[0]}</FieldError>}
      </section>

      <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-4">
        <Link
          href={cancelHref}
          className={buttonVariants({ variant: "ghost" })}
          onClick={isEdit ? guardCancelClick(cancelHref) : undefined}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {isEdit ? "Save changes" : "Create program"}
        </Button>
      </footer>
    </Form>
    {dialog}
    </>
  );
}
