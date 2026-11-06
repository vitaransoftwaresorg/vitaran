"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Pencil, Plus, Trash2, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/features/admin/page-header";
import { useLiveContent } from "@/features/live/use-live-content";
import {
  createSectionAction,
  deleteSectionAction,
  deleteWholeClassAction,
  loadSchoolSectionsAction,
  updateSectionAction,
  updateWholeClassAction,
} from "@/features/schools/section-actions";
import { capitalizeWords } from "@/features/schools/schema";
import { setClassTeacherAction } from "@/features/teachers/actions";
import { cn } from "@/lib/utils";
import type { SchoolProgramOffering } from "@/types/program";
import type {
  ClassOrganization,
  SchoolSection,
  WholeClass,
} from "@/types/section";
import type { ClassTeacherSlot, Teacher } from "@/types/teacher";

type RosterTarget =
  | { kind: "section"; row: SchoolSection }
  | { kind: "whole"; row: WholeClass };

type SchoolClassesBoardProps = {
  schoolPrograms: SchoolProgramOffering[];
  teachers: Teacher[];
  classTeacherSlots: ClassTeacherSlot[];
  /** sectionId → enrolled student count */
  enrolledBySection?: Record<string, number>;
  /** whole-class id → enrolled student count */
  enrolledByWhole?: Record<string, number>;
  onOpenStudents?: (target: RosterTarget) => void;
};

const NONE = "__none__";

const iconBtn =
  "flex size-8 cursor-pointer items-center justify-center rounded-md text-neutral-500 disabled:pointer-events-none disabled:opacity-40";

const linkBtn =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50";

type EditTarget =
  | { kind: "section"; row: SchoolSection }
  | { kind: "class"; row: WholeClass };

function teachersForSlot(
  teachers: Teacher[],
  programId: string,
  classLevel: number,
) {
  return teachers
    .filter(
      (teacher) =>
        teacher.status === "ACTIVE" &&
        teacher.assignments.some(
          (row) => row.programId === programId && row.classLevel === classLevel,
        ),
    )
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function SchoolClassesBoard({
  schoolPrograms,
  teachers,
  classTeacherSlots: initialSlots,
  enrolledBySection = {},
  enrolledByWhole = {},
  onOpenStudents,
}: SchoolClassesBoardProps) {
  const [organization, setOrganization] = useState<ClassOrganization | null>(null);
  const [slots, setSlots] = useState(initialSlots);
  const [pending, startTransition] = useTransition();

  const [classLevel, setClassLevel] = useState("");
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [studentCount, setStudentCount] = useState("30");
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<
    Partial<Record<"classLevel" | "programId" | "studentCount" | "name", string>>
  >({});

  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editName, setEditName] = useState("");
  const [editProgramId, setEditProgramId] = useState("");
  const [editSeats, setEditSeats] = useState("");
  const [editTeacherId, setEditTeacherId] = useState(NONE);
  const [editBaseline, setEditBaseline] = useState<{
    name: string;
    programId: string;
    seats: string;
    teacherId: string;
  } | null>(null);
  const [editErrors, setEditErrors] = useState<
    Partial<Record<"name" | "programId" | "studentCount", string>>
  >({});

  const reload = useCallback(() => {
    startTransition(async () => {
      const data = await loadSchoolSectionsAction();
      setOrganization(data.organization);
      setSlots(data.classTeacherSlots);
    });
  }, []);

  useLiveContent("sections", reload);
  useLiveContent("teachers", reload);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  const classCtByKey = useMemo(() => {
    const map = new Map<string, ClassTeacherSlot>();
    for (const slot of slots) {
      if (slot.kind === "class") {
        map.set(`${slot.programId}:${slot.classLevel}`, slot);
      }
    }
    return map;
  }, [slots]);

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

  const programsForEdit = useMemo(() => {
    if (!editing) return [];
    const level = editing.row.classLevel;
    return schoolPrograms.filter((row) =>
      row.classes.some((cls) => cls.classLevel === level),
    );
  }, [schoolPrograms, editing]);

  const eligibleTeachers = useMemo(() => {
    if (!editing || !editProgramId) return [];
    const list = teachersForSlot(teachers, editProgramId, editing.row.classLevel);
    if (editTeacherId !== NONE && !list.some((row) => row.id === editTeacherId)) {
      const current = teachers.find((row) => row.id === editTeacherId);
      if (current) return [current, ...list];
    }
    return list;
  }, [editing, editProgramId, teachers, editTeacherId]);

  useEffect(() => {
    if (!programId) return;
    if (!programsForClass.some((row) => row.programId === programId)) {
      setProgramId("");
    }
  }, [programsForClass, programId]);

  const openEdit = (target: EditTarget) => {
    const nextName = target.kind === "section" ? target.row.name : "";
    const nextProgramId = target.row.programId;
    const nextSeats = String(target.row.studentCount);
    let nextTeacher = NONE;
    if (target.kind === "section") {
      nextTeacher = target.row.classTeacher?.teacherId ?? NONE;
    } else {
      const slot = classCtByKey.get(`${target.row.programId}:${target.row.classLevel}`);
      nextTeacher = slot?.teacherId ?? NONE;
    }
    setEditing(target);
    setEditName(nextName);
    setEditProgramId(nextProgramId);
    setEditSeats(nextSeats);
    setEditTeacherId(nextTeacher);
    setEditBaseline({
      name: nextName,
      programId: nextProgramId,
      seats: nextSeats,
      teacherId: nextTeacher,
    });
    setEditErrors({});
  };

  const editDirty =
    !!editing &&
    !!editBaseline &&
    (editName !== editBaseline.name ||
      editProgramId !== editBaseline.programId ||
      editSeats !== editBaseline.seats ||
      editTeacherId !== editBaseline.teacherId);

  const resetCreateForm = () => {
    setClassLevel("");
    setName("");
    setProgramId("");
    setStudentCount("30");
    setCreateErrors({});
  };

  const openCreate = () => {
    resetCreateForm();
    setCreating(true);
  };

  const create = () => {
    const level = Number(classLevel);
    const count = Number(studentCount);
    const sectionName = name.trim();
    const nextErrors: typeof createErrors = {};

    if (!classLevel || !level) {
      nextErrors.classLevel = "Select a class";
    } else if (!classOptions.includes(level)) {
      nextErrors.classLevel = "That class is not enabled for this school";
    }

    if (!programId) {
      nextErrors.programId = "Select a program";
    } else if (
      level &&
      !programsForClass.some((row) => row.programId === programId)
    ) {
      nextErrors.programId = "That program is not enabled for the selected class";
    }

    if (!studentCount.trim()) {
      nextErrors.studentCount = "Enter seats";
    } else if (!Number.isInteger(count) || count < 1) {
      nextErrors.studentCount = "Enter a valid seat count (1 or more)";
    }

    if (Object.keys(nextErrors).length > 0) {
      setCreateErrors(nextErrors);
      return;
    }
    setCreateErrors({});

    startTransition(async () => {
      const result = await createSectionAction({
        classLevel: level,
        name: sectionName.trim() || "A",
        programId,
        studentCount: count,
      });
      if (!result.ok) {
        setCreateErrors({ studentCount: result.message });
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
      resetCreateForm();
      reload();
    });
  };

  const saveEdit = () => {
    if (!editing || !editDirty) return;
    const count = Number(editSeats);
    const nextErrors: typeof editErrors = {};

    if (!editProgramId) nextErrors.programId = "Select a program";
    if (!editSeats.trim()) {
      nextErrors.studentCount = "Enter seats";
    } else if (!Number.isInteger(count) || count < 1) {
      nextErrors.studentCount = "Enter a valid seat count (1 or more)";
    }
    if (editing.kind === "section" && !editName.trim()) {
      nextErrors.name = "Section name is required";
    }

    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors);
      return;
    }
    setEditErrors({});

    const teacherId = editTeacherId === NONE ? null : editTeacherId;

    startTransition(async () => {
      if (editing.kind === "section") {
        const result = await updateSectionAction(editing.row.id, {
          name: editName.trim(),
          programId: editProgramId,
          studentCount: count,
        });
        if (!result.ok) {
          setEditErrors({ studentCount: result.message });
          return;
        }
        const ct = await setClassTeacherAction({
          kind: "section",
          sectionId: editing.row.id,
          teacherId,
        });
        if (!ct.ok) {
          setEditErrors({ name: ct.message });
          return;
        }
        toast.success("Section updated");
      } else {
        const result = await updateWholeClassAction(editing.row.id, {
          programId: editProgramId,
          studentCount: count,
        });
        if (!result.ok) {
          setEditErrors({ studentCount: result.message });
          return;
        }
        if (editProgramId !== editing.row.programId) {
          await setClassTeacherAction({
            kind: "class",
            programId: editing.row.programId,
            classLevel: editing.row.classLevel,
            teacherId: null,
          });
        }
        const ct = await setClassTeacherAction({
          kind: "class",
          programId: editProgramId,
          classLevel: editing.row.classLevel,
          teacherId,
        });
        if (!ct.ok) {
          setEditErrors({ programId: ct.message });
          return;
        }
        toast.success("Class updated");
      }
      setEditing(null);
      setEditBaseline(null);
      reload();
    });
  };

  const removeSection = (section: SchoolSection) => {
    if (!window.confirm(`Delete section ${section.classLevel}-${section.name}?`)) return;
    startTransition(async () => {
      const result = await deleteSectionAction(section.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Section deleted");
      reload();
    });
  };

  const removeWholeClass = (row: WholeClass) => {
    if (!window.confirm(`Delete class ${row.classLevel}-A?`)) return;
    startTransition(async () => {
      const result = await deleteWholeClassAction(row.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Class deleted");
      reload();
    });
  };

  if (organization === null) {
    return (
      <>
        <PageHeader title="Classes" />
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white p-10 text-center text-sm text-neutral-500 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]">
          Loading classes…
        </div>
      </>
    );
  }

  const totalCount = organization.wholeClasses.length + organization.sections.length;

  const teacherItems = [
    { value: NONE, label: "No class teacher" },
    ...eligibleTeachers.map((teacher) => ({
      value: teacher.id,
      label: capitalizeWords(teacher.name),
    })),
  ];

  return (
    <>
      <PageHeader
        title="Classes"
        count={totalCount}
        actions={
          classOptions.length > 0 ? (
            <Button type="button" disabled={pending} onClick={openCreate} className="gap-1.5">
              <Plus className="size-4" />
              Create class
            </Button>
          ) : null
        }
      />

      {classOptions.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ask admin to enrol programs and classes for this school first.
        </p>
      ) : totalCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          No classes yet. Click <strong>Create class</strong> to add one.
        </div>
      ) : (
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]",
              pending && "opacity-70 transition-opacity",
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-brand-100 bg-brand-50/70 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Program</th>
                    <th className="px-4 py-2.5">Class</th>
                    <th className="px-4 py-2.5">Section</th>
                    <th className="px-4 py-2.5">Seats</th>
                    <th className="px-4 py-2.5">Students</th>
                    <th className="px-4 py-2.5">Class teacher</th>
                    <th className="px-4 py-2.5">Teachers</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...organization.wholeClasses.map((row) => {
                      const slot = classCtByKey.get(`${row.programId}:${row.classLevel}`);
                      return {
                        key: `w-${row.id}`,
                        kind: "class" as const,
                        row,
                        programName: row.programName,
                        classLevel: row.classLevel,
                        sectionLabel: "A",
                        enrolled: enrolledByWhole[row.id] ?? 0,
                        seats: row.studentCount,
                        teacherId: slot?.teacherId ?? null,
                        teacherName: slot?.teacherName ?? null,
                        open: () => onOpenStudents?.({ kind: "whole", row }),
                      };
                    }),
                    ...organization.sections.map((section) => ({
                      key: `s-${section.id}`,
                      kind: "section" as const,
                      row: section,
                      programName: section.programName,
                      classLevel: section.classLevel,
                      sectionLabel: section.name,
                      enrolled: enrolledBySection[section.id] ?? 0,
                      seats: section.studentCount,
                      teacherId: section.classTeacher?.teacherId ?? null,
                      teacherName: section.classTeacher?.name ?? null,
                      open: () => onOpenStudents?.({ kind: "section", row: section }),
                    })),
                  ]
                    .sort(
                      (a, b) =>
                        a.classLevel - b.classLevel ||
                        a.programName.localeCompare(b.programName) ||
                        a.sectionLabel.localeCompare(b.sectionLabel),
                    )
                    .map((item) => (
                      <tr
                        key={item.key}
                        className="border-b border-neutral-100 last:border-0 hover:bg-brand-50/40"
                      >
                        <td className="px-4 py-3 font-medium text-neutral-950">
                          {capitalizeWords(item.programName)}
                        </td>
                        <td className="px-4 py-3 text-neutral-900">Class {item.classLevel}</td>
                        <td className="px-4 py-3 text-neutral-700">{item.sectionLabel}</td>
                        <td className="px-4 py-3 tabular-nums">
                          <span
                            className={cn(
                              "font-medium",
                              item.enrolled >= item.seats
                                ? "text-amber-700"
                                : "text-neutral-900",
                            )}
                          >
                            {item.enrolled}/{item.seats}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button type="button" onClick={item.open} className={linkBtn}>
                            <GraduationCap className="size-3.5 shrink-0" strokeWidth={2} />
                            Students
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {item.teacherId ? (
                            <Link
                              href={`/school/teachers/${item.teacherId}`}
                              className={linkBtn}
                            >
                              <UserRound className="size-3.5 shrink-0" strokeWidth={2} />
                              {capitalizeWords(item.teacherName ?? "Class teacher")}
                            </Link>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link href="/school/teachers" className={linkBtn}>
                            <Users className="size-3.5 shrink-0" strokeWidth={2} />
                            Teachers
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    disabled={pending}
                                    aria-label="Edit"
                                    onClick={() => {
                                      if (item.kind === "class") {
                                        openEdit({ kind: "class", row: item.row });
                                      } else {
                                        openEdit({ kind: "section", row: item.row });
                                      }
                                    }}
                                    className={iconBtn}
                                  />
                                }
                              >
                                <Pencil className="size-3.5" strokeWidth={2} />
                              </TooltipTrigger>
                              <TooltipContent side="top">Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    disabled={pending}
                                    aria-label="Delete"
                                    onClick={() => {
                                      if (item.kind === "class") removeWholeClass(item.row);
                                      else removeSection(item.row);
                                    }}
                                    className={cn(iconBtn, "text-red-600")}
                                  />
                                }
                              >
                                <Trash2 className="size-3.5" strokeWidth={2} />
                              </TooltipTrigger>
                              <TooltipContent side="top">Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
      )}

      <AlertDialog
        open={creating}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setCreating(false);
            resetCreateForm();
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Create class</AlertDialogTitle>
            <AlertDialogDescription>
              Pick class, program, and seats. Section is optional (defaults to A).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-3 py-1">
            <Field data-invalid={createErrors.classLevel ? true : undefined}>
              <FieldLabel>Class *</FieldLabel>
              <Select
                value={classLevel || null}
                onValueChange={(value) => {
                  setClassLevel(value ?? "");
                  setProgramId("");
                  setCreateErrors((prev) => ({
                    ...prev,
                    classLevel: undefined,
                    programId: undefined,
                  }));
                }}
                items={classOptions.map((level) => ({
                  value: String(level),
                  label: `Class ${level}`,
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((level) => (
                    <SelectItem key={level} value={String(level)}>
                      Class {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createErrors.classLevel ? <FieldError>{createErrors.classLevel}</FieldError> : null}
            </Field>

            <Field data-invalid={createErrors.name ? true : undefined}>
              <FieldLabel>Section (optional)</FieldLabel>
              <Input
                value={name}
                onChange={(event) => setName(event.currentTarget.value.toUpperCase())}
                placeholder="A (default if blank)"
                maxLength={32}
              />
              {createErrors.name ? <FieldError>{createErrors.name}</FieldError> : null}
            </Field>

            <Field data-invalid={createErrors.programId ? true : undefined}>
              <FieldLabel>Program *</FieldLabel>
              <Select
                value={programId || null}
                onValueChange={(value) => {
                  setProgramId(value ?? "");
                  setCreateErrors((prev) => ({ ...prev, programId: undefined }));
                }}
                disabled={!classLevel}
                items={programsForClass.map((row) => ({
                  value: row.programId,
                  label: row.programName,
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={classLevel ? "Select program" : "Pick class first"} />
                </SelectTrigger>
                <SelectContent>
                  {programsForClass.map((row) => (
                    <SelectItem key={row.programId} value={row.programId}>
                      {row.programName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createErrors.programId ? <FieldError>{createErrors.programId}</FieldError> : null}
            </Field>

            <Field data-invalid={createErrors.studentCount ? true : undefined}>
              <FieldLabel>Seats *</FieldLabel>
              <Input
                type="number"
                min={1}
                max={5000}
                value={studentCount}
                onChange={(event) => {
                  setStudentCount(event.currentTarget.value);
                  setCreateErrors((prev) => ({ ...prev, studentCount: undefined }));
                }}
              />
              {createErrors.studentCount ? (
                <FieldError>{createErrors.studentCount}</FieldError>
              ) : null}
            </Field>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={pending} onClick={create} className="gap-1.5">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create class
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setEditing(null);
            setEditBaseline(null);
            setEditErrors({});
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editing?.kind === "class" ? "Edit class" : "Edit section"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editing ? `Class ${editing.row.classLevel}` : null}
              {editing?.kind === "section" ? ` · Section ${editing.row.name}` : " · Section A"}
              . Only teachers assigned to this program and class appear below.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-3 py-1">
            {editing?.kind === "section" ? (
              <Field data-invalid={editErrors.name ? true : undefined}>
                <FieldLabel>Section *</FieldLabel>
                <Input
                  value={editName}
                  onChange={(event) => {
                    setEditName(event.currentTarget.value.toUpperCase());
                    setEditErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  maxLength={32}
                />
                {editErrors.name ? <FieldError>{editErrors.name}</FieldError> : null}
              </Field>
            ) : null}
            <Field data-invalid={editErrors.programId ? true : undefined}>
              <FieldLabel>Program *</FieldLabel>
              <Select
                value={editProgramId || null}
                onValueChange={(value) => {
                  setEditProgramId(value ?? "");
                  setEditTeacherId(NONE);
                  setEditErrors((prev) => ({ ...prev, programId: undefined }));
                }}
                items={programsForEdit.map((row) => ({
                  value: row.programId,
                  label: row.programName,
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programsForEdit.map((row) => (
                    <SelectItem key={row.programId} value={row.programId}>
                      {row.programName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editErrors.programId ? <FieldError>{editErrors.programId}</FieldError> : null}
            </Field>
            <Field data-invalid={editErrors.studentCount ? true : undefined}>
              <FieldLabel>Seats *</FieldLabel>
              <Input
                type="number"
                min={1}
                max={5000}
                value={editSeats}
                onChange={(event) => {
                  setEditSeats(event.currentTarget.value);
                  setEditErrors((prev) => ({ ...prev, studentCount: undefined }));
                }}
              />
              {editErrors.studentCount ? <FieldError>{editErrors.studentCount}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel>Class teacher</FieldLabel>
              {eligibleTeachers.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No teachers assigned to this program and class yet. Add subject assignments on a
                  teacher first.
                </p>
              ) : (
                <Select
                  value={editTeacherId}
                  onValueChange={(value) => setEditTeacherId(value ?? NONE)}
                  items={teacherItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {editDirty ? (
              <Button type="button" disabled={pending} onClick={saveEdit}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                Save
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
