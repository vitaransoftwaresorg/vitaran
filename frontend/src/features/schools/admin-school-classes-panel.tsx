"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
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
import { createAdminSectionAction, deleteAdminSectionAction } from "@/features/schools/section-actions";
import { capitalizeWords } from "@/features/schools/schema";
import { STUDENTS_PATH } from "@/features/students/school-roster";
import { formatNumber } from "@/utils/format";
import type { SchoolProgramOffering } from "@/types/program";
import type { ClassOrganization } from "@/types/section";
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
  programName: string;
  seats: number;
  teacherId: string | null;
  teacherName: string | null;
};

type AdminSchoolClassesPanelProps = {
  schoolId: string;
  schoolPrograms: SchoolProgramOffering[];
  organization: ClassOrganization;
  classTeacherSlots: ClassTeacherSlot[];
  seatsUsedLabel: string;
  teachersHref: string;
};

export function AdminSchoolClassesPanel({
  schoolId,
  schoolPrograms,
  organization,
  classTeacherSlots,
  seatsUsedLabel,
  teachersHref,
}: AdminSchoolClassesPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [classLevel, setClassLevel] = useState("");
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [studentCount, setStudentCount] = useState("30");
  const [errors, setErrors] = useState<
    Partial<Record<"classLevel" | "programId" | "studentCount" | "name", string>>
  >({});

  const classCtByKey = useMemo(() => {
    const map = new Map<string, ClassTeacherSlot>();
    for (const slot of classTeacherSlots) {
      if (slot.kind === "class") {
        map.set(`${slot.programId}:${slot.classLevel}`, slot);
      }
    }
    return map;
  }, [classTeacherSlots]);

  const classRows: ClassRow[] = useMemo(
    () =>
      [
        ...organization.wholeClasses.map((row) => {
          const ct = classCtByKey.get(`${row.programId}:${row.classLevel}`);
          return {
            key: `w-${row.id}`,
            kind: "whole" as const,
            id: row.id,
            classLevel: row.classLevel,
            section: "A",
            programName: row.programName,
            seats: row.studentCount,
            teacherId: ct?.teacherId ?? null,
            teacherName: ct?.teacherName ?? null,
          };
        }),
        ...organization.sections.map((section) => ({
          key: `s-${section.id}`,
          kind: "section" as const,
          id: section.id,
          classLevel: section.classLevel,
          section: section.name,
          programName: section.programName,
          seats: section.studentCount,
          teacherId: section.classTeacher?.teacherId ?? null,
          teacherName: section.classTeacher?.name ?? null,
        })),
      ].sort(
        (a, b) =>
          a.classLevel - b.classLevel ||
          a.section.localeCompare(b.section) ||
          a.programName.localeCompare(b.programName),
      ),
    [organization, classCtByKey],
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

  function classStudentsHref(level: number, section: string) {
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
    setErrors({});
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
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await createAdminSectionAction(schoolId, {
        classLevel: level,
        name: name.trim() || "A",
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

  function removeSection(row: ClassRow) {
    if (row.kind !== "section") return;
    if (!window.confirm(`Delete section ${row.classLevel}-${row.section}?`)) return;
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

  return (
    <section className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/60 px-4 py-2.5">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-950">
          Classes & sections
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-medium text-neutral-600 tabular-nums">{seatsUsedLabel}</span>
          <Link
            href={`${STUDENTS_PATH}?${new URLSearchParams({ school: schoolId })}`}
            className="font-semibold text-brand-900 transition-colors hover:text-brand-700"
          >
            View students
          </Link>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            disabled={pending || creating}
            onClick={() => {
              resetCreate();
              setCreating(true);
            }}
          >
            <Plus className="size-3.5" />
            Add class
          </Button>
        </div>
      </div>

      {creating ? (
        <div className="space-y-3 border-b border-brand-100 bg-neutral-50/70 px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field data-invalid={errors.classLevel ? true : undefined}>
              <FieldLabel>Class</FieldLabel>
              <Select
                value={classLevel || undefined}
                onValueChange={(value) => {
                  setClassLevel(value ?? "");
                  setProgramId("");
                  setErrors((prev) => ({ ...prev, classLevel: undefined }));
                }}
              >
                <SelectTrigger className="h-9">
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
              {errors.classLevel ? <FieldError>{errors.classLevel}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel>Section</FieldLabel>
              <Input
                value={name}
                className="h-9 uppercase"
                placeholder="A (default)"
                maxLength={32}
                onChange={(e) => setName(e.currentTarget.value.toUpperCase())}
              />
            </Field>

            <Field data-invalid={errors.programId ? true : undefined}>
              <FieldLabel>Program</FieldLabel>
              <Select
                value={programId || undefined}
                onValueChange={(value) => {
                  setProgramId(value ?? "");
                  setErrors((prev) => ({ ...prev, programId: undefined }));
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programsForClass.map((row) => (
                    <SelectItem key={row.programId} value={row.programId}>
                      {capitalizeWords(row.programName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.programId ? <FieldError>{errors.programId}</FieldError> : null}
            </Field>

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
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-8" disabled={pending} onClick={create}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Create
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={pending}
              onClick={() => {
                setCreating(false);
                resetCreate();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {classRows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-neutral-500">
          No classes set up yet. Use Add class to create one.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-brand-100 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-2.5">Class</th>
                <th className="px-4 py-2.5">Section</th>
                <th className="px-4 py-2.5">Program</th>
                <th className="px-4 py-2.5 text-right">Seats</th>
                <th className="px-4 py-2.5">Students</th>
                <th className="px-4 py-2.5">Class teacher</th>
                <th className="px-4 py-2.5">Teachers</th>
                <th className="px-4 py-2.5 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {classRows.map((row) => {
                const studentsLink = classStudentsHref(row.classLevel, row.section);
                return (
                  <tr
                    key={row.key}
                    className="border-b border-neutral-100 last:border-0 hover:bg-brand-50/40"
                  >
                    <td className="px-4 py-3 font-semibold text-neutral-950">
                      Class {row.classLevel}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{row.section}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {capitalizeWords(row.programName)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-neutral-900 tabular-nums">
                      {formatNumber(row.seats)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={studentsLink} className={linkBtn}>
                        <GraduationCap className="size-3.5 shrink-0" strokeWidth={2} />
                        Students
                      </Link>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
