"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hasChanges } from "@/features/documents/constants";
import { DocumentFormShell, FormSection } from "@/features/documents/document-form-shell";
import { SelectField } from "@/features/documents/select-field";
import { programLabel, TYPE_LABELS } from "@/features/schools/constants";
import type { AnswerKey } from "@/types/answer-key";
import type { LearningProgram } from "@/types/program";
import { SCHOOL_TYPES } from "@/types/school";
import { updateAnswerKeyAction, uploadAnswerKeyAction } from "./actions";
import { ANSWER_KEYS_PATH } from "./constants";
import type { AnswerKeyFormState, AnswerKeyFormValues } from "./schema";
import type { AnswerKeySchoolOption } from "./school-options";
import { enteredTestId } from "./test-id";
import {
  classItemsFromLevels,
  classLevelsFromProgram,
  testNumberItemsForProgram,
} from "./test-options";

type FieldErrors = Exclude<AnswerKeyFormState, undefined | { status: "success" }>["fieldErrors"];

const typeItems = SCHOOL_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));

function toFormValues(answerKey?: AnswerKey): AnswerKeyFormValues {
  if (!answerKey) return { type: "REGULAR" };
  return {
    program: answerKey.program,
    type: answerKey.type,
    schoolId: answerKey.school?.id,
    testId: enteredTestId(answerKey.testId),
    testNumber: String(answerKey.testNumber),
    classLevel: String(answerKey.classLevel),
  };
}

type AnswerKeyFormProps = {
  /** Customized schools (with offerings) for customized answer keys. */
  schools: AnswerKeySchoolOption[];
  /** Catalog programs for the program dropdown. */
  programs: LearningProgram[];
  /** Present when editing. */
  answerKey?: AnswerKey;
};

export function AnswerKeyForm({ schools, programs, answerKey }: AnswerKeyFormProps) {
  const router = useRouter();
  const action = answerKey ? updateAnswerKeyAction.bind(null, answerKey.id) : uploadAnswerKeyAction;
  const [state, formAction, pending] = useActionState<AnswerKeyFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.status !== "success") return;
    toast.success(answerKey ? "Answer key updated" : "Answer key created");
    router.push(ANSWER_KEYS_PATH);
  }, [state, answerKey, router]);

  const failed = state?.status === "error" ? state : undefined;

  return (
    <Form action={formAction} noValidate>
      <FormFields
        key={failed?.submittedAt ?? "initial"}
        schools={schools}
        programs={programs}
        answerKey={answerKey}
        values={failed?.values ?? toFormValues(answerKey)}
        errors={failed?.fieldErrors ?? {}}
        message={failed?.message}
        pending={pending}
      />
    </Form>
  );
}

type FormFieldsProps = {
  schools: AnswerKeySchoolOption[];
  programs: LearningProgram[];
  answerKey?: AnswerKey;
  values: AnswerKeyFormValues;
  errors: NonNullable<FieldErrors>;
  message?: string;
  pending: boolean;
};

function FormFields({ schools, programs, answerKey, values, errors, message, pending }: FormFieldsProps) {
  const programItems = programs.map((program) => ({
    value: program.code,
    label: programLabel(program.code, program.name),
  }));
  const [current, setCurrent] = useState(values);
  const customized = current.type === "CUSTOMIZED";

  const selectedProgram = useMemo(
    () => programs.find((program) => program.code === current.program) ?? null,
    [programs, current.program],
  );

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === current.schoolId) ?? null,
    [schools, current.schoolId],
  );

  const testNumberItems = useMemo(
    () => testNumberItemsForProgram(current.program),
    [current.program],
  );

  const classLevels = useMemo(() => {
    if (!selectedProgram) return [];
    if (customized) {
      if (!selectedSchool) return [];
      const offering = selectedSchool.offerings.find((row) => row.code === selectedProgram.code);
      return offering?.classLevels ?? [];
    }
    return classLevelsFromProgram(selectedProgram);
  }, [selectedProgram, customized, selectedSchool]);

  const classItems = useMemo(() => classItemsFromLevels(classLevels), [classLevels]);

  const setField = (field: keyof AnswerKeyFormValues, value: string) => {
    setCurrent((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "type" && value === "REGULAR") {
        next.schoolId = undefined;
      }
      if (field === "program" || field === "type" || field === "schoolId") {
        // Drop stale picks when the available tests/classes change.
        const programCode = field === "program" ? value : next.program;
        const testMax = testNumberItemsForProgram(programCode).length;
        const testNo = Number(next.testNumber);
        if (!testNo || testNo < 1 || testNo > testMax) next.testNumber = undefined;

        let levels: number[] = [];
        const program = programs.find((row) => row.code === programCode) ?? null;
        if (program) {
          if ((field === "type" ? value : next.type) === "CUSTOMIZED") {
            const schoolId = field === "schoolId" ? value : next.schoolId;
            const school = schools.find((row) => row.id === schoolId);
            levels =
              school?.offerings.find((row) => row.code === program.code)?.classLevels ?? [];
          } else {
            levels = classLevelsFromProgram(program);
          }
        }
        const classLevel = Number(next.classLevel);
        if (!levels.includes(classLevel)) next.classLevel = undefined;
      }
      return next;
    });
  };

  const changed =
    answerKey !== undefined &&
    hasChanges(toFormValues(answerKey), current, [
      "program",
      "type",
      "testId",
      "testNumber",
      "classLevel",
      ...(customized ? (["schoolId"] as const) : []),
    ]);

  const schoolItems = schools.map((school) => ({
    value: school.id,
    label: school.name,
    hint: school.code,
  }));

  const classPlaceholder = !current.program
    ? "Select a program first"
    : customized && !current.schoolId
      ? "Select a school first"
      : classItems.length === 0
        ? customized
          ? "No classes enrolled for this program"
          : "No classes on this program"
        : "Select a class";

  return (
    <DocumentFormShell
      message={message}
      cancelHref={ANSWER_KEYS_PATH}
      editing={Boolean(answerKey)}
      changed={changed}
      pending={pending}
      uploadLabel="Create answer key"
    >
      <FormSection title="Program">
        <div className={cn("grid gap-4 sm:grid-cols-2", customized && "lg:grid-cols-3")}>
          <SelectField
            name="program"
            label="Program"
            placeholder="Select a program"
            items={programItems}
            defaultValue={values.program}
            onValueChange={(value) => setField("program", value)}
            errors={errors.program}
          />
          <SelectField
            name="type"
            label="Type"
            items={typeItems}
            defaultValue={values.type || "REGULAR"}
            onValueChange={(value) => setField("type", value)}
            errors={errors.type}
          />
          {customized && (
            <SelectField
              name="schoolId"
              label="School"
              placeholder={schools.length > 0 ? "Select a customized school" : "No customized schools yet"}
              items={schoolItems}
              defaultValue={values.schoolId}
              onValueChange={(value) => setField("schoolId", value)}
              disabled={schools.length === 0}
              className="animate-in fade-in-0 duration-200 sm:col-span-2 lg:col-span-1"
              errors={errors.schoolId}
            />
          )}
        </div>
      </FormSection>

      <FormSection title="Test & class">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="testId" className="text-[13px] font-medium text-neutral-800">
              Test ID <span className="text-brand-600">*</span>
            </label>
            <Input
              id="testId"
              name="testId"
              placeholder="e.g. T-2026-01"
              defaultValue={values.testId}
              onChange={(event) => setField("testId", event.currentTarget.value)}
              aria-invalid={errors.testId?.length ? true : undefined}
              maxLength={64}
              className="h-11 rounded-lg border-neutral-200 bg-white px-3.5 font-mono text-sm shadow-xs hover:border-brand-300 focus-visible:border-brand-600 focus-visible:ring-brand-600/15"
            />
            {errors.testId?.length ? <FieldError>{errors.testId[0]}</FieldError> : null}
          </div>
          <SelectField
            key={`test-${current.program ?? "none"}-${current.testNumber ?? ""}`}
            name="testNumber"
            label="Test No"
            placeholder={current.program ? "Select a test number" : "Select a program first"}
            items={testNumberItems}
            defaultValue={current.testNumber}
            onValueChange={(value) => setField("testNumber", value)}
            disabled={!current.program}
            errors={errors.testNumber}
          />
          <SelectField
            key={`class-${current.program ?? "none"}-${current.schoolId ?? "reg"}-${current.classLevel ?? ""}`}
            name="classLevel"
            label="Class"
            placeholder={classPlaceholder}
            items={classItems}
            defaultValue={current.classLevel}
            onValueChange={(value) => setField("classLevel", value)}
            disabled={classItems.length === 0}
            errors={errors.classLevel}
          />
        </div>
      </FormSection>

      <p className="px-6 py-4 text-sm text-neutral-600">
        After you create the key, fill 100 questions with A, B, C, D or ADD, plus explanations.
      </p>
    </DocumentFormShell>
  );
}
