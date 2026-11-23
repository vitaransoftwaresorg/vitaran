"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, UserRound, Users } from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { matchesSearch, TableSearch } from "@/components/shared/table-search";
import { PageHeader } from "@/features/admin/page-header";
import { useLiveContent } from "@/features/live/use-live-content";
import { loadSchoolSectionsAction } from "@/features/schools/section-actions";
import { capitalizeWords } from "@/features/schools/schema";
import { setClassTeacherAction } from "@/features/teachers/actions";
import { useResetOnScopeChange } from "@/hooks/use-reset-on-scope-change";
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

const linkBtn =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50";

type AssignTarget =
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

/** School portal: view classes/sections and assign class teachers. Create/delete is admin-only. */
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
  const [query, setQuery] = useState("");
  // Soft-nav into Classes from another school page must not keep a leftover filter.
  useResetOnScopeChange(
    `school-classes:${schoolPrograms.map((row) => row.programId).join(",")}`,
    () => setQuery(""),
  );

  const [assigning, setAssigning] = useState<AssignTarget | null>(null);
  const [teacherId, setTeacherId] = useState(NONE);
  const [baselineTeacherId, setBaselineTeacherId] = useState(NONE);

  const reload = useCallback(() => {
    void (async () => {
      const data = await loadSchoolSectionsAction();
      setOrganization(data.organization);
      setSlots(data.classTeacherSlots);
    })();
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

  const eligibleTeachers = useMemo(() => {
    if (!assigning) return [];
    const programId = assigning.row.programId;
    const list = teachersForSlot(teachers, programId, assigning.row.classLevel);
    if (teacherId !== NONE && !list.some((row) => row.id === teacherId)) {
      const current = teachers.find((row) => row.id === teacherId);
      if (current) return [current, ...list];
    }
    return list;
  }, [assigning, teachers, teacherId]);

  const openAssign = (target: AssignTarget) => {
    let nextTeacher = NONE;
    if (target.kind === "section") {
      nextTeacher = target.row.classTeacher?.teacherId ?? NONE;
    } else {
      const slot = classCtByKey.get(`${target.row.programId}:${target.row.classLevel}`);
      nextTeacher = slot?.teacherId ?? NONE;
    }
    setAssigning(target);
    setTeacherId(nextTeacher);
    setBaselineTeacherId(nextTeacher);
  };

  const dirty = !!assigning && teacherId !== baselineTeacherId;

  const saveAssign = () => {
    if (!assigning || !dirty) return;
    const nextTeacherId = teacherId === NONE ? null : teacherId;

    startTransition(async () => {
      const result =
        assigning.kind === "section"
          ? await setClassTeacherAction({
              kind: "section",
              sectionId: assigning.row.id,
              teacherId: nextTeacherId,
            })
          : await setClassTeacherAction({
              kind: "class",
              programId: assigning.row.programId,
              classLevel: assigning.row.classLevel,
              teacherId: nextTeacherId,
            });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(nextTeacherId ? "Class teacher assigned" : "Class teacher cleared");
      setAssigning(null);
      reload();
    });
  };

  if (organization === null) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-200 bg-white p-10 text-center text-sm text-neutral-500 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]">
        Loading classes…
      </div>
    );
  }

  const levelsWithSections = new Set(organization.sections.map((section) => section.classLevel));
  const wholeVisible = organization.wholeClasses.filter(
    (row) => !levelsWithSections.has(row.classLevel),
  ).length;
  const totalCount = wholeVisible + organization.sections.length;

  const classRows = [
    ...organization.wholeClasses
      .filter((row) => !levelsWithSections.has(row.classLevel))
      .map((row) => {
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
  ].sort(
    (a, b) =>
      a.classLevel - b.classLevel ||
      a.programName.localeCompare(b.programName) ||
      a.sectionLabel.localeCompare(b.sectionLabel),
  );

  const filteredClassRows = classRows.filter((row) =>
    matchesSearch(
      query,
      row.programName,
      row.classLevel,
      row.sectionLabel,
      row.enrolled,
      row.teacherName,
    ),
  );

  const teacherItems = [
    { value: NONE, label: "No class teacher" },
    ...eligibleTeachers.map((teacher) => ({
      value: teacher.id,
      label: capitalizeWords(teacher.name),
    })),
  ];

  return (
    <>
      <PageHeader count={totalCount} />

      {classOptions.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ask admin to enrol programs and classes for this school first.
        </p>
      ) : totalCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          No classes yet. Ask admin to create classes and sections for this school.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/40 px-3 py-2.5 sm:px-4">
            <p className="text-xs font-medium text-neutral-500 tabular-nums">
              {filteredClassRows.length === classRows.length
                ? `${classRows.length} class${classRows.length === 1 ? "" : "es"}`
                : `${filteredClassRows.length} of ${classRows.length} classes`}
            </p>
            <TableSearch value={query} onChange={setQuery} placeholder="Search classes" />
          </div>
          <div className="overflow-x-auto">
            {filteredClassRows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">No matching classes.</p>
            ) : (
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-brand-100 bg-brand-50/70 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Program</th>
                    <th className="px-4 py-2.5">Class</th>
                    <th className="px-4 py-2.5">Section</th>
                    <th className="px-4 py-2.5">Students</th>
                    <th className="px-4 py-2.5">Class teacher</th>
                    <th className="px-4 py-2.5">Teachers</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClassRows.map((item) => (
                    <tr
                      key={item.key}
                      className="border-b border-neutral-100 last:border-0 hover:bg-brand-50/40"
                    >
                      <td className="px-4 py-3 font-medium text-neutral-950">
                        {capitalizeWords(item.programName)}
                      </td>
                      <td className="px-4 py-3 text-neutral-900">Class {item.classLevel}</td>
                      <td className="px-4 py-3 text-neutral-700">{item.sectionLabel}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={item.open}
                          className={linkBtn}
                          title="Open students — same list Results uses"
                        >
                          <GraduationCap className="size-3.5 shrink-0" strokeWidth={2} />
                          {item.enrolled > 0
                            ? `${item.enrolled} students`
                            : "No students yet"}
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
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          className="h-8"
                          onClick={() => {
                            if (item.kind === "class") {
                              openAssign({ kind: "class", row: item.row });
                            } else {
                              openAssign({ kind: "section", row: item.row });
                            }
                          }}
                        >
                          Assign teacher
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <AlertDialog
        open={!!assigning}
        onOpenChange={(open) => {
          if (!open && !pending) setAssigning(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Assign class teacher</AlertDialogTitle>
            <AlertDialogDescription>
              {assigning ? `Class ${assigning.row.classLevel}` : null}
              {assigning?.kind === "section"
                ? ` · Section ${assigning.row.name}`
                : assigning
                  ? " · Section A"
                  : null}
              . Only teachers assigned to this program and class appear below. Classes and sections
              are managed by admin.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-3 py-1">
            <Field>
              <FieldLabel>Class teacher</FieldLabel>
              {eligibleTeachers.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No teachers assigned to this program and class yet. Add subject assignments on a
                  teacher first.
                </p>
              ) : (
                <Select
                  value={teacherId}
                  onValueChange={(value) => setTeacherId(value ?? NONE)}
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
            {dirty ? (
              <Button type="button" disabled={pending} onClick={saveAssign}>
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
