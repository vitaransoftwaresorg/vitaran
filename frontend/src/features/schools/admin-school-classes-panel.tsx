"use client";

import { memo, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { matchesSearch, TableSearch } from "@/components/shared/table-search";
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
  SUBJECT_LABELS,
  subjectLabel,
  subjectsForClassLevel,
} from "@/features/schools/constants";
import {
  createAdminSectionAction,
  deleteAdminSectionAction,
  updateAdminClassSubjectsAction,
  updateAdminSectionAction,
  updateAdminWholeClassAction,
} from "@/features/schools/section-actions";
import { capitalizeWords } from "@/features/schools/schema";
import { STUDENTS_PATH } from "@/features/students/school-roster";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/format";
import type { SchoolProgramOffering } from "@/types/program";
import type { Subject } from "@/types/school";
import type { ClassOrganization, SectionInput } from "@/types/section";
import type { ClassTeacherSlot } from "@/types/teacher";

const linkBtn =
  "inline-flex items-center gap-1.5 font-medium text-brand-900 transition-colors hover:text-brand-700 hover:underline";

const EMPTY = "—";

type ClassRow = {
  key: string;
  kind: "section" | "whole";
  id: string;
  classLevel: number;
  section: string;
  programId: string;
  programName: string;
  subjects: Subject[];
  seats: number;
  teacherId: string | null;
  teacherName: string | null;
  draft?: boolean;
};

export type DeferredClassCreate = SectionInput & {
  draftId: string;
  programName: string;
  subjects: Subject[];
};

export type DeferredClassChanges = {
  creates: DeferredClassCreate[];
  deleteSectionIds: string[];
};

type AdminSchoolClassesPanelProps = {
  schoolId?: string;
  schoolPrograms: SchoolProgramOffering[];
  organization: ClassOrganization;
  classTeacherSlots: ClassTeacherSlot[];
  seatsUsedLabel: string;
  teachersHref: string;
  /** Panel heading — default Programs & classes. */
  heading?: string;
  /** Nest under an existing form section (no outer card / title). */
  embedded?: boolean;
  /** Cap class/section seats by school total strength. */
  strength?: { studentStrength: number | null; used: number };
  /** When deferred, Add/Delete stay local until school Save. Seat edits on saved rows save immediately. */
  persist?: "immediate" | "deferred";
  /** Restored class drafts after refresh (registration form). */
  initialCreates?: DeferredClassCreate[];
  initialDeletes?: string[];
  onDeferredChange?: (changes: DeferredClassChanges) => void;
  /** Called when Add class sets subject access for a program + class. */
  onSubjectAccessChange?: (
    programId: string,
    classLevel: number,
    subjects: Subject[],
  ) => void;
};

export const AdminSchoolClassesPanel = memo(function AdminSchoolClassesPanel({
  schoolId,
  schoolPrograms,
  organization,
  classTeacherSlots,
  seatsUsedLabel,
  teachersHref,
  heading = "Programs & classes",
  embedded = false,
  strength,
  persist = "immediate",
  initialCreates = [],
  initialDeletes = [],
  onDeferredChange,
  onSubjectAccessChange,
}: AdminSchoolClassesPanelProps) {
  const deferred = persist === "deferred";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [classLevel, setClassLevel] = useState("");
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [studentCount, setStudentCount] = useState("30");
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [errors, setErrors] = useState<
    Partial<Record<"classLevel" | "programId" | "studentCount" | "name" | "subjects", string>>
  >({});
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [editSeats, setEditSeats] = useState("");
  const [editName, setEditName] = useState("");
  const [editProgramId, setEditProgramId] = useState("");
  const [editSubjects, setEditSubjects] = useState<Subject[]>([]);
  const [editErrors, setEditErrors] = useState<
    Partial<Record<"studentCount" | "name" | "subjects" | "programId", string>>
  >({});
  const [draftCreates, setDraftCreates] = useState<DeferredClassCreate[]>(initialCreates);
  const [draftDeletes, setDraftDeletes] = useState<string[]>(initialDeletes);

  const onDeferredChangeRef = useRef(onDeferredChange);
  onDeferredChangeRef.current = onDeferredChange;

  useEffect(() => {
    if (!deferred) return;
    onDeferredChangeRef.current?.({
      creates: draftCreates,
      deleteSectionIds: draftDeletes,
    });
  }, [deferred, draftCreates, draftDeletes]);

  const classCtByKey = useMemo(() => {
    const map = new Map<string, ClassTeacherSlot>();
    for (const slot of classTeacherSlots) {
      if (slot.kind === "class") {
        map.set(`${slot.programId}:${slot.classLevel}`, slot);
      }
    }
    return map;
  }, [classTeacherSlots]);

  function accessSubjects(programId: string, classLevel: number, fallback: Subject[] = []): Subject[] {
    const fromOffering =
      schoolPrograms
        .find((row) => row.programId === programId)
        ?.classes.find((row) => row.classLevel === classLevel)?.subjects ?? [];
    return fromOffering.length > 0 ? fromOffering : fallback;
  }

  /** Full subject checklist: catalog + class defaults + known subjects. */
  function allSubjectsFor(programId: string, classLevel: number): Subject[] {
    const program = schoolPrograms.find((row) => row.programId === programId);
    return [
      ...new Set([
        ...(program?.catalogSubjects ?? []),
        ...(subjectsForClassLevel(classLevel) as Subject[]),
        ...(Object.keys(SUBJECT_LABELS) as Subject[]),
      ]),
    ];
  }

  const [query, setQuery] = useState("");

  const classRows: ClassRow[] = useMemo(() => {
    const rows: ClassRow[] = [
      ...organization.wholeClasses.map((row) => {
        const ct = classCtByKey.get(`${row.programId}:${row.classLevel}`);
        return {
          key: `w-${row.id}`,
          kind: "whole" as const,
          id: row.id,
          classLevel: row.classLevel,
          section: "A",
          programId: row.programId,
          programName: row.programName,
          subjects: accessSubjects(row.programId, row.classLevel),
          seats: row.studentCount,
          teacherId: ct?.teacherId ?? null,
          teacherName: ct?.teacherName ?? null,
        };
      }),
      ...organization.sections
        .filter((section) => !draftDeletes.includes(section.id))
        .map((section) => ({
          key: `s-${section.id}`,
          kind: "section" as const,
          id: section.id,
          classLevel: section.classLevel,
          section: section.name,
          programId: section.programId,
          programName: section.programName,
          subjects: accessSubjects(section.programId, section.classLevel),
          seats: section.studentCount,
          teacherId: section.classTeacher?.teacherId ?? null,
          teacherName: section.classTeacher?.name ?? null,
        })),
      ...draftCreates.map((row) => ({
        key: row.draftId,
        kind: "section" as const,
        id: row.draftId,
        classLevel: row.classLevel,
        section: row.name?.trim() || "A",
        programId: row.programId,
        programName: row.programName,
        subjects: accessSubjects(row.programId, row.classLevel, row.subjects),
        seats: row.studentCount,
        teacherId: null,
        teacherName: null,
        draft: true,
      })),
    ];
    return rows.sort(
      (a, b) =>
        a.classLevel - b.classLevel ||
        a.section.localeCompare(b.section) ||
        a.programName.localeCompare(b.programName),
    );
    // accessSubjects closes over schoolPrograms
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, classCtByKey, draftCreates, draftDeletes, schoolPrograms]);

  const filteredRows = useMemo(
    () =>
      classRows.filter((row) =>
        matchesSearch(
          query,
          row.classLevel,
          row.section,
          row.programName,
          row.seats,
          row.teacherName,
          ...row.subjects.map((subject) => subjectLabel(subject)),
        ),
      ),
    [classRows, query],
  );

  const programsForEdit = useMemo(() => {
    if (!editing) return [];
    return schoolPrograms.filter(
      (row) =>
        row.programId === editing.programId ||
        row.classes.some((cls) => cls.classLevel === editing.classLevel) ||
        (editing.classLevel >= row.classFrom && editing.classLevel <= row.classTo),
    );
  }, [editing, schoolPrograms]);

  const editAvailableSubjects = useMemo(() => {
    if (!editing || !editProgramId) return [];
    return allSubjectsFor(editProgramId, editing.classLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, editProgramId, schoolPrograms]);

  const editProgramSelectItems = useMemo(
    () =>
      programsForEdit.map((row) => ({
        value: row.programId,
        label: capitalizeWords(row.programName),
      })),
    [programsForEdit],
  );

  const classOptions = useMemo(() => {
    const levels = new Set<number>();
    for (const program of schoolPrograms) {
      for (const cls of program.classes) levels.add(cls.classLevel);
    }
    return [...levels].sort((a, b) => a - b);
  }, [schoolPrograms]);

  const programsForClass = useMemo(() => {
    const level = Number(classLevel);
    if (!level) return [];
    return schoolPrograms.filter((row) =>
      row.classes.some((cls) => cls.classLevel === level),
    );
  }, [schoolPrograms, classLevel]);

  const availableSubjects = useMemo((): Subject[] => {
    if (!programId || !classLevel) return [];
    return allSubjectsFor(programId, Number(classLevel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, classLevel, schoolPrograms]);

  // Only clear picks when Programs & classes checks remove that option — not on
  // every array identity change or when a Select popup closes with null.
  const classOptionsKey = classOptions.join(",");
  const programsForClassKey = programsForClass.map((row) => row.programId).join(",");
  useEffect(() => {
    if (classLevel && !classOptions.includes(Number(classLevel))) {
      setClassLevel("");
      setProgramId("");
      setSelectedSubjects([]);
      return;
    }
    if (
      programId &&
      !programsForClass.some((row) => row.programId === programId)
    ) {
      setProgramId("");
      setSelectedSubjects([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable keys
  }, [classLevel, classOptionsKey, programId, programsForClassKey]);

  // Reset subject picks when program or class changes — leave unchecked until chosen.
  useEffect(() => {
    setSelectedSubjects([]);
    setErrors((prev) => ({ ...prev, subjects: undefined }));
  }, [programId, classLevel]);

  function classStudentsHref(level: number, section: string) {
    if (!schoolId) return teachersHref;
    return `${STUDENTS_PATH}?${new URLSearchParams({
      school: schoolId,
      class: String(level),
      section,
    })}`;
  }

  function resetCreate() {
    setClassLevel("");
    setName("");
    setProgramId("");
    setStudentCount("30");
    setSelectedSubjects([]);
    setErrors({});
  }

  function toggleSubject(subject: Subject, checked: boolean) {
    setSelectedSubjects((prev) => {
      if (checked) return prev.includes(subject) ? prev : [...prev, subject];
      return prev.filter((value) => value !== subject);
    });
    setErrors((prev) => ({ ...prev, subjects: undefined }));
  }

  function create() {
    const level = Number(classLevel);
    const count = Number(studentCount);
    const nextErrors: typeof errors = {};
    if (!classLevel || !level) nextErrors.classLevel = "Select a class";
    else if (!classOptions.includes(level)) {
      nextErrors.classLevel = "That class is not enabled for this school";
    }
    if (!programId) nextErrors.programId = "Select a program";
    else if (level && !programsForClass.some((row) => row.programId === programId)) {
      nextErrors.programId = "That program is not enabled for the selected class";
    }
    if (!studentCount.trim()) nextErrors.studentCount = "Enter seats";
    else if (!Number.isInteger(count) || count < 1) {
      nextErrors.studentCount = "Enter a valid seat count (1 or more)";
    } else {
      const over = strengthError(count);
      if (over) nextErrors.studentCount = over;
    }
    if (programId && selectedSubjects.length === 0) {
      nextErrors.subjects = "Select at least one subject";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    const sectionName = name.trim() || "A";
    const programName =
      programsForClass.find((row) => row.programId === programId)?.programName ?? "";
    const subjects = [...selectedSubjects];

    if (deferred) {
      const duplicate = classRows.some(
        (row) =>
          row.classLevel === level &&
          row.section.toUpperCase() === sectionName.toUpperCase() &&
          row.programName === programName,
      );
      if (duplicate) {
        setErrors({ name: `Section ${sectionName} already listed for class ${level}` });
        return;
      }
      onSubjectAccessChange?.(programId, level, subjects);
      setDraftCreates((prev) => [
        ...prev,
        {
          draftId: `draft-${crypto.randomUUID()}`,
          classLevel: level,
          name: sectionName,
          programId,
          programName,
          studentCount: count,
          subjects,
        },
      ]);
      toast.success(`Class ${level}-${sectionName} added`);
      setCreating(false);
      resetCreate();
      return;
    }

    if (!schoolId) return;

    startTransition(async () => {
      const subjectResult = await updateAdminClassSubjectsAction(schoolId, {
        programId,
        classLevel: level,
        subjects,
      });
      if (!subjectResult.ok) {
        setErrors({ subjects: subjectResult.message });
        return;
      }

      const result = await createAdminSectionAction(schoolId, {
        classLevel: level,
        name: sectionName,
        programId,
        studentCount: count,
      });
      if (!result.ok) {
        setErrors({ studentCount: result.message });
        return;
      }
      if (result.result.kind === "section") {
        toast.success(
          `Section ${result.result.section.classLevel}-${result.result.section.name} created`,
        );
      } else {
        toast.success(`Class ${result.result.class.classLevel}-A created`);
      }
      setCreating(false);
      resetCreate();
      router.refresh();
    });
  }

  function openEdit(row: ClassRow) {
    setEditing(row);
    setEditSeats(String(row.seats));
    setEditName(row.section);
    setEditProgramId(row.programId);
    setEditSubjects([...row.subjects]);
    setEditErrors({});
  }

  function toggleEditSubject(subject: Subject, checked: boolean) {
    setEditSubjects((prev) => {
      if (checked) return prev.includes(subject) ? prev : [...prev, subject];
      return prev.filter((value) => value !== subject);
    });
    setEditErrors((prev) => ({ ...prev, subjects: undefined }));
  }

  function selectAllEditSubjects() {
    setEditSubjects([...editAvailableSubjects]);
    setEditErrors((prev) => ({ ...prev, subjects: undefined }));
  }

  function clearEditSubjects() {
    setEditSubjects([]);
  }

  function seatsRemaining(excludeCurrentSeats = 0) {
    const ceiling = strength?.studentStrength;
    if (ceiling == null) return null;
    const draftSeats = draftCreates.reduce((sum, row) => sum + row.studentCount, 0);
    const deletedSeats = organization.sections
      .filter((section) => draftDeletes.includes(section.id))
      .reduce((sum, section) => sum + section.studentCount, 0);
    const used = (strength?.used ?? 0) - excludeCurrentSeats - deletedSeats + draftSeats;
    return Math.max(0, ceiling - used);
  }

  function strengthError(count: number, excludeCurrentSeats = 0) {
    const remaining = seatsRemaining(excludeCurrentSeats);
    if (remaining == null) return undefined;
    if (count > remaining) {
      return `Only ${remaining} seat${remaining === 1 ? "" : "s"} left under school strength (${formatNumber(strength!.studentStrength!)} total)`;
    }
    return undefined;
  }

  function persistClassEdit(
    editingRow: ClassRow,
    count: number,
    sectionName: string,
    nextProgramId: string,
  ) {
    if (!schoolId) return;
    startTransition(async () => {
      if (editingRow.kind === "section") {
        const result = await updateAdminSectionAction(schoolId, editingRow.id, {
          name: sectionName,
          programId: nextProgramId,
          studentCount: count,
        });
        if (!result.ok) {
          setEditErrors({ studentCount: result.message });
          return;
        }
        toast.success(`Section ${editingRow.classLevel}-${sectionName} updated`);
      } else {
        const result = await updateAdminWholeClassAction(schoolId, editingRow.id, {
          programId: nextProgramId,
          studentCount: count,
        });
        if (!result.ok) {
          setEditErrors({ studentCount: result.message });
          return;
        }
        toast.success(`Class ${editingRow.classLevel}-A updated`);
      }
      setEditing(null);
      router.refresh();
    });
  }

  function saveEdit() {
    if (!editing) return;
    const count = Number(editSeats);
    const nextErrors: typeof editErrors = {};
    if (!editProgramId) nextErrors.programId = "Select a program";
    if (!editSeats.trim()) nextErrors.studentCount = "Enter seats";
    else if (!Number.isInteger(count) || count < 1) {
      nextErrors.studentCount = "Enter a valid seat count (1 or more)";
    } else {
      const over = strengthError(count, editing.seats);
      if (over) nextErrors.studentCount = over;
    }
    if (editing.kind === "section" && !editName.trim()) {
      nextErrors.name = "Section name is required";
    }
    if (editSubjects.length === 0) {
      nextErrors.subjects = "Select at least one subject";
    }
    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors);
      return;
    }
    setEditErrors({});

    const sectionName = editName.trim().toUpperCase();
    const subjects = [...editSubjects];
    const nextProgramId = editProgramId;
    const nextProgramName =
      programsForEdit.find((row) => row.programId === nextProgramId)?.programName ??
      editing.programName;

    if (deferred && (editing.draft || editing.id.startsWith("draft-"))) {
      onSubjectAccessChange?.(nextProgramId, editing.classLevel, subjects);
      setDraftCreates((prev) =>
        prev.map((item) =>
          item.draftId === editing.id
            ? {
                ...item,
                studentCount: count,
                name: editing.kind === "section" ? sectionName : item.name,
                programId: nextProgramId,
                programName: nextProgramName,
                subjects,
              }
            : item,
        ),
      );
      toast.success("Class updated");
      setEditing(null);
      return;
    }

    if (!schoolId) {
      onSubjectAccessChange?.(nextProgramId, editing.classLevel, subjects);
      toast.error("Save the school first, then edit this class");
      return;
    }

    startTransition(async () => {
      const subjectResult = await updateAdminClassSubjectsAction(schoolId, {
        programId: nextProgramId,
        classLevel: editing.classLevel,
        subjects,
        fromProgramId: editing.programId,
      });
      if (!subjectResult.ok) {
        setEditErrors({ subjects: subjectResult.message });
        return;
      }
      onSubjectAccessChange?.(nextProgramId, editing.classLevel, subjects);
      persistClassEdit(editing, count, sectionName, nextProgramId);
    });
  }

  function removeSection(row: ClassRow) {
    if (row.kind !== "section") return;
    if (
      !window.confirm(
        `Delete section ${row.classLevel}-${row.section}? Students in this section will also be removed from the roster, results, and ranks.`,
      )
    ) {
      return;
    }

    if (deferred) {
      if (row.draft || row.id.startsWith("draft-")) {
        setDraftCreates((prev) => prev.filter((item) => item.draftId !== row.id));
      } else {
        setDraftDeletes((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
      }
      toast.success("Section removed");
      return;
    }

    if (!schoolId) return;
    startTransition(async () => {
      const result = await deleteAdminSectionAction(schoolId, row.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Section deleted");
      router.refresh();
    });
  }

  const studentsSchoolHref = schoolId
    ? `${STUDENTS_PATH}?${new URLSearchParams({ school: schoolId })}`
    : null;

  const classSelectItems = useMemo(
    () =>
      classOptions.map((level) => ({
        value: String(level),
        label: `Class ${level}`,
      })),
    [classOptions],
  );
  const programSelectItems = useMemo(
    () =>
      programsForClass.map((row) => ({
        value: row.programId,
        label: capitalizeWords(row.programName),
      })),
    [programsForClass],
  );

  const openAddClass = () => {
    resetCreate();
    setCreating(true);
  };

  const addClassButton = (
    <Button
      type="button"
      size="sm"
      className="h-8 gap-1.5"
      disabled={pending || creating || classOptions.length === 0}
      onClick={openAddClass}
    >
      <Plus className="size-3.5" />
      Add class
    </Button>
  );

  const toolbar = (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        embedded
          ? "pt-1"
          : "border-b border-brand-100 bg-brand-50/60 px-4 py-2.5",
      )}
    >
      {embedded ? (
        <p className="text-xs font-medium text-neutral-500 tabular-nums">{seatsUsedLabel}</p>
      ) : (
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-950">
          {heading}
        </h2>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {!embedded ? (
          <span className="font-medium text-neutral-600 tabular-nums">{seatsUsedLabel}</span>
        ) : null}
        {studentsSchoolHref ? (
          <Link
            href={studentsSchoolHref}
            className="font-semibold text-brand-900 transition-colors hover:text-brand-700"
          >
            View students
          </Link>
        ) : null}
        {addClassButton}
      </div>
    </div>
  );

  return (
    <section
      className={
        embedded
          ? "space-y-3"
          : "rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]"
      }
    >
      {toolbar}

      <AlertDialog
        open={editing != null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setEditing(null);
            setEditErrors({});
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit class</AlertDialogTitle>
            <AlertDialogDescription>
              {editing
                ? `Class ${editing.classLevel}-${editing.kind === "section" ? editName || editing.section : "A"} · ${capitalizeWords(editing.programName)}`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 py-1">
            {editing?.kind === "section" ? (
              <Field data-invalid={editErrors.name ? true : undefined}>
                <FieldLabel>Section</FieldLabel>
                <Input
                  value={editName}
                  maxLength={32}
                  className="h-9 uppercase"
                  onChange={(e) => {
                    setEditName(e.currentTarget.value.toUpperCase());
                    setEditErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                />
                {editErrors.name ? <FieldError>{editErrors.name}</FieldError> : null}
              </Field>
            ) : null}
            <Field data-invalid={editErrors.programId ? true : undefined}>
              <FieldLabel>Program *</FieldLabel>
              <Select
                value={editProgramId || null}
                items={editProgramSelectItems}
                onValueChange={(value) => {
                  if (value == null) return;
                  setEditProgramId(value);
                  const nextSubjects = allSubjectsFor(value, editing?.classLevel ?? 0);
                  setEditSubjects((prev) => {
                    const kept = prev.filter((subject) => nextSubjects.includes(subject));
                    return kept.length > 0 ? kept : nextSubjects;
                  });
                  setEditErrors((prev) => ({ ...prev, programId: undefined }));
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {programsForEdit.map((row) => (
                    <SelectItem key={row.programId} value={row.programId}>
                      {capitalizeWords(row.programName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editErrors.programId ? <FieldError>{editErrors.programId}</FieldError> : null}
            </Field>
            <Field data-invalid={editErrors.studentCount ? true : undefined}>
              <FieldLabel>Seats *</FieldLabel>
              <Input
                value={editSeats}
                className="h-9"
                inputMode="numeric"
                onChange={(e) => {
                  setEditSeats(e.currentTarget.value.replace(/\D/g, "").slice(0, 4));
                  setEditErrors((prev) => ({ ...prev, studentCount: undefined }));
                }}
              />
              {editErrors.studentCount ? <FieldError>{editErrors.studentCount}</FieldError> : null}
            </Field>
            <Field data-invalid={editErrors.subjects ? true : undefined}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>Subject access</FieldLabel>
                {editAvailableSubjects.length > 0 ? (
                  <div className="flex gap-2 text-xs font-medium">
                    <button
                      type="button"
                      className="text-brand-800 hover:underline"
                      onClick={selectAllEditSubjects}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-neutral-500 hover:underline"
                      onClick={clearEditSubjects}
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>
              {editAvailableSubjects.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  This program has no subjects configured.
                </p>
              ) : (
                <ul className="grid gap-2 rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 sm:grid-cols-2">
                  {editAvailableSubjects.map((subject) => {
                    const id = `edit-class-subject-${subject}`;
                    return (
                      <li key={subject}>
                        <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5">
                          <input
                            id={id}
                            type="checkbox"
                            className="size-3.5 rounded border-neutral-300 accent-brand-800"
                            checked={editSubjects.includes(subject)}
                            onChange={(event) =>
                              toggleEditSubject(subject, event.target.checked)
                            }
                          />
                          <span className="text-sm font-medium text-neutral-800">
                            {subjectLabel(subject)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {editErrors.subjects ? <FieldError>{editErrors.subjects}</FieldError> : null}
            </Field>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={pending} onClick={saveEdit}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={creating}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setCreating(false);
            resetCreate();
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Add class</AlertDialogTitle>
            <AlertDialogDescription>
              {classOptions.length === 0
                ? "Select programs and classes first. Options follow those checks."
                : "Pick class, program, and seats. After choosing a program, select subjects to grant access. Section defaults to A if left blank."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-3 py-1">
            <Field data-invalid={errors.classLevel ? true : undefined}>
              <FieldLabel>Class</FieldLabel>
              <Select
                value={classLevel || null}
                items={classSelectItems}
                onValueChange={(value) => {
                  if (value == null) return;
                  setClassLevel(value);
                  setProgramId((prev) => {
                    if (!prev) return "";
                    const level = Number(value);
                    return schoolPrograms.some(
                      (row) =>
                        row.programId === prev &&
                        row.classes.some((cls) => cls.classLevel === level),
                    )
                      ? prev
                      : "";
                  });
                  setErrors((prev) => ({ ...prev, classLevel: undefined }));
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {classOptions.map((level) => (
                    <SelectItem key={level} value={String(level)}>
                      Class {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.classLevel ? <FieldError>{errors.classLevel}</FieldError> : null}
            </Field>

            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel>Section</FieldLabel>
              <Input
                value={name}
                className="h-9 uppercase"
                placeholder="A (default)"
                maxLength={32}
                onChange={(e) => setName(e.currentTarget.value.toUpperCase())}
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </Field>

            <Field data-invalid={errors.programId ? true : undefined}>
              <FieldLabel>Program</FieldLabel>
              <Select
                value={programId || null}
                items={programSelectItems}
                onValueChange={(value) => {
                  if (value == null) return;
                  setProgramId(value);
                  setErrors((prev) => ({ ...prev, programId: undefined }));
                }}
              >
                <SelectTrigger className="h-9 w-full" disabled={!classLevel}>
                  <SelectValue
                    placeholder={classLevel ? "Select program" : "Pick class first"}
                  />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {programsForClass.map((row) => (
                    <SelectItem key={row.programId} value={row.programId}>
                      {capitalizeWords(row.programName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.programId ? <FieldError>{errors.programId}</FieldError> : null}
            </Field>

            {programId ? (
              <Field data-invalid={errors.subjects ? true : undefined}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel>Subject access</FieldLabel>
                  {availableSubjects.length > 0 ? (
                    <div className="flex gap-2 text-xs font-medium">
                      <button
                        type="button"
                        className="text-brand-800 hover:underline"
                        onClick={() => {
                          setSelectedSubjects([...availableSubjects]);
                          setErrors((prev) => ({ ...prev, subjects: undefined }));
                        }}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="text-neutral-500 hover:underline"
                        onClick={() => setSelectedSubjects([])}
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>
                {availableSubjects.length === 0 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    This program has no subjects configured.
                  </p>
                ) : (
                  <ul className="grid gap-2 rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 sm:grid-cols-2">
                    {availableSubjects.map((subject) => {
                      const id = `add-class-subject-${subject}`;
                      return (
                        <li key={subject}>
                          <label
                            htmlFor={id}
                            className="flex cursor-pointer items-center gap-2.5"
                          >
                            <input
                              id={id}
                              type="checkbox"
                              className="size-3.5 rounded border-neutral-300 accent-brand-800"
                              checked={selectedSubjects.includes(subject)}
                              onChange={(event) =>
                                toggleSubject(subject, event.target.checked)
                              }
                            />
                            <span className="text-sm font-medium text-neutral-800">
                              {subjectLabel(subject)}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {errors.subjects ? <FieldError>{errors.subjects}</FieldError> : null}
              </Field>
            ) : null}

            <Field data-invalid={errors.studentCount ? true : undefined}>
              <FieldLabel>Seats</FieldLabel>
              <Input
                value={studentCount}
                className="h-9"
                inputMode="numeric"
                onChange={(e) => {
                  setStudentCount(e.currentTarget.value.replace(/\D/g, "").slice(0, 4));
                  setErrors((prev) => ({ ...prev, studentCount: undefined }));
                }}
              />
              {errors.studentCount ? <FieldError>{errors.studentCount}</FieldError> : null}
            </Field>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={pending || classOptions.length === 0} onClick={create}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {deferred ? "Add" : "Create"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {classRows.length === 0 ? (
        <p
          className={cn(
            "px-4 py-8 text-center text-sm text-neutral-500",
            embedded && "rounded-xl border border-dashed border-neutral-200",
          )}
        >
          No classes set up yet. Use Add class to create one.
        </p>
      ) : (
        <div
          className={cn(
            "overflow-x-auto",
            embedded && "rounded-xl border border-brand-200 bg-white",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 px-3 py-2.5 sm:px-4">
            <p className="text-xs font-medium text-neutral-500 tabular-nums">
              {filteredRows.length === classRows.length
                ? `${classRows.length} class${classRows.length === 1 ? "" : "es"}`
                : `${filteredRows.length} of ${classRows.length} classes`}
            </p>
            <TableSearch value={query} onChange={setQuery} placeholder="Search classes" />
          </div>
          {filteredRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">No matching classes.</p>
          ) : (
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-brand-100 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-2.5">Class</th>
                <th className="px-4 py-2.5">Section</th>
                <th className="px-4 py-2.5">Program</th>
                <th className="px-4 py-2.5">Subjects</th>
                <th className="px-4 py-2.5 text-right">Seats</th>
                <th className="px-4 py-2.5">Students</th>
                <th className="px-4 py-2.5">Class teacher</th>
                <th className="px-4 py-2.5">Teachers</th>
                <th className="px-4 py-2.5 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const studentsLink = schoolId
                  ? classStudentsHref(row.classLevel, row.section)
                  : null;
                return (
                  <tr
                    key={row.key}
                    className="border-b border-neutral-100 last:border-0 hover:bg-brand-50/40"
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-neutral-950">
                      Class {row.classLevel}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{row.section}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {capitalizeWords(row.programName)}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {row.subjects.length > 0 ? (
                        <span className="break-words">
                          {row.subjects.map((subject) => subjectLabel(subject)).join(", ")}
                        </span>
                      ) : (
                        <span className="text-neutral-400">{EMPTY}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-neutral-900 tabular-nums">
                      <button
                        type="button"
                        title="Edit class"
                        className="rounded-md px-1.5 py-0.5 hover:bg-brand-50 hover:text-brand-900"
                        onClick={() => openEdit(row)}
                      >
                        {formatNumber(row.seats)}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {studentsLink ? (
                        <Link href={studentsLink} className={linkBtn}>
                          <GraduationCap className="size-3.5 shrink-0" strokeWidth={2} />
                          Students
                        </Link>
                      ) : (
                        <span className="text-neutral-400">{EMPTY}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.teacherId ? (
                        <Link href={`/admin/teachers/${row.teacherId}`} className={linkBtn}>
                          <UserRound className="size-3.5 shrink-0" strokeWidth={2} />
                          {capitalizeWords(row.teacherName ?? "Class teacher")}
                        </Link>
                      ) : (
                        <span className="text-neutral-400">{EMPTY}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={teachersHref} className={linkBtn}>
                        <UserRound className="size-3.5 shrink-0" strokeWidth={2} />
                        Teachers
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          title="Edit class"
                          disabled={pending}
                          className="inline-flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-brand-50 hover:text-brand-800 disabled:opacity-40"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        {row.kind === "section" ? (
                          <button
                            type="button"
                            title="Delete section"
                            disabled={pending}
                            className="inline-flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            onClick={() => removeSection(row)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
          <div className="flex justify-end border-t border-brand-100 px-3 py-2.5 sm:px-4">
            {addClassButton}
          </div>
        </div>
      )}
    </section>
  );
});
