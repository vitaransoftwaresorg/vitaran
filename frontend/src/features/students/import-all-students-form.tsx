"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  importSchoolStudentsAllAction,
  type SchoolImportFormState,
  type SchoolImportGroupInput,
} from "@/features/students/actions";
import {
  groupImportRows,
  mergeImportApiErrors,
  refreshImportRows,
  resolveSchoolImportRows,
  type ImportFieldErrors,
  type ResolvedImportRow,
} from "@/features/students/import-placement";
import { navigateFresh } from "@/features/students/navigate-fresh";
import {
  downloadStudentsTemplate,
  MAX_SCHOOL_IMPORT_ROWS,
  readStudentsExcel,
} from "@/features/students/student-excel";
import { capitalizeInput, capitalizeWords as titleCase } from "@/lib/name-case";
import { cn } from "@/lib/utils";
import type { ClassOrganization } from "@/types/section";

type ImportAllStudentsFormProps = {
  schoolName: string;
  organization: ClassOrganization;
  returnTo: string;
  /** Override school portal action (admin). */
  submitAction?: (input: {
    groups: SchoolImportGroupInput[];
    returnTo?: string;
    stay?: boolean;
  }) => Promise<SchoolImportFormState>;
};

function rowFieldErrors(
  row: ResolvedImportRow,
  importRowErrors: Record<number, Record<string, string>> | undefined,
): ImportFieldErrors {
  const merged = mergeImportApiErrors([row], importRowErrors)[0]!;
  return merged.fieldErrors;
}

export function ImportAllStudentsForm({
  schoolName,
  organization,
  returnTo,
  submitAction,
}: ImportAllStudentsFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [templateBusy, setTemplateBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ResolvedImportRow[]>([]);
  const [state, setState] = useState<SchoolImportFormState>({});

  const displayRows = useMemo(
    () => mergeImportApiErrors(rows, state.importRowErrors),
    [rows, state.importRowErrors],
  );
  const groups = useMemo(() => groupImportRows(displayRows), [displayRows]);
  const errorCount = displayRows.filter((row) => Boolean(row.error)).length;
  const errorIssueCount = displayRows.reduce(
    (sum, row) => sum + Object.keys(row.fieldErrors).length,
    0,
  );
  const readyCount = displayRows.length - errorCount;
  const canSubmit = displayRows.length > 0 && errorCount === 0 && !pending;

  function applyRows(next: ResolvedImportRow[]) {
    setRows(refreshImportRows(organization, next));
    setState((prev) => ({ ...prev, importRowErrors: undefined, message: undefined, success: undefined }));
  }

  function updateStudent(
    index: number,
    patch: Partial<ResolvedImportRow["student"]>,
  ) {
    applyRows(
      rows.map((row) =>
        row.index === index ? { ...row, student: { ...row.student, ...patch } } : row,
      ),
    );
  }

  function removeRow(index: number) {
    applyRows(rows.filter((row) => row.index !== index));
  }

  function clearGroup(indexes: number[]) {
    const drop = new Set(indexes);
    applyRows(rows.filter((row) => !drop.has(row.index)));
  }

  async function downloadTemplate() {
    setTemplateBusy(true);
    try {
      await downloadStudentsTemplate({
        schoolWide: true,
        scopeLabel: schoolName,
        fileName: `students-${schoolName.replace(/\s+/g, "-").toLowerCase()}.xlsx`,
      });
    } catch {
      setState({ message: "Could not create the template. Try again." });
    } finally {
      setTemplateBusy(false);
    }
  }

  async function importFile(file: File) {
    setImporting(true);
    setState({});
    try {
      const students = await readStudentsExcel(file);
      if (!students.length) {
        setRows([]);
        setFileName(null);
        setState({
          message: `No students found in ${file.name}. Use the school template (Class, Section, Reg No).`,
        });
        return;
      }
      if (students.length > MAX_SCHOOL_IMPORT_ROWS) {
        setState({
          message: `This file has ${students.length} rows. Import at most ${MAX_SCHOOL_IMPORT_ROWS} at a time.`,
        });
        return;
      }

      const normalized = students.map((student) => ({
        ...student,
        rollNo: student.rollNo.slice(0, 7),
        name: titleCase(student.name),
        parentName: titleCase(student.parentName),
        parentPhone: student.parentPhone.replace(/\D/g, "").slice(0, 10),
        section: student.section.trim().toUpperCase(),
      }));

      setFileName(file.name);
      setRows(refreshImportRows(organization, resolveSchoolImportRows(organization, normalized)));
      setState({});
    } catch (error) {
      setRows([]);
      setFileName(null);
      setState({
        message: error instanceof Error ? error.message : "Could not read this Excel file.",
      });
    } finally {
      setImporting(false);
    }
  }

  function submit() {
    if (pending || rows.length === 0) return;

    // Re-check every draft row before calling the server so all errors show at once.
    const refreshed = refreshImportRows(organization, rows);
    setRows(refreshed);
    const blocked = refreshed.filter((row) => Boolean(row.error));
    const issueCount = blocked.reduce(
      (sum, row) => sum + Object.keys(row.fieldErrors).length,
      0,
    );
    if (blocked.length > 0) {
      setState({
        message: `Resolve all ${issueCount} error${issueCount === 1 ? "" : "s"} in ${blocked.length} row${blocked.length === 1 ? "" : "s"} before saving`,
        importRowErrors: undefined,
      });
      return;
    }

    const nextGroups = groupImportRows(refreshed);
    if (nextGroups.length === 0) {
      setState({ message: "Enter at least one student with a valid class and section" });
      return;
    }

    const payload: SchoolImportGroupInput[] = nextGroups.map((group) => ({
      programId: group.programId,
      classLevel: group.classLevel,
      sectionId: group.sectionId,
      students: group.rows.map((row) => ({
        sourceIndex: row.index,
        name: row.student.name.trim(),
        rollNo: row.student.rollNo,
        parentName: row.student.parentName.trim() || null,
        parentPhone: row.student.parentPhone.trim() || null,
        email: null,
        sectionId: group.sectionId,
      })),
    }));

    const action = submitAction ?? importSchoolStudentsAllAction;
    startTransition(async () => {
      const result = await action({
        groups: payload,
        returnTo,
        stay: true,
      });
      setState(result);
      if (!result.success) return;
      navigateFresh(router, returnTo);
    });
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-brand-200 bg-white p-4 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-brand-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-950">Import all students</p>
              <p className="mt-0.5 text-sm text-neutral-600">
                Choose Excel to load a draft. Reg No is required; student name and parent fields are
                optional. Edit rows below, then click Save — nothing is stored until then.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={templateBusy || pending}
              onClick={() => void downloadTemplate()}
            >
              {templateBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download template
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={importing || pending}
              onClick={() => fileRef.current?.click()}
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              {importing ? "Reading…" : "Choose Excel"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void importFile(file);
              }}
            />
          </div>
        </div>
      </section>

      {state.message ? (
        <Alert variant={state.success ? "default" : "destructive"}>
          {state.success ? <CheckCircle2 /> : <AlertCircle />}
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-950">
                Draft · {rows.length} student{rows.length === 1 ? "" : "s"}
                {fileName ? ` from ${fileName}` : ""}
              </p>
              <p className="text-sm text-neutral-600">
                {groups.length} class group{groups.length === 1 ? "" : "s"}
                {errorCount > 0
                  ? ` · ${errorCount} row${errorCount === 1 ? "" : "s"} · ${errorIssueCount} error${errorIssueCount === 1 ? "" : "s"} — resolve all before save`
                  : ` · ${readyCount} ready to save`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || rows.length === 0}
                onClick={() => {
                  setRows([]);
                  setFileName(null);
                  setState({});
                }}
              >
                <Trash2 className="size-4" />
                Clear draft
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSubmit}
                title={
                  errorCount > 0
                    ? `Resolve all ${errorIssueCount} error${errorIssueCount === 1 ? "" : "s"} before saving`
                    : undefined
                }
                onClick={submit}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {errorCount > 0
                  ? `Resolve ${errorIssueCount} error${errorIssueCount === 1 ? "" : "s"} to save`
                  : readyCount > 1
                    ? `Save ${readyCount} students`
                    : "Save students"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.key}
                className="overflow-hidden rounded-xl border border-brand-200 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/60 px-4 py-2">
                  <p className="text-sm font-semibold text-brand-950">
                    Class {group.classLevel}
                    {group.sectionId ? `-${group.sectionLabel}` : ""}
                    <span className="ml-2 font-normal text-neutral-600">
                      {group.programName} · {group.rows.length} student
                      {group.rows.length === 1 ? "" : "s"}
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-red-700 hover:bg-red-50 hover:text-red-800"
                    disabled={pending}
                    onClick={() => clearGroup(group.rows.map((row) => row.index))}
                  >
                    <Trash2 className="size-3.5" />
                    Remove section rows
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Reg No *</th>
                        <th className="px-3 py-2">Student (optional)</th>
                        <th className="px-3 py-2">Parent (optional)</th>
                        <th className="px-3 py-2">Mobile (optional)</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="w-12 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => {
                        const errors = rowFieldErrors(row, state.importRowErrors);
                        const hasError = Object.keys(errors).length > 0;
                        return (
                          <tr
                            key={row.index}
                            className={cn(
                              "border-t border-neutral-100",
                              hasError && "bg-red-50/70",
                            )}
                          >
                            <td className="px-3 py-2 align-top text-neutral-500">
                              {row.index + 1}
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <Input
                                value={row.student.classLevel ?? ""}
                                inputMode="numeric"
                                maxLength={2}
                                className="h-9 w-14"
                                aria-invalid={errors.classLevel ? true : undefined}
                                onChange={(e) => {
                                  const digits = e.currentTarget.value.replace(/\D/g, "").slice(0, 2);
                                  const level = digits ? Number(digits) : null;
                                  updateStudent(row.index, {
                                    classLevel:
                                      level != null && level >= 1 && level <= 12 ? level : null,
                                  });
                                }}
                              />
                              {errors.classLevel ? <FieldError>{errors.classLevel}</FieldError> : null}
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <Input
                                value={row.student.section}
                                className="h-9 w-16 uppercase"
                                maxLength={8}
                                aria-invalid={errors.section ? true : undefined}
                                onChange={(e) =>
                                  updateStudent(row.index, {
                                    section: e.currentTarget.value.toUpperCase(),
                                  })
                                }
                              />
                              {errors.section ? <FieldError>{errors.section}</FieldError> : null}
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <Input
                                value={row.student.rollNo}
                                inputMode="numeric"
                                maxLength={7}
                                className="h-9 w-24"
                                aria-invalid={errors.rollNo ? true : undefined}
                                onChange={(e) =>
                                  updateStudent(row.index, {
                                    rollNo: e.currentTarget.value.replace(/\D/g, "").slice(0, 7),
                                  })
                                }
                              />
                              {errors.rollNo ? <FieldError>{errors.rollNo}</FieldError> : null}
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <Input
                                value={row.student.name}
                                className="h-9 min-w-36"
                                placeholder="optional"
                                autoCapitalize="words"
                                aria-invalid={errors.name ? true : undefined}
                                onChange={(e) =>
                                  updateStudent(row.index, {
                                    name: capitalizeInput(e.currentTarget),
                                  })
                                }
                              />
                              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <Input
                                value={row.student.parentName}
                                className="h-9 min-w-36"
                                placeholder="optional"
                                autoCapitalize="words"
                                aria-invalid={errors.parentName ? true : undefined}
                                onChange={(e) =>
                                  updateStudent(row.index, {
                                    parentName: capitalizeInput(e.currentTarget),
                                  })
                                }
                              />
                              {errors.parentName ? <FieldError>{errors.parentName}</FieldError> : null}
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <Input
                                value={row.student.parentPhone}
                                inputMode="numeric"
                                maxLength={10}
                                className="h-9 w-28"
                                placeholder="optional"
                                aria-invalid={errors.parentPhone ? true : undefined}
                                onChange={(e) =>
                                  updateStudent(row.index, {
                                    parentPhone: e.currentTarget.value.replace(/\D/g, "").slice(0, 10),
                                  })
                                }
                              />
                              {errors.parentPhone ? (
                                <FieldError>{errors.parentPhone}</FieldError>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {hasError ? (
                                <ul className="list-disc space-y-0.5 pl-3 text-xs text-red-700">
                                  {Object.values(errors).map((message) => (
                                    <li key={message}>{message}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-emerald-700">Ready</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <button
                                type="button"
                                className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-700"
                                onClick={() => removeRow(row.index)}
                                aria-label={`Remove row ${row.index + 1}`}
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
            ))}

            {/* Rows with errors that are not already listed in a ready class group. */}
            {displayRows.some(
              (row) =>
                Boolean(row.error) &&
                !groups.some((group) => group.rows.some((item) => item.index === row.index)),
            ) ? (
              <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-100 bg-red-50/70 px-4 py-2">
                  <p className="text-sm font-semibold text-red-900">
                    Needs fixing before save · {errorIssueCount} error
                    {errorIssueCount === 1 ? "" : "s"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-red-700 hover:bg-red-100"
                    onClick={() =>
                      clearGroup(
                        displayRows.filter((row) => Boolean(row.error)).map((row) => row.index),
                      )
                    }
                  >
                    <Trash2 className="size-3.5" />
                    Remove these rows
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Reg No *</th>
                        <th className="px-3 py-2">Student (optional)</th>
                        <th className="px-3 py-2">Parent (optional)</th>
                        <th className="px-3 py-2">Mobile (optional)</th>
                        <th className="px-3 py-2">All errors</th>
                        <th className="w-12 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows
                        .filter(
                          (row) =>
                            Boolean(row.error) &&
                            !groups.some((group) =>
                              group.rows.some((item) => item.index === row.index),
                            ),
                        )
                        .map((row) => {
                          const errors = row.fieldErrors;
                          return (
                            <tr key={row.index} className="border-t border-neutral-100 bg-red-50/70">
                              <td className="px-3 py-2 align-top text-neutral-500">
                                {row.index + 1}
                              </td>
                              <td className="px-2 py-1.5 align-top">
                                <Input
                                  value={row.student.classLevel ?? ""}
                                  inputMode="numeric"
                                  maxLength={2}
                                  className="h-9 w-14"
                                  aria-invalid={errors.classLevel ? true : undefined}
                                  onChange={(e) => {
                                    const digits = e.currentTarget.value.replace(/\D/g, "").slice(0, 2);
                                    const level = digits ? Number(digits) : null;
                                    updateStudent(row.index, {
                                      classLevel:
                                        level != null && level >= 1 && level <= 12 ? level : null,
                                    });
                                  }}
                                />
                                {errors.classLevel ? (
                                  <FieldError>{errors.classLevel}</FieldError>
                                ) : null}
                              </td>
                              <td className="px-2 py-1.5 align-top">
                                <Input
                                  value={row.student.section}
                                  className="h-9 w-16 uppercase"
                                  maxLength={8}
                                  aria-invalid={errors.section ? true : undefined}
                                  onChange={(e) =>
                                    updateStudent(row.index, {
                                      section: e.currentTarget.value.toUpperCase(),
                                    })
                                  }
                                />
                                {errors.section ? <FieldError>{errors.section}</FieldError> : null}
                              </td>
                              <td className="px-2 py-1.5 align-top">
                                <Input
                                  value={row.student.rollNo}
                                  inputMode="numeric"
                                  maxLength={7}
                                  className="h-9 w-24"
                                  aria-invalid={errors.rollNo ? true : undefined}
                                  onChange={(e) =>
                                    updateStudent(row.index, {
                                      rollNo: e.currentTarget.value.replace(/\D/g, "").slice(0, 7),
                                    })
                                  }
                                />
                                {errors.rollNo ? <FieldError>{errors.rollNo}</FieldError> : null}
                              </td>
                              <td className="px-2 py-1.5 align-top">
                                <Input
                                  value={row.student.name}
                                  className="h-9 min-w-36"
                                  placeholder="optional"
                                  autoCapitalize="words"
                                  aria-invalid={errors.name ? true : undefined}
                                  onChange={(e) =>
                                    updateStudent(row.index, {
                                      name: capitalizeInput(e.currentTarget),
                                    })
                                  }
                                />
                                {errors.name ? <FieldError>{errors.name}</FieldError> : null}
                              </td>
                              <td className="px-2 py-1.5 align-top">
                                <Input
                                  value={row.student.parentName}
                                  className="h-9 min-w-36"
                                  placeholder="optional"
                                  autoCapitalize="words"
                                  aria-invalid={errors.parentName ? true : undefined}
                                  onChange={(e) =>
                                    updateStudent(row.index, {
                                      parentName: capitalizeInput(e.currentTarget),
                                    })
                                  }
                                />
                                {errors.parentName ? (
                                  <FieldError>{errors.parentName}</FieldError>
                                ) : null}
                              </td>
                              <td className="px-2 py-1.5 align-top">
                                <Input
                                  value={row.student.parentPhone}
                                  inputMode="numeric"
                                  maxLength={10}
                                  className="h-9 w-28"
                                  placeholder="optional"
                                  aria-invalid={errors.parentPhone ? true : undefined}
                                  onChange={(e) =>
                                    updateStudent(row.index, {
                                      parentPhone: e.currentTarget.value
                                        .replace(/\D/g, "")
                                        .slice(0, 10),
                                    })
                                  }
                                />
                                {errors.parentPhone ? (
                                  <FieldError>{errors.parentPhone}</FieldError>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <ul className="list-disc space-y-0.5 pl-3 text-xs text-red-700">
                                  {Object.values(errors).map((message) => (
                                    <li key={message}>{message}</li>
                                  ))}
                                </ul>
                              </td>
                              <td className="px-2 py-1.5 align-top">
                                <button
                                  type="button"
                                  className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => removeRow(row.index)}
                                  aria-label={`Remove row ${row.index + 1}`}
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
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
