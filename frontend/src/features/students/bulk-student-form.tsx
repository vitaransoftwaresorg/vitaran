"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSchoolStudentsBulkAction,
  type BulkStudentFormState,
} from "@/features/students/actions";
import { displaySectionName } from "@/features/schools/section-label";
import { capitalizeWords, toPhoneDigits } from "@/features/schools/schema";
import { cn } from "@/lib/utils";
import type { SchoolProgramOffering } from "@/types/program";
import type { SchoolSection } from "@/types/section";
import type { BulkStudentRowInput } from "@/types/student";

type BulkStudentFormProps = {
  schoolPrograms: SchoolProgramOffering[];
  sections: SchoolSection[];
  defaults?: {
    programId?: string;
    classLevel?: number;
    sectionId?: string | null;
  };
  lockPlacement?: boolean;
  returnTo: string;
  stayInPlace?: boolean;
  onSuccess?: (count: number) => void;
  /** Override school bulk action (e.g. admin). */
  submitAction?: (input: {
    programId: string;
    classLevel: number;
    sectionId?: string | null;
    students: BulkStudentRowInput[];
    returnTo?: string;
    stay?: boolean;
  }) => Promise<BulkStudentFormState>;
};

type Row = {
  key: string;
  name: string;
  rollNo: string;
  parentName: string;
  parentPhone: string;
  email: string;
};

const NONE = "__none__";
const EMPTY_ROWS = 5;

function emptyRow(): Row {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    rollNo: "",
    parentName: "",
    parentPhone: "",
    email: "",
  };
}

export function BulkStudentForm({
  schoolPrograms,
  sections,
  defaults,
  lockPlacement = false,
  returnTo,
  stayInPlace = false,
  onSuccess,
  submitAction,
}: BulkStudentFormProps) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<BulkStudentFormState>({});
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: EMPTY_ROWS }, () => emptyRow()),
  );
  const [programId, setProgramId] = useState(defaults?.programId ?? "");
  const [classLevel, setClassLevel] = useState<number | undefined>(defaults?.classLevel);
  const [sectionId, setSectionId] = useState<string>(
    defaults?.sectionId ?? NONE,
  );

  useEffect(() => {
    if (state.success && state.count != null) onSuccess?.(state.count);
  }, [state.success, state.count, onSuccess]);

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

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
    setState({});
  }

  function removeRow(key: string) {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.key !== key)));
    setState({});
  }

  function submit() {
    if (!programId || classLevel == null) {
      setState({ message: "Pick a program and class" });
      return;
    }
    if (hasNamedSections && (sectionId === NONE || !sectionId)) {
      setState({ message: "Pick a section" });
      return;
    }

    const action = submitAction ?? createSchoolStudentsBulkAction;
    startTransition(async () => {
      const result = await action({
        programId,
        classLevel,
        sectionId: sectionId === NONE ? null : sectionId,
        students: rows.map((row) => ({
          name: row.name,
          rollNo: row.rollNo,
          parentName: row.parentName,
          parentPhone: row.parentPhone,
          email: row.email || null,
        })),
        returnTo,
        stay: stayInPlace,
      });
      setState(result);
    });
  }

  const filledCount = rows.filter(
    (row) =>
      row.name.trim() ||
      row.rollNo.trim() ||
      row.parentName.trim() ||
      row.parentPhone.trim() ||
      row.email.trim(),
  ).length;

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {lockPlacement ? (
        <p className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm font-medium text-brand-950">
          {capitalizeWords(placementLabel)}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel>Program *</FieldLabel>
            <Select
              value={programId || null}
              items={programItems}
              onValueChange={(v) => {
                setProgramId(v ?? "");
                setClassLevel(undefined);
                setSectionId(NONE);
                setState({});
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
          </Field>

          <Field>
            <FieldLabel>Class *</FieldLabel>
            <Select
              value={classLevel != null ? String(classLevel) : null}
              items={classItems}
              onValueChange={(v) => {
                setClassLevel(v ? Number(v) : undefined);
                setSectionId(NONE);
                setState({});
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
          </Field>

          <Field>
            <FieldLabel>
              Section {hasNamedSections ? "*" : placementReady ? "(Section A)" : ""}
            </FieldLabel>
            <Select
              value={sectionSelectValue}
              items={sectionItems}
              onValueChange={(v) => {
                setSectionId(v ?? NONE);
                setState({});
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
          </Field>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/60 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              <tr>
                <th className="w-10 px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Reg. no *</th>
                <th className="px-3 py-2.5">Student name *</th>
                <th className="px-3 py-2.5">Parent name *</th>
                <th className="px-3 py-2.5">Parent mobile *</th>
                <th className="px-3 py-2.5">Parent email</th>
                <th className="w-12 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const errors = state.rowErrors?.[index] ?? {};
                return (
                  <tr
                    key={row.key}
                    className={cn(
                      "border-b border-neutral-100 last:border-0",
                      Object.keys(errors).length > 0 && "bg-red-50/40",
                    )}
                  >
                    <td className="px-3 py-2 align-top text-neutral-400">{index + 1}</td>
                    <td className="px-2 py-1.5 align-top">
                      <Input
                        value={row.rollNo}
                        className="h-9"
                        aria-invalid={errors.rollNo ? true : undefined}
                        onChange={(e) => updateRow(row.key, { rollNo: e.currentTarget.value })}
                      />
                      {errors.rollNo ? <FieldError>{errors.rollNo}</FieldError> : null}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <Input
                        value={row.name}
                        className="h-9"
                        aria-invalid={errors.name ? true : undefined}
                        onChange={(e) => updateRow(row.key, { name: e.currentTarget.value })}
                      />
                      {errors.name ? <FieldError>{errors.name}</FieldError> : null}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <Input
                        value={row.parentName}
                        className="h-9"
                        aria-invalid={errors.parentName ? true : undefined}
                        onChange={(e) =>
                          updateRow(row.key, { parentName: e.currentTarget.value })
                        }
                      />
                      {errors.parentName ? <FieldError>{errors.parentName}</FieldError> : null}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={row.parentPhone}
                        className="h-9"
                        placeholder="10 digits"
                        aria-invalid={errors.parentPhone ? true : undefined}
                        onChange={(e) =>
                          updateRow(row.key, {
                            parentPhone: toPhoneDigits(e.currentTarget.value),
                          })
                        }
                      />
                      {errors.parentPhone ? (
                        <FieldError>{errors.parentPhone}</FieldError>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <Input
                        type="email"
                        value={row.email}
                        className="h-9"
                        placeholder="optional"
                        aria-invalid={errors.email ? true : undefined}
                        onChange={(e) => updateRow(row.key, { email: e.currentTarget.value })}
                      />
                      {errors.email ? <FieldError>{errors.email}</FieldError> : null}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                        disabled={rows.length <= 1}
                        onClick={() => removeRow(row.key)}
                        aria-label={`Remove row ${index + 1}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={() => setRows((current) => [...current, emptyRow()])}
        >
          <Plus className="size-4" />
          Add row
        </Button>
        <Button
          type="button"
          disabled={pending || filledCount === 0}
          className="gap-1.5"
          onClick={submit}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {filledCount > 1 ? `Add ${filledCount} students` : "Add student"}
        </Button>
        <p className="text-xs text-neutral-500">
          Blank rows are skipped.
        </p>
      </div>
    </div>
  );
}
