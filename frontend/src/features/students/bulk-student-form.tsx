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
import { capitalizeInput, capitalizeWords as titleCase } from "@/lib/name-case";
import { navigateFresh } from "@/features/students/navigate-fresh";
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
  sectionId: string;
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
    sectionId: NONE,
    ...fields,
  };
}

/** True when the row has student data — section alone (from class defaults) does not count. */
const isFilled = (row: Row) =>
  Boolean(
    row.name.trim() || row.rollNo.trim() || row.parentName.trim() || row.parentPhone.trim(),
  );

function validateBulkRows(
  rows: Row[],
  options: { requireSection: boolean },
): Record<number, Record<string, string>> {
  const rowErrors: Record<number, Record<string, string>> = {};
  const seenRolls = new Map<string, number>();
  rows.forEach((row, index) => {
    if (!isFilled(row)) return;
    const errors: Record<string, string> = {};
    const rawRoll = row.rollNo.replace(/\D/g, "").slice(0, 7);
    const roll = !rawRoll || /^0+$/.test(rawRoll) ? "0000000" : rawRoll;
    if (rawRoll.length > 0 && rawRoll.length !== 7) {
      errors.rollNo = "Enter the 7-digit registration number (or blank / 0000000)";
    } else if (roll !== "0000000") {
      const earlier = seenRolls.get(roll);
      if (earlier != null) {
        errors.rollNo = `Duplicate Reg No (also on row ${earlier + 1})`;
        const prior = rowErrors[earlier] ?? {};
        prior.rollNo = `Duplicate Reg No (also on row ${index + 1})`;
        rowErrors[earlier] = prior;
      } else {
        seenRolls.set(roll, index);
      }
    }
    const phone = row.parentPhone.replace(/\D/g, "").slice(0, 10);
    if (phone && !/^\d{10}$/.test(phone)) {
      errors.parentPhone = "Enter a 10-digit mobile number";
    }
    const name = row.name.trim();
    if (name && name.length < 2) errors.name = "Enter at least 2 characters";
    const parentName = row.parentName.trim();
    if (parentName && parentName.length < 2) {
      errors.parentName = "Enter a parent / guardian name (at least 2 characters)";
    }
    if (options.requireSection && (!row.sectionId || row.sectionId === NONE)) {
      errors.sectionId = "Pick a section";
    }
    if (Object.keys(errors).length > 0) {
      rowErrors[index] = { ...(rowErrors[index] ?? {}), ...errors };
    }
  });
  return rowErrors;
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
    Array.from({ length: EMPTY_ROWS }, () =>
      emptyRow({ sectionId: defaults?.sectionId ?? NONE }),
    ),
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
  /** Saved successfully — stop writing drafts. */
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (state.success && state.count != null) onSuccess?.(state.count);
  }, [state.success, state.count, onSuccess]);

  const placementReady = Boolean(programId) && classLevel != null;

  const sectionOptions = useMemo(() => {
    if (!placementReady) return [];
    return sections.filter(
      (s) => s.programId === programId && s.classLevel === classLevel,
    );
  }, [sections, programId, classLevel, placementReady]);

  const hasNamedSections = sectionOptions.length > 0;
  /**
   * From Students (class/section open): placement is fixed — never show a section picker.
   * Free Add students (no class context): allow per-row section when the class has sections.
   */
  const fixedSection = lockPlacement;
  const perRowSection = hasNamedSections && !lockPlacement;

  useEffect(() => {
    if (!placementReady) return;
    if (!hasNamedSections) {
      if (sectionId !== NONE) setSectionId(NONE);
      return;
    }
    // Locked from class/section: keep the default section on every row.
    if (lockPlacement && defaults?.sectionId) {
      if (sectionId !== defaults.sectionId) setSectionId(defaults.sectionId);
      setRows((current) => {
        if (current.every((row) => row.sectionId === defaults.sectionId)) return current;
        return current.map((row) => ({ ...row, sectionId: defaults.sectionId! }));
      });
      return;
    }
    if (sectionId === NONE) return;
    if (!sectionOptions.some((s) => s.id === sectionId)) {
      setSectionId(NONE);
    }
  }, [
    placementReady,
    hasNamedSections,
    sectionOptions,
    sectionId,
    lockPlacement,
    defaults?.sectionId,
  ]);

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

  function sectionIdForName(name: string | null | undefined) {
    if (!name) return NONE;
    const match = sectionOptions.find(
      (section) => section.name.trim().toUpperCase() === name.trim().toUpperCase(),
    );
    return match?.id ?? NONE;
  }

  function restoreDraft() {
    if (!draft) return;
    setRows([
      ...draft.rows.map((row) =>
        emptyRow({
          ...row,
          sectionId: row.sectionId || NONE,
        }),
      ),
      emptyRow({ sectionId: fixedSection ? sectionId : sectionId !== NONE ? sectionId : NONE }),
    ]);
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
      sectionId: row.sectionId === NONE ? "" : row.sectionId,
    })),
  });

  function removeRow(key: string) {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.key !== key)));
    setState({});
  }

  function addRows(count: number) {
    const defaultSection = fixedSection || sectionId !== NONE ? sectionId : NONE;
    setRows((current) => [
      ...current,
      ...Array.from({ length: count }, () => emptyRow({ sectionId: defaultSection })),
    ]);
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
      // Drop blank starter rows (they often only have a default section) so import fills from the top.
      const kept = rows.filter(isFilled);
      const room = Math.max(0, MAX_IMPORT_ROWS - kept.length);
      const defaultSection = fixedSection || sectionId !== NONE ? sectionId : NONE;
      const added = students.slice(0, room).map((student) => {
        const fromSheet = sectionIdForName(student.section);
        return emptyRow({
          rollNo: student.rollNo.slice(0, 7),
          name: titleCase(student.name),
          parentName: titleCase(student.parentName),
          parentPhone: toPhoneDigits(student.parentPhone),
          sectionId: fixedSection
            ? defaultSection
            : fromSheet !== NONE
              ? fromSheet
              : defaultSection,
        });
      });
      setRows(
        added.length || kept.length
          ? [...kept, ...added, emptyRow({ sectionId: defaultSection })]
          : [emptyRow({ sectionId: defaultSection })],
      );
      const skipped = students.length - added.length;
      setImportNote(
        `Loaded ${added.length} student${added.length === 1 ? "" : "s"} from ${file.name} into a draft` +
          (skipped ? ` · ${skipped} left out (limit ${MAX_IMPORT_ROWS} per save)` : "") +
          (perRowSection ? " · set Section per row if needed" : "") +
          ". Nothing is saved yet — review the rows, then click Save.",
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
      await downloadStudentsTemplate({
        includeSection: perRowSection,
        scopeLabel: placementReady ? placementLabel : undefined,
        fileName: placementReady
          ? `students-${placementLabel.replace(/\s+/g, "-").toLowerCase()}.xlsx`
          : undefined,
      });
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

    // Validate every filled row up front — Save only continues when every error is resolved.
    const rowErrors = validateBulkRows(rows, { requireSection: perRowSection });
    if (Object.keys(rowErrors).length > 0) {
      const issueCount = Object.values(rowErrors).reduce(
        (sum, errors) => sum + Object.keys(errors).length,
        0,
      );
      setState({
        message: `Resolve all ${issueCount} error${issueCount === 1 ? "" : "s"} before saving`,
        rowErrors,
      });
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
          email: null,
          sectionId:
            perRowSection || fixedSection
              ? row.sectionId === NONE
                ? null
                : row.sectionId
              : undefined,
        })),
        returnTo,
        // Always return so we can clear the draft; navigate/refresh on the client.
        stay: true,
      });
      setState(result);
      if (!result.success) return;
      clearStudentDraft(draftKey);
      setDone(true);
      if (after) after();
      else if (!stayInPlace) {
        navigateFresh(router, returnTo);
      }
    });
  }

  const filledCount = rows.filter(isFilled).length;
  const liveRowErrors = useMemo(
    () => validateBulkRows(rows, { requireSection: perRowSection }),
    [rows, perRowSection],
  );
  const displayRowErrors = useMemo(() => {
    const merged: Record<number, Record<string, string>> = { ...liveRowErrors };
    for (const [index, errors] of Object.entries(state.rowErrors ?? {})) {
      const key = Number(index);
      merged[key] = { ...(merged[key] ?? {}), ...errors };
    }
    return merged;
  }, [liveRowErrors, state.rowErrors]);
  const liveErrorCount = Object.keys(liveRowErrors).length;
  const liveIssueCount = Object.values(liveRowErrors).reduce(
    (sum, errors) => sum + Object.keys(errors).length,
    0,
  );

  // Keep the rows on this device as they are typed, so a refresh or browser Back loses nothing.
  useEffect(() => {
    if (done || !draftDecided) return;
    if (filledCount > 0) writeStudentDraft(draftKey, draftSnapshot());
    else clearStudentDraft(draftKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftSnapshot reads exactly these
  }, [rows, programId, classLevel, sectionId, draftDecided, done, draftKey, filledCount]);

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

      {state.message ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {placementReady ? (
        <p className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm font-medium text-brand-950">
          {capitalizeWords(placementLabel)}
        </p>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Open <span className="font-semibold">Add students</span> from a class so program and
          class are set automatically.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-3 py-2.5">
        <FileSpreadsheet className="size-5 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-950">Load from Excel (draft)</p>
          <p className="text-xs text-neutral-500">
            Fills the table only — click Save to store students. Reg No * ·{" "}
            {perRowSection ? "Section * · " : ""}name/parent optional · up to {MAX_IMPORT_ROWS}
            {perRowSection ? " · mix sections in one file" : ""}
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
          {importing ? "Reading…" : "Load Excel"}
        </Button>
      </div>

      {importNote ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <FileClock className="mt-0.5 size-4 shrink-0" />
          {importNote}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-brand-100 bg-brand-50 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              <tr>
                <th className="w-10 px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Reg No *</th>
                {perRowSection ? <th className="px-3 py-2.5">Section *</th> : null}
                <th className="px-3 py-2.5">Student name (optional)</th>
                <th className="px-3 py-2.5">Parent name (optional)</th>
                <th className="px-3 py-2.5">Parent mobile (optional)</th>
                <th className="w-12 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const errors = displayRowErrors[index] ?? {};
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
                          updateRow(row.key, {
                            rollNo: e.currentTarget.value.replace(/\D/g, "").slice(0, 7),
                          })
                        }
                      />
                      {errors.rollNo ? <FieldError>{errors.rollNo}</FieldError> : null}
                    </td>
                    {perRowSection ? (
                      <td className="px-2 py-1.5 align-top">
                        <Select
                          value={row.sectionId === NONE ? null : row.sectionId}
                          items={sectionItems}
                          onValueChange={(v) => updateRow(row.key, { sectionId: v ?? NONE })}
                        >
                          <SelectTrigger
                            className="h-9 w-full min-w-24"
                            aria-invalid={errors.sectionId ? true : undefined}
                          >
                            <SelectValue placeholder="Section" />
                          </SelectTrigger>
                          <SelectContent>
                            {sectionItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label.replace(/^Section\s+/i, "")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.sectionId ? <FieldError>{errors.sectionId}</FieldError> : null}
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5 align-top">
                      <Input
                        value={row.name}
                        className="h-9"
                        placeholder="optional"
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
                        placeholder="optional"
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
                        placeholder="optional"
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
        {filledCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 text-red-700 hover:bg-red-50 hover:text-red-800"
            disabled={pending}
            onClick={() => {
              const defaultSection = fixedSection || sectionId !== NONE ? sectionId : NONE;
              setRows([emptyRow({ sectionId: defaultSection })]);
              setImportNote(null);
              setState({});
            }}
          >
            <Trash2 className="size-4" />
            Clear all rows
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={pending || filledCount === 0 || liveErrorCount > 0}
          className="gap-1.5"
          title={
            liveErrorCount > 0
              ? `Resolve all ${liveIssueCount} error${liveIssueCount === 1 ? "" : "s"} before saving`
              : undefined
          }
          onClick={() => submit()}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {liveErrorCount > 0
            ? `Resolve ${liveIssueCount} error${liveIssueCount === 1 ? "" : "s"} to save`
            : filledCount > 1
              ? `Save ${filledCount} students`
              : "Save student"}
        </Button>
        <p className="text-xs text-neutral-500">
          {liveErrorCount > 0
            ? `Fix every highlighted field (${liveIssueCount} error${liveIssueCount === 1 ? "" : "s"}) — nothing is saved until then.`
            : "Excel loads a draft only — students are stored when you click Save. Blank rows are skipped."}
        </p>
      </div>
    </div>
  );
}
