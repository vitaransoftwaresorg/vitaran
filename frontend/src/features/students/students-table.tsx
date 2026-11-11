"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { displaySectionName } from "@/features/schools/section-label";
import { deleteStudentInPlaceAction } from "@/features/students/actions";
import { deleteAdminStudentInPlaceAction } from "@/features/students/admin-student-actions";
import { PROFILE_LINK_CLASS, ProfileLink, schoolProfileHref } from "@/components/shared/profile-link";
import { cn } from "@/lib/utils";
import type { Student } from "@/types/student";

const iconBtn =
  "flex size-8 cursor-pointer items-center justify-center rounded-md text-neutral-500 hover:bg-brand-50 hover:text-brand-800 disabled:pointer-events-none disabled:opacity-40";

export type StudentRow = Student & { schoolName?: string };

type StudentsTableProps = {
  students: StudentRow[];
  emptyMessage?: string;
  mode?: "school" | "admin" | "teacher";
  /** School portal in-page: detail at `${baseHref}/${id}` */
  baseHref?: string;
  showSchool?: boolean;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDeleted?: () => void;
};

export function StudentsTable({
  students,
  emptyMessage = "No students yet.",
  mode = "school",
  baseHref,
  showSchool = false,
  onView,
  onEdit,
  onDeleted,
}: StudentsTableProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (students.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        {emptyMessage}
      </p>
    );
  }

  const showActions = mode === "school" || mode === "admin";
  const canMutate = mode === "school" || mode === "admin";

  function detailHref(student: StudentRow) {
    if (mode === "admin") return `/admin/schools/students/${student.id}`;
    if (mode === "teacher") return `/teacher/students/${student.id}`;
    if (baseHref) return `${baseHref}/${student.id}`;
    return null;
  }

  function editHref(student: StudentRow) {
    const detail = detailHref(student);
    return detail ? `${detail}/edit` : null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-brand-100 bg-brand-50/60 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          <tr>
            {showSchool ? <th className="px-4 py-2.5">School</th> : null}
            <th className="px-4 py-2.5">Registration no</th>
            <th className="px-4 py-2.5">Name</th>
            <th className="hidden px-4 py-2.5 sm:table-cell">Class</th>
            <th className="hidden px-4 py-2.5 md:table-cell">Program</th>
            <th className="px-4 py-2.5">Status</th>
            {showActions ? <th className="px-4 py-2.5 text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const detail = detailHref(student);
            const edit = editHref(student);
            const classLabel = `${student.classLevel}-${displaySectionName(student.sectionName)}`;
            return (
              <tr key={student.id} className="border-b border-neutral-100 last:border-0">
                {showSchool ? (
                  <td className="px-4 py-2.5 text-neutral-700">
                    {student.schoolName ? (
                      <ProfileLink href={mode === "admin" ? schoolProfileHref(student.schoolId) : null}>
                        {student.schoolName}
                      </ProfileLink>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                <td className="px-4 py-2.5 font-medium text-neutral-950 tabular-nums">
                  {detail ? (
                    <ProfileLink href={detail}>{student.rollNo}</ProfileLink>
                  ) : onView ? (
                    <button
                      type="button"
                      className={PROFILE_LINK_CLASS}
                      onClick={() => onView(student.id)}
                    >
                      {student.rollNo}
                    </button>
                  ) : (
                    student.rollNo
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {detail ? (
                    <ProfileLink href={detail}>{student.name}</ProfileLink>
                  ) : onView ? (
                    <button
                      type="button"
                      className={PROFILE_LINK_CLASS}
                      onClick={() => onView(student.id)}
                    >
                      {student.name}
                    </button>
                  ) : (
                    <span className="font-medium text-neutral-950">{student.name}</span>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-neutral-600 sm:table-cell">
                  Class {classLabel}
                </td>
                <td className="hidden px-4 py-2.5 text-neutral-600 md:table-cell">
                  {student.programName}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                      student.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-600",
                    )}
                  >
                    {student.status === "ACTIVE" ? "Active" : "Inactive"}
                  </span>
                </td>
                {showActions ? (
                  <td className="px-4 py-2.5">
                    <div className="flex shrink-0 items-center justify-end gap-0.5">
                      {detail || onView ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              detail ? (
                                <Link href={detail} aria-label="View student" className={iconBtn} />
                              ) : (
                                <button
                                  type="button"
                                  aria-label="View student"
                                  className={iconBtn}
                                  onClick={() => onView?.(student.id)}
                                />
                              )
                            }
                          >
                            <Eye className="size-3.5" strokeWidth={2} />
                          </TooltipTrigger>
                          <TooltipContent side="top">View</TooltipContent>
                        </Tooltip>
                      ) : null}
                      {canMutate && (edit || onEdit) ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              edit ? (
                                <Link href={edit} aria-label="Edit student" className={iconBtn} />
                              ) : (
                                <button
                                  type="button"
                                  aria-label="Edit student"
                                  className={iconBtn}
                                  onClick={() => onEdit?.(student.id)}
                                />
                              )
                            }
                          >
                            <Pencil className="size-3.5" strokeWidth={2} />
                          </TooltipTrigger>
                          <TooltipContent side="top">Edit</TooltipContent>
                        </Tooltip>
                      ) : null}
                      {canMutate ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                disabled={pending && pendingId === student.id}
                                aria-label="Delete student"
                                className={cn(iconBtn, "text-red-600")}
                                onClick={() => {
                                  if (!window.confirm("Delete this student?")) return;
                                  setPendingId(student.id);
                                  startTransition(async () => {
                                    try {
                                      if (mode === "admin") {
                                        await deleteAdminStudentInPlaceAction(student.id);
                                      } else {
                                        await deleteStudentInPlaceAction(student.id);
                                      }
                                      toast.success("Student deleted");
                                      onDeleted?.();
                                      router.refresh();
                                    } catch {
                                      toast.error("Could not delete student");
                                    } finally {
                                      setPendingId(null);
                                    }
                                  });
                                }}
                              />
                            }
                          >
                            {pending && pendingId === student.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" strokeWidth={2} />
                            )}
                          </TooltipTrigger>
                          <TooltipContent side="top">Delete</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
