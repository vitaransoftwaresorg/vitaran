"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { hasChanges } from "@/features/documents/constants";
import { DocumentFormShell } from "@/features/documents/document-form-shell";
import { SearchableSelectField } from "@/features/documents/searchable-select-field";
import { SelectField } from "@/features/documents/select-field";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import type { SchoolTestOption } from "@/types/answer-key";
import type { ResultSchoolOption, ResultSet } from "@/types/result";
import { updateResultAction, uploadResultAction } from "./actions";
import { ClassFileRow } from "./class-file-row";
import { classFileField, RESULTS_PATH } from "./constants";
import type { ResultFormState, ResultFormValues } from "./schema";
import { loadSchoolTestsAction } from "./school-tests-action";

type FieldErrors = NonNullable<Exclude<ResultFormState, undefined | { status: "success" }>["fieldErrors"]>;

const TRACKED_FIELDS = ["schoolId", "program", "programName", "testId", "testNumber"] as const;

function toFormValues(resultSet?: ResultSet, school?: ResultSchoolOption): ResultFormValues {
  if (!resultSet) {
    return {
      schoolId: school?.id,
    };
  }
  return {
    schoolId: resultSet.school.id,
    program: resultSet.program ?? undefined,
    programName: resultSet.programName ?? undefined,
    testId: resultSet.testId,
    testNumber: String(resultSet.testNumber),
  };
}

const parseLevels = (value?: string) =>
  new Set((value ?? "").split(",").filter(Boolean).map(Number));

function toggle(set: Set<number>, level: number, on: boolean) {
  const next = new Set(set);
  if (on) next.add(level);
  else next.delete(level);
  return next;
}

function testKey(test: Pick<SchoolTestOption, "testId" | "testNumber">) {
  return `${test.testId}\0${test.testNumber}`;
}

type ResultFormProps = {
  schools: ResultSchoolOption[];
  resultSet?: ResultSet;
  defaultSchoolId?: string;
  backHref?: string;
};

export function ResultForm({ schools, resultSet, defaultSchoolId, backHref = RESULTS_PATH }: ResultFormProps) {
  const router = useRouter();
  const action = resultSet ? updateResultAction.bind(null, resultSet.id) : uploadResultAction;
  const [state, formAction, pending] = useActionState<ResultFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.status !== "success") return;
    toast.success(resultSet ? "Results updated" : "Results uploaded");
    // Upload → list. Edit/replace → stay on this page and refresh the saved sheets.
    if (resultSet) {
      router.refresh();
      return;
    }
    router.push(RESULTS_PATH);
  }, [state, resultSet, router]);

  const failed = state?.status === "error" ? state : undefined;
  const defaultSchool = schools.find(({ id }) => id === defaultSchoolId);

  return (
    <Form action={formAction} noValidate>
      <FormFields
        key={failed?.submittedAt ?? "initial"}
        schools={schools}
        resultSet={resultSet}
        backHref={backHref}
        values={failed?.values ?? toFormValues(resultSet, defaultSchool)}
        errors={failed?.fieldErrors ?? {}}
        message={failed?.message}
        pending={pending}
      />
    </Form>
  );
}

type FormFieldsProps = {
  schools: ResultSchoolOption[];
  resultSet?: ResultSet;
  backHref: string;
  values: ResultFormValues;
  errors: FieldErrors;
  message?: string;
  pending: boolean;
};

function FormFields({ schools, resultSet, backHref, values, errors, message, pending }: FormFieldsProps) {
  const editing = Boolean(resultSet);
  const [current, setCurrent] = useState(values);
  const [newFiles, setNewFiles] = useState<Set<number>>(new Set());
  const [removed, setRemoved] = useState(() => parseLevels(values.removeClasses));
  const [tests, setTests] = useState<SchoolTestOption[]>([]);
  const [testsLoading, startLoadTests] = useTransition();
  const [selectedTestKey, setSelectedTestKey] = useState(() =>
    values.testId && values.testNumber ? `${values.testId}\0${values.testNumber}` : "",
  );

  const school = schools.find(({ id }) => id === current.schoolId);
  const customized = school?.type === "CUSTOMIZED";
  const selectedTest = tests.find((test) => testKey(test) === selectedTestKey) ?? null;
  const programs = selectedTest?.programs ?? [];
  const activeProgram =
    programs.find((row) => row.code === current.program) ??
    (current.programName
      ? programs.find((row) => row.name === current.programName)
      : undefined) ??
    programs[0] ??
    null;
  const classLevels = activeProgram?.classLevels ?? [];

  const schoolItems = schools.map(({ id, name, code }) => ({ value: id, label: name, hint: code }));
  const savedClasses = new Map(resultSet?.classes.map((item) => [item.classLevel, item]));

  const loadTests = (schoolId: string, prefer?: { testId?: string; testNumber?: string }) => {
    startLoadTests(async () => {
      const next = await loadSchoolTestsAction(schoolId);
      setTests(next);
      if (prefer?.testId && prefer.testNumber) {
        const match = next.find(
          (test) => test.testId === prefer.testId && String(test.testNumber) === prefer.testNumber,
        );
        if (match) {
          setSelectedTestKey(testKey(match));
          return;
        }
      }
      setSelectedTestKey(next[0] ? testKey(next[0]) : "");
    });
  };

  useEffect(() => {
    if (!current.schoolId) {
      setTests([]);
      setSelectedTestKey("");
      return;
    }
    loadTests(current.schoolId, {
      testId: current.testId,
      testNumber: current.testNumber,
    });
    // Only re-fetch when the school changes (or on first mount with a school).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [current.schoolId]);

  useEffect(() => {
    if (!selectedTest) return;
    setCurrent((prev) => {
      const kept = customized
        ? selectedTest.programs.find((row) => row.name === prev.programName)
        : selectedTest.programs.find((row) => row.code === prev.program);
      const program = kept ?? selectedTest.programs[0];
      return {
        ...prev,
        testId: selectedTest.testId,
        testNumber: String(selectedTest.testNumber),
        program: customized ? undefined : program?.code,
        programName: customized ? program?.name : undefined,
      };
    });
    setNewFiles(new Set());
    setRemoved(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when test selection changes
  }, [selectedTestKey, customized]);

  const selectSchool = (schoolId: string) => {
    setCurrent((prev) => ({
      ...prev,
      schoolId,
      program: undefined,
      programName: undefined,
      testId: undefined,
      testNumber: undefined,
    }));
    setSelectedTestKey("");
    setNewFiles(new Set());
    setRemoved(new Set());
  };

  const selectTest = (key: string) => {
    setSelectedTestKey(key);
  };

  const selectProgram = (code: string) => {
    const program = programs.find((row) => row.code === code);
    if (!program) return;
    setCurrent((prev) => ({
      ...prev,
      program: customized ? undefined : program.code,
      programName: customized ? program.name : undefined,
    }));
    setNewFiles(new Set());
    setRemoved(new Set());
  };

  const changed =
    newFiles.size > 0 ||
    removed.size > 0 ||
    (resultSet !== undefined && hasChanges(toFormValues(resultSet), current, [...TRACKED_FIELDS]));

  const classError = errors.classes?.[0];
  const readyCount = classLevels.filter(
    (level) => newFiles.has(level) || (savedClasses.has(level) && !removed.has(level)),
  ).length;

  return (
    <DocumentFormShell
      message={message}
      cancelHref={backHref}
      editing={editing}
      changed={changed}
      pending={pending}
      uploadLabel={editing ? "Save results" : "Import Excel"}
    >
      {classError && (
        <p
          role="alert"
          className="flex items-center gap-2 border-b border-destructive/15 bg-destructive/5 px-6 py-2.5 text-sm font-medium text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          {classError}
        </p>
      )}
      <input type="hidden" name="removeClasses" value={[...removed].join(",")} />
      <input type="hidden" name="testId" value={current.testId ?? ""} />
      <input type="hidden" name="testNumber" value={current.testNumber ?? ""} />
      {!customized && activeProgram && (
        <input type="hidden" name="program" value={activeProgram.code} />
      )}
      {customized && activeProgram && (
        <input type="hidden" name="programName" value={activeProgram.name} />
      )}

      <div className="grid divide-y divide-brand-100 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:divide-x lg:divide-y-0">
        <Column title="Selection" description="School, then the test from its answer keys.">
          <div className="flex flex-col gap-4">
            <SearchableSelectField
              name="schoolId"
              label="School"
              placeholder={schools.length > 0 ? "Select a school" : "No schools yet"}
              items={schoolItems}
              defaultValue={values.schoolId}
              onValueChange={selectSchool}
              disabled={schools.length === 0 || editing}
              errors={errors.schoolId}
            />

            {school && (
              <div className="-mt-2 flex items-center gap-2.5 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2">
                <SchoolTypeBadge type={school.type} size="sm" />
                <span className="text-xs text-neutral-600">
                  Pick a test below. Programs and classes come from answer keys.
                </span>
              </div>
            )}

            {school && (
              <div className="flex flex-col gap-2">
                {testsLoading ? (
                  <p className="text-sm text-neutral-500">Loading tests…</p>
                ) : tests.length === 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium text-neutral-800">
                      Test <span className="text-brand-600">*</span>
                    </p>
                    <p className="rounded-lg border border-dashed border-brand-200 bg-brand-50/40 px-3 py-4 text-sm text-brand-700">
                      No live test
                    </p>
                  </div>
                ) : (
                  <SelectField
                    key={current.schoolId}
                    name="selectedTest"
                    label="Test"
                    placeholder="Select a test"
                    items={tests.map((test) => ({
                      value: testKey(test),
                      label: `Test No ${test.testNumber}`,
                    }))}
                    value={selectedTestKey || ""}
                    onValueChange={selectTest}
                    disabled={editing}
                    errors={errors.testId ?? errors.testNumber}
                  />
                )}
              </div>
            )}

            {!customized && errors.program?.length ? <FieldError>{errors.program[0]}</FieldError> : null}
            {customized && errors.programName?.length ? (
              <FieldError>{errors.programName[0]}</FieldError>
            ) : null}
          </div>
        </Column>

        <Column
          title={activeProgram?.name ?? "Programs & classes"}
          description="One Excel (.xlsx) sheet per class from the answer key."
          aside={
            school && selectedTest ? (
              <span className="shrink-0 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 tabular-nums">
                {readyCount} of {classLevels.length} ready
              </span>
            ) : undefined
          }
        >
          {!school ? (
            <p className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-10 text-center text-sm text-brand-700">
              Select a school to see its tests.
            </p>
          ) : !selectedTest ? (
            <p className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-10 text-center text-sm text-brand-700">
              {testsLoading ? "Loading…" : "Select a test to see its programs and classes."}
            </p>
          ) : (
            <div className="space-y-4">
              {programs.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Program"
                  className="flex flex-wrap gap-2 rounded-2xl border border-brand-100 bg-white p-1.5"
                >
                  {programs.map((program) => {
                    const active = program.code === activeProgram?.code;
                    return (
                      <button
                        key={program.code}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => selectProgram(program.code)}
                        className={cn(
                          "rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                          active ? "bg-brand-900 text-white" : "text-brand-800 hover:bg-brand-50",
                        )}
                      >
                        {program.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {classLevels.length === 0 ? (
                <p className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-8 text-center text-sm text-brand-700">
                  No classes on answer keys for this program and test.
                </p>
              ) : (
                <ul
                  className={cn(
                    "divide-y divide-brand-100/70 overflow-hidden rounded-xl border border-brand-100",
                    classError && "border-destructive/40",
                  )}
                >
                  {classLevels.map((level) => (
                    <ClassFileRow
                      key={`${activeProgram?.code ?? "custom"}-${level}`}
                      classLevel={level}
                      saved={savedClasses.get(level)}
                      removed={removed.has(level)}
                      onRemovedChange={(on) => setRemoved((prev) => toggle(prev, level, on))}
                      onFileChange={(on) => setNewFiles((prev) => toggle(prev, level, on))}
                      errors={errors[classFileField(level)]}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </Column>
      </div>
    </DocumentFormShell>
  );
}

function Column({
  title,
  description,
  aside,
  className,
  children,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("px-5 py-4", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-950">{title}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
