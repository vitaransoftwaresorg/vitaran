"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegisterInPageBack } from "@/components/layout/in-page-back";
import { PageHeader } from "@/features/admin/page-header";
import { StudentDetailView } from "@/features/students/student-detail-view";
import { StudentForm } from "@/features/students/student-form";
import { StudentsTable } from "@/features/students/students-table";
import { loadSchoolRosterAction, loadSchoolStudentAction } from "@/features/students/actions";
import { SchoolClassesBoard } from "@/features/teachers/school-classes-board";
import { capitalizeWords } from "@/features/schools/schema";
import type { SchoolProgramOffering } from "@/types/program";
import type { ClassTeacherSlot, Teacher } from "@/types/teacher";
import type { Student, StudentDetail } from "@/types/student";
import type { SchoolSection, WholeClass } from "@/types/section";

type RosterFocus =
  | { kind: "section"; row: SchoolSection }
  | { kind: "whole"; row: WholeClass };

type View =
  | { name: "board" }
  | { name: "roster"; focus: RosterFocus }
  | { name: "student"; focus: RosterFocus; student: StudentDetail }
  | { name: "form"; focus: RosterFocus; student?: StudentDetail | null };

type SchoolClassesWorkspaceProps = {
  schoolPrograms: SchoolProgramOffering[];
  teachers: Teacher[];
  classTeacherSlots: ClassTeacherSlot[];
  students: Student[];
  sections: SchoolSection[];
  enrolledBySection: Record<string, number>;
  enrolledByWhole: Record<string, number>;
};

export function SchoolClassesWorkspace({
  schoolPrograms,
  teachers,
  classTeacherSlots,
  students: initialStudents,
  sections,
  enrolledBySection,
  enrolledByWhole,
}: SchoolClassesWorkspaceProps) {
  const router = useRouter();
  const [view, setView] = useState<View>({ name: "board" });
  const [students, setStudents] = useState(initialStudents);
  const [pending, startTransition] = useTransition();

  const rosterQuery = (focus: RosterFocus) =>
    focus.kind === "section"
      ? { sectionId: focus.row.id }
      : { programId: focus.row.programId, classLevel: focus.row.classLevel, wholeClass: true };

  const loadRoster = useCallback((focus: RosterFocus) => {
    startTransition(async () => {
      const items = await loadSchoolRosterAction(rosterQuery(focus));
      setStudents(items);
    });
  }, []);

  const refreshBoard = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const goBack = useCallback(() => {
    if (view.name === "form") {
      setView(
        view.student
          ? { name: "student", focus: view.focus, student: view.student }
          : { name: "roster", focus: view.focus },
      );
      return;
    }
    if (view.name === "student") {
      const focus = view.focus;
      setView({ name: "roster", focus });
      loadRoster(focus);
      return;
    }
    if (view.name === "roster") {
      setView({ name: "board" });
    }
  }, [view, loadRoster]);

  useRegisterInPageBack(view.name === "board" ? null : goBack);

  const rosterStudents = useMemo(() => {
    if (view.name === "board") return [];
    const focus = view.focus;
    if (focus.kind === "section") {
      return students.filter((row) => row.sectionId === focus.row.id);
    }
    return students.filter(
      (row) =>
        row.sectionId == null &&
        row.classLevel === focus.row.classLevel &&
        row.programId === focus.row.programId,
    );
  }, [view, students]);

  const openRoster = (focus: RosterFocus) => {
    setView({ name: "roster", focus });
    loadRoster(focus);
  };

  const openStudent = (studentId: string, focus: RosterFocus) => {
    startTransition(async () => {
      const detail = await loadSchoolStudentAction(studentId);
      if (!detail) return;
      setView({ name: "student", focus, student: detail });
    });
  };

  if (view.name === "form") {
    const focus = view.focus;
    const title = view.student ? "Edit student" : "Add student";
    const defaults =
      focus.kind === "section"
        ? {
            programId: focus.row.programId,
            classLevel: focus.row.classLevel,
            sectionId: focus.row.id,
          }
        : {
            programId: focus.row.programId,
            classLevel: focus.row.classLevel,
            sectionId: null as string | null,
          };

    return (
      <div className="space-y-3">
        <PageHeader
          title={title}
          description={
            focus.kind === "section"
              ? `Class ${focus.row.classLevel}-${focus.row.name} · ${capitalizeWords(focus.row.programName)}`
              : `Class ${focus.row.classLevel} · ${capitalizeWords(focus.row.programName)}`
          }
        />
        <div className="w-full max-w-lg rounded-2xl border border-brand-200 bg-white p-4 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)] sm:p-5">
          <StudentForm
            schoolPrograms={schoolPrograms}
            sections={sections}
            student={view.student}
            defaults={defaults}
            lockPlacement
            returnTo="/school/classes"
            stayInPlace
            onSuccess={(studentId) => {
              refreshBoard();
              loadRoster(focus);
              openStudent(studentId, focus);
            }}
          />
        </div>
      </div>
    );
  }

  if (view.name === "student") {
    return (
      <div className="space-y-3">
        {pending ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : null}
        <StudentDetailView
          student={view.student}
          onEdit={() =>
            setView({ name: "form", focus: view.focus, student: view.student })
          }
          onDeleted={() => {
            refreshBoard();
            loadRoster(view.focus);
            setView({ name: "roster", focus: view.focus });
          }}
        />
      </div>
    );
  }

  if (view.name === "roster") {
    const focus = view.focus;
    const seats = focus.row.studentCount;
    const enrolled = rosterStudents.length;
    const full = enrolled >= seats;
    const title =
      focus.kind === "section"
        ? `Class ${focus.row.classLevel}-${focus.row.name}`
        : `Class ${focus.row.classLevel}`;
    const description = `${capitalizeWords(focus.row.programName)} · ${enrolled}/${seats} seats used`;

    return (
      <div className="space-y-3">
        <PageHeader
          title={title}
          description={description}
          count={enrolled}
          actions={
            full ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Full ({seats} seats). Edit the class to add more seats.
              </p>
            ) : (
              <Button
                type="button"
                className="gap-1.5"
                onClick={() => setView({ name: "form", focus, student: null })}
              >
                <Plus className="size-4" />
                Add student
              </Button>
            )
          }
        />
        <StudentsTable
          students={rosterStudents}
          mode="school"
          emptyMessage="No students yet. Click Add student above."
          onView={(id) => openStudent(id, focus)}
          onEdit={(id) => {
            startTransition(async () => {
              const detail = await loadSchoolStudentAction(id);
              if (!detail) return;
              setView({ name: "form", focus, student: detail });
            });
          }}
          onDeleted={() => {
            refreshBoard();
            loadRoster(focus);
          }}
        />
      </div>
    );
  }

  return (
    <SchoolClassesBoard
      schoolPrograms={schoolPrograms}
      teachers={teachers}
      classTeacherSlots={classTeacherSlots}
      enrolledBySection={enrolledBySection}
      enrolledByWhole={enrolledByWhole}
      onOpenStudents={openRoster}
    />
  );
}
