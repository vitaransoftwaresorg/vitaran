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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  importSchoolStudentsAllAction,
  type SchoolImportFormState,
  type SchoolImportGroupInput,
} from "@/features/students/actions";
import {
  groupImportRows,
  resolveSchoolImportRows,
  type ResolvedImportRow,
} from "@/features/students/import-placement";
import {
  downloadStudentsTemplate,
  MAX_SCHOOL_IMPORT_ROWS,
  readStudentsExcel,
} from "@/features/students/student-excel";
import { capitalizeWords as titleCase } from "@/lib/name-case";
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

function fieldError(
  row: ResolvedImportRow,
  importRowErrors: Record<number, Record<string, string>> | undefined,
) {
  const api = importRowErrors?.[row.index];
  if (api?.rollNo) return api.rollNo;
  if (api?.name) return api.name;
  if (api?.parentName) return api.parentName;
  if (api?.parentPhone) return api.parentPhone;
  if (api?.sectionId) return api.sectionId;
  return row.error;
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

  const groups = useMemo(() => groupImportRows(rows), [rows]);
  const errorCount = rows.filter(
    (row) => Boolean(fieldError(row, state.importRowErrors)),
  ).length;
  const readyCount = rows.length - errorCount;
  const canSubmit = rows.length > 0 && errorCount === 0 && !pending;

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

      const resolved = resolveSchoolImportRows(organization, normalized);

      // Flag duplicate reg nos inside the file.
      const seen = new Map<string, number>();
      for (const row of resolved) {
        const key = row.student.rollNo;
        if (!key) continue;
        const earlier = seen.get(key);
        if (earlier != null) {
          row.error = `Duplicate Reg No (also on row ${earlier + 1})`;
        } else {
          seen.set(key, row.index);
        }
      }

      // Require Reg No on every row.
      for (const row of resolved) {
        if (row.error) continue;
        if (!/^\d{7}$/.test(row.student.rollNo)) {
          row.error = "Reg No must be 7 digits";
        }
      }

      setFileName(file.name);
      setRows(resolved);
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
    if (!canSubmit) return;
    const payload: SchoolImportGroupInput[] = groups.map((group) => ({
      programId: group.programId,
      classLevel: group.classLevel,
      sectionId: group.sectionId,
      students: group.rows.map((row) => ({
        sourceIndex: row.index,
        name: row.student.name,
        rollNo: row.student.rollNo,
        parentName: row.student.parentName || null,
        parentPhone: row.student.parentPhone || null,
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
      router.push(returnTo);
      router.refresh();
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
                One Excel for the whole school. After submit, students are split into their classes.
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
              Choose Excel
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
                Preview · {rows.length} student{rows.length === 1 ? "" : "s"}
                {fileName ? ` from ${fileName}` : ""}
              </p>
              <p className="text-sm text-neutral-600">
                {groups.length} class group{groups.length === 1 ? "" : "s"}
                {errorCount > 0
                  ? ` · ${errorCount} row${errorCount === 1 ? "" : "s"} need fixing`
                  : ` · ${readyCount} ready to save`}
              </p>
            </div>
            <Button type="button" size="sm" disabled={!canSubmit} onClick={submit}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Submit import
            </Button>
          </div>

          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.key}
                className="overflow-hidden rounded-xl border border-brand-200 bg-white"
              >
                <div className="flex items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/60 px-4 py-2">
                  <p className="text-sm font-semibold text-brand-950">
                    Class {group.classLevel}
                    {group.sectionId ? `-${group.sectionLabel}` : ""}
                    <span className="ml-2 font-normal text-neutral-600">
                      {group.programName} · {group.rows.length} student
                      {group.rows.length === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Reg No</th>
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Parent</th>
                        <th className="px-3 py-2">Mobile</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => {
                        const error = fieldError(row, state.importRowErrors);
                        return (
                          <tr
                            key={row.index}
                            className={cn(
                              "border-t border-neutral-100",
                              error && "bg-red-50/70",
                            )}
                          >
                            <td className="px-3 py-2 text-neutral-500">{row.index + 1}</td>
                            <td className="px-3 py-2 font-medium tabular-nums">
                              {row.student.rollNo || "—"}
                            </td>
                            <td className="px-3 py-2">{row.student.name || "—"}</td>
                            <td className="px-3 py-2">{row.student.parentName || "—"}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.student.parentPhone || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {error ? (
                                <span className="text-red-700">{error}</span>
                              ) : (
                                <span className="text-emerald-700">Ready</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Rows that could not be placed in any class still need to be visible. */}
            {rows.some((row) => !row.placement) ? (
              <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
                <div className="border-b border-red-100 bg-red-50/70 px-4 py-2">
                  <p className="text-sm font-semibold text-red-900">Needs a valid class</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Reg No</th>
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .filter((row) => !row.placement)
                        .map((row) => {
                          const error = fieldError(row, state.importRowErrors);
                          return (
                            <tr key={row.index} className="border-t border-neutral-100 bg-red-50/70">
                              <td className="px-3 py-2 text-neutral-500">{row.index + 1}</td>
                              <td className="px-3 py-2">
                                {row.student.classLevel ?? "—"}
                              </td>
                              <td className="px-3 py-2">{row.student.section || "—"}</td>
                              <td className="px-3 py-2 font-medium tabular-nums">
                                {row.student.rollNo || "—"}
                              </td>
                              <td className="px-3 py-2">{row.student.name || "—"}</td>
                              <td className="px-3 py-2 text-red-700">
                                {error ?? "Could not place"}
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
