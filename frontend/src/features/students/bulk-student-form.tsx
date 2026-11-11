"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileClock,
  FileSpreadsheet,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useLeaveGuard } from "@/lib/leave-guard";
import { capitalizeInput, capitalizeWords as titleCase } from "@/lib/name-case";
import {
  clearStudentDraft,
  parseStudentDraft,
  studentDraftKey,
  useStoredStudentDraft,
  writeStudentDraft,
} from "@/features/students/student-draft";
import {
  downloadStudentsTemplate,
  MAX_IMPORT_ROWS,
  readStudentsExcel,
} from "@/features/students/student-excel";
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

function emptyRow(fields?: Partial<Omit<Row, "key">>): Row {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    rollNo: "",
    parentName: "",
    parentPhone: "",
    email: "",
    ...fields,
  };
}

const isFilled = (row: Row) =>
  Boolean(row.name.trim() || row.rollNo.trim() || row.parentName.trim() || row.parentPhone.trim() || row.email.trim());

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
  const router = useRouter();
  const pathname = usePathname();
  const draftKey = studentDraftKey(pathname, defaults?.programId, defaults?.classLevel, defaults?.sectionId);
  const storedDraft = useStoredStudentDraft(draftKey);
  const draft = useMemo(() => parseStudentDraft(storedDraft), [storedDraft]);
  /** A draft from an earlier visit waits for Restore / Discard before this visit's rows are kept over it. */
  const [draftDecided, setDraftDecided] = useState(false);
  const draftPending = draft != null && !draftDecided;
  /** Saved, or the user chose to leave: no more prompts or draft writes. */
  const [done, setDone] = useState(false);
  const [leaveTo, setLeaveTo] = useState<{ proceed: () => void } | null>(null);

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

  /** First edit with no earlier draft: this visit's rows become the draft. */
  function claimDraft() {
    if (!draftDecided && !draft) setDraftDecided(true);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    claimDraft();
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
    setState({});
  }

  function restoreDraft() {
    if (!draft) return;
    setRows([...draft.rows.map((row) => emptyRow(row)), emptyRow()]);
    if (!lockPlacement) {
      setProgramId(draft.programId);
      setClassLevel(draft.classLevel ?? undefined);
      setSectionId(draft.sectionId || NONE);
    }
    setDraftDecided(true);
    setState({});
  }

  function discardDraft() {
    clearStudentDraft(draftKey);
    setDraftDecided(true);
  }

  const draftSnapshot = () => ({
    programId,
    classLevel: classLevel ?? null,
    sectionId,
    rows: rows.filter(isFilled).map((row) => ({
      name: row.name,
      rollNo: row.rollNo,
      parentName: row.parentName,
      parentPhone: row.parentPhone,
      email: row.email,
    })),
  });

  function removeRow(key: string) {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.key !== key)));
    setState({});
  }

  function addRows(count: number) {
    setRows((current) => [...current, ...Array.from({ length: count }, () => emptyRow())]);
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);

  async function importFile(file: File) {
    setImporting(true);
    setImportNote(null);
    setState({});
    try {
      const students = await readStudentsExcel(file);
      if (!students.length) {
        setState({ message: `No students found in ${file.name}. Use the template columns and keep one student per row.` });
        return;
      }
      claimDraft();
      const kept = rows.filter(isFilled);
      const room = Math.max(0, MAX_IMPORT_ROWS - kept.length);
      const added = students.slice(0, room).map((student) =>
        emptyRow({
          rollNo: student.rollNo.slice(0, 7),
          name: titleCase(student.name),
          parentName: titleCase(student.parentName),
          parentPhone: toPhoneDigits(student.parentPhone),
          email: student.email,
        }),
      );
      setRows(added.length || kept.length ? [...kept, ...added] : [emptyRow()]);
      const skipped = students.length - added.length;
      setImportNote(
        `Imported ${added.length} student${added.length === 1 ? "" : "s"} from ${file.name}` +
          (skipped ? ` · ${skipped} left out (limit ${MAX_IMPORT_ROWS} per save)` : "") +
          ". Check the rows below, then save them.",
      );
    } catch (error) {
      setState({ message: error instanceof Error ? error.message : "Could not read this Excel file." });
    } finally {
      setImporting(false);
    }
  }

  async function downloadTemplate() {
    setTemplateBusy(true);
    try {
      await downloadStudentsTemplate();
    } catch {
      setState({ message: "Could not create the template. Try again." });
    } finally {
      setTemplateBusy(false);
    }
  }

  /** `after`: where to go once saved (the page the user was leaving for); otherwise back to `returnTo`. */
  function submit(after?: () => void) {
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
        stay: true,
      });
      setState(result);
      if (!result.success) return;
      clearStudentDraft(draftKey);
      setDone(true);
      if (after) after();
      else if (!stayInPlace) router.push(returnTo);
    });
  }

  const filledCount = rows.filter(isFilled).length;

  // Keep the rows on this device as they are typed, so a refresh or browser Back loses nothing.
  useEffect(() => {
    if (done || !draftDecided) return;
    if (filledCount > 0) writeStudentDraft(draftKey, draftSnapshot());
    else clearStudentDraft(draftKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftSnapshot reads exactly these
  }, [rows, programId, classLevel, sectionId, draftDecided, done, draftKey, filledCount]);

  useLeaveGuard(
    filledCount > 0 && !done,
    (proceed) => setLeaveTo({ proceed }),
    (href) => router.push(href),
  );

  function leave(choice: "save" | "draft" | "discard") {
    const target = leaveTo;
    setLeaveTo(null);
    if (!target) return;
    if (choice === "save") {
      submit(target.proceed);
      return;
    }
    if (choice === "draft") writeStudentDraft(draftKey, draftSnapshot());
    else clearStudentDraft(draftKey);
    setDone(true);
    target.proceed();
  }

  return (
    <div className="space-y-4">
      {draftPending && draft ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <FileClock className="size-5 shrink-0 text-amber-700" />
          <p className="min-w-0 flex-1 text-sm text-amber-950">
            <span className="font-semibold">
              Unsaved draft · {draft.rows.length} student{draft.rows.length === 1 ? "" : "s"}
            </span>
            <span className="text-amber-800">
              {" "}
              · kept{" "}
              {new Date(draft.savedAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </p>
          <Button type="button" variant="outline" size="sm" onClick={discardDraft}>
            Discard draft
          </Button>
          <Button type="button" size="sm" onClick={restoreDraft}>
            Restore draft
          </Button>
        </div>
      ) : null}

      <AlertDialog open={leaveTo != null} onOpenChange={(open) => (open ? null : setLeaveTo(null))}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Save students before leaving?</AlertDialogTitle>
            <AlertDialogDescription>
              {filledCount} student{filledCount === 1 ? " is" : "s are"} not saved yet. Save them now, or keep a
              draft on this device to finish later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between">
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => leave("discard")}
              >
                Discard
              </Button>
              <Button type="button" variant="outline" onClick={() => leave("draft")}>
                Keep draft
              </Button>
              <Button type="button" onClick={() => leave("save")}>
                Save students
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-3 py-2.5">
        <FileSpreadsheet className="size-5 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-950">Import from Excel</p>
          <p className="text-xs text-neutral-500">
            Reg. no, Student name, Parent name, Parent mobile, Parent email · up to {MAX_IMPORT_ROWS} students
          </p>
        </div>
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={templateBusy}
          onClick={() => void downloadTemplate()}
        >
          {templateBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Excel template
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={importing || pending}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
          {importing ? "Reading…" : "Import Excel"}
        </Button>
      </div>

      {importNote ? (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {importNote}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-brand-100 bg-brand-50 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
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
                        inputMode="numeric"
                        maxLength={7}
                        placeholder="7 digits"
                        className="h-9"
                        aria-invalid={errors.rollNo ? true : undefined}
                        onChange={(e) =>
                          updateRow(row.key, { rollNo: e.currentTarget.value.replace(/\D/g, "").slice(0, 7) })
                        }
                      />
                      {errors.rollNo ? <FieldError>{errors.rollNo}</FieldError> : null}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <Input
                        value={row.name}
                        className="h-9"
                        aria-invalid={errors.name ? true : undefined}
                        autoCapitalize="words"
                        onChange={(e) => updateRow(row.key, { name: capitalizeInput(e.currentTarget) })}
                      />
                      {errors.name ? <FieldError>{errors.name}</FieldError> : null}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <Input
                        value={row.parentName}
                        className="h-9"
                        aria-invalid={errors.parentName ? true : undefined}
                        autoCapitalize="words"
                        onChange={(e) =>
                          updateRow(row.key, { parentName: capitalizeInput(e.currentTarget) })
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
          onClick={() => addRows(1)}
        >
          <Plus className="size-4" />
          Add row
        </Button>
        <Button type="button" variant="outline" className="gap-1.5" onClick={() => addRows(10)}>
          <Plus className="size-4" />
          Add 10 rows
        </Button>
        <Button
          type="button"
          disabled={pending || filledCount === 0}
          className="gap-1.5"
          onClick={() => submit()}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {filledCount > 1 ? `Save ${filledCount} students` : "Save student"}
        </Button>
        <p className="text-xs text-neutral-500">
          Blank rows are skipped.
        </p>
      </div>
    </div>
  );
}
