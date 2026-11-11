"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegisterInPageBack } from "@/components/layout/in-page-back";
import { PageHeader } from "@/features/admin/page-header";
import { BulkStudentForm } from "@/features/students/bulk-student-form";
import { StudentDetailView } from "@/features/students/student-detail-view";
import { StudentForm } from "@/features/students/student-form";
import { ClassProfilesPdfActions } from "@/features/students/student-pdf-actions";
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

  const refreshList = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  const goBack = useCallback(() => {
    setView((current) => {
      if (current.name === "form") {
        return current.student
          ? { name: "student", focus: current.focus, student: current.student }
          : { name: "roster", focus: current.focus };
      }
      if (current.name === "student") {
        return { name: "roster", focus: current.focus };
      }
      if (current.name === "roster") {
        return { name: "board" };
      }
      return current;
    });
  }, []);

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
    startTransition(async () => {
      const items = await loadSchoolRosterAction(
        focus.kind === "section"
          ? { sectionId: focus.row.id }
          : { programId: focus.row.programId, classLevel: focus.row.classLevel, wholeClass: true },
      );
      setStudents(items);
    });
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
    const title = view.student ? "Edit student" : "Add students";
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
        {view.student ? (
          <div className="w-full max-w-lg rounded-2xl border border-brand-200 bg-white p-4 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)] sm:p-5">
            <StudentForm
              schoolPrograms={schoolPrograms}
              sections={sections}
              student={view.student}
              defaults={defaults}
              lockPlacement
              returnTo="/school/classes"
              stayInPlace
              onSuccess={() => {
                openRoster(focus);
                refreshList();
              }}
            />
          </div>
        ) : (
          <BulkStudentForm
            schoolPrograms={schoolPrograms}
            sections={sections}
            defaults={defaults}
            lockPlacement
            returnTo="/school/classes"
            stayInPlace
            onSuccess={() => {
              openRoster(focus);
              refreshList();
            }}
          />
        )}
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
          performancePortal="school"
          onEdit={() =>
            setView({ name: "form", focus: view.focus, student: view.student })
          }
          onDeleted={() => {
            refreshList();
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
            <div className="flex flex-wrap items-center gap-2">
              <ClassProfilesPdfActions
                portal="school"
                studentIds={rosterStudents.map((student) => student.id)}
              />
              {full ? (
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
              )}
            </div>
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
          onDeleted={() => refreshList()}
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
