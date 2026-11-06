"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BookOpen, Contact, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { classWithSectionLabel, displaySectionName } from "@/features/schools/section-label";
import { capitalizeWords } from "@/features/schools/schema";
import { deleteStudentInPlaceAction } from "@/features/students/actions";
import { deleteAdminStudentInPlaceAction } from "@/features/students/admin-student-actions";
import type { StudentDetail, StudentTestResult } from "@/types/student";
import type { PerformancePortal } from "./performance-actions";
import { StudentPerformance } from "./student-performance";
import { StudentPerformanceLoader } from "./student-performance-loader";

const EMPTY = "—";

/** Standalone classes — buttonVariants hover colors fight white-on-dark. */
const INVERTED_BASE =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0";
const INVERTED_OUTLINE = `${INVERTED_BASE} border border-white/25 bg-transparent text-white hover:bg-white/15 hover:text-white`;
const INVERTED_SOLID = `${INVERTED_BASE} border border-white bg-white text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950`;

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
      <h2 className="flex items-center gap-2.5 border-b border-brand-100 bg-brand-50/60 px-4 py-2 text-sm font-semibold text-brand-950">
        <span className="flex size-6 items-center justify-center rounded-md border border-brand-200 bg-white text-brand-700 [&_svg]:size-3.5">
          {icon}
        </span>
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

function Field({ label, span, children }: { label: string; span?: 2 | 3; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", span === 2 && "sm:col-span-2", span === 3 && "col-span-2 sm:col-span-3")}>
      <dt className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-neutral-950">{children ?? EMPTY}</dd>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-18 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-center">
      <p className="text-[9px] font-semibold tracking-wider text-white/50 uppercase">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}

type StudentDetailViewProps = {
  student: StudentDetail;
  onEdit?: () => void;
  editHref?: string;
  onDeleted?: () => void;
  /** Admin flat URLs — delete by student id only. */
  adminFlat?: boolean;
  afterDeleteHref?: string;
  showActions?: boolean;
  /** Server-loaded test results. */
  performance?: StudentTestResult[];
  /** Load results in the browser when the page has none (in-page roster views). */
  performancePortal?: PerformancePortal;
};

export function StudentDetailView({
  student,
  onEdit,
  editHref,
  onDeleted,
  adminFlat = false,
  afterDeleteHref,
  showActions,
  performance,
  performancePortal,
}: StudentDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canEdit = Boolean(onEdit || editHref);
  const canDelete = Boolean(onDeleted || adminFlat || afterDeleteHref);
  const actionsVisible = showActions ?? (canEdit || canDelete);
  const classLabel = classWithSectionLabel(student.classLevel, student.sectionName);

  return (
    <div className="space-y-3">
      <header className="rounded-xl border border-brand-700 bg-linear-to-r from-brand-800 to-brand-950 px-5 py-4 text-white shadow-[0_10px_30px_-12px_rgb(25_28_95/0.55)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
              Student profile
            </p>
            <h1 className="mt-0.5 truncate text-xl font-bold capitalize sm:text-2xl">
              {capitalizeWords(student.name)}
            </h1>
            <p className="mt-1 truncate text-sm text-white/70">
              Registration no {student.rollNo} · {classLabel} · {student.programName}
            </p>
          </div>

          {actionsVisible ? (
            <div className="flex shrink-0 gap-2">
              {canDelete ? (
                <button
                  type="button"
                  disabled={pending}
                  className={INVERTED_OUTLINE}
                  onClick={() => {
                    if (!window.confirm(`Delete ${capitalizeWords(student.name)}?`)) return;
                    startTransition(async () => {
                      try {
                        if (adminFlat) {
                          await deleteAdminStudentInPlaceAction(student.id);
                          toast.success("Student deleted");
                          if (afterDeleteHref) router.push(afterDeleteHref);
                          else onDeleted?.();
                          router.refresh();
                        } else {
                          await deleteStudentInPlaceAction(student.id);
                          toast.success("Student deleted");
                          if (afterDeleteHref) router.push(afterDeleteHref);
                          else onDeleted?.();
                          router.refresh();
                        }
                      } catch {
                        toast.error("Could not delete student");
                      }
                    });
                  }}
                >
                  <Trash2 />
                  Delete
                </button>
              ) : null}
              {editHref ? (
                <Link href={editHref} className={INVERTED_SOLID}>
                  <Pencil />
                  Edit
                </Link>
              ) : onEdit ? (
                <button type="button" className={INVERTED_SOLID} onClick={onEdit}>
                  <Pencil />
                  Edit
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="Status" value={student.status === "ACTIVE" ? "Active" : "Inactive"} />
          <Chip label="Registration no" value={student.rollNo} />
          <Chip label="Class" value={classLabel} />
        </div>
      </header>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Panel title="Student details" icon={<Contact />}>
          <Field label="Full name">{capitalizeWords(student.name)}</Field>
          <Field label="Registration number">{student.rollNo}</Field>
          <Field label="Status">{student.status === "ACTIVE" ? "Active" : "Inactive"}</Field>
          <Field label="Parent / guardian name" span={2}>
            {student.parentName ? capitalizeWords(student.parentName) : null}
          </Field>
          <Field label="Parent mobile">{student.parentPhone}</Field>
          <Field label="Parent / guardian email">{student.email}</Field>
          <Field label="School" span={2}>
            {student.school.name}
          </Field>
        </Panel>

        <Panel title="Class & program" icon={<BookOpen />}>
          <Field label="Program" span={2}>
            {student.programName}
          </Field>
          <Field label="Class">{classLabel}</Field>
          <Field label="Section">{displaySectionName(student.sectionName)}</Field>
        </Panel>
      </div>

      {performance ? (
        <StudentPerformance results={performance} />
      ) : performancePortal ? (
        <StudentPerformanceLoader portal={performancePortal} studentId={student.id} />
      ) : null}
    </div>
  );
}
