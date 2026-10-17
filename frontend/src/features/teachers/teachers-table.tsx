"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconRowActions } from "@/components/shared/icon-row-actions";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SUBJECT_LABELS } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import type { Teacher, TeacherStatus } from "@/types/teacher";
import { TEACHER_STATUS_LABELS } from "./constants";
import { capitalizeWords } from "../schools/schema";

type TeachersTableProps = {
  teachers: Teacher[];
  /** Base path only, e.g. `/admin/teachers` → links to `${editHrefBase}/${id}/edit`. */
  editHrefBase: string;
  onToggleStatus: (id: string, status: TeacherStatus) => Promise<{ ok: boolean; message?: string }>;
  showSchool?: boolean;
};

export function TeachersTable({
  teachers,
  editHrefBase,
  onToggleStatus,
  showSchool,
}: TeachersTableProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (teachers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
        <p className="text-sm font-semibold text-neutral-950">No teachers yet</p>
        <p className="mt-1 text-sm text-neutral-500">Add a teacher to assign classes and subjects.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]">
      <Table>
        <TableHeader>
          <TableRow className="border-brand-100 bg-brand-50/60 hover:bg-brand-50/60">
            <TableHead className="pl-5 text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
              Teacher
            </TableHead>
            {showSchool && (
              <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                School
              </TableHead>
            )}
            <TableHead className="hidden text-[11px] font-semibold tracking-wider text-brand-700 uppercase md:table-cell">
              Assignments
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
              Status
            </TableHead>
            <TableHead className="w-28 pr-5 text-right text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => {
            const active = teacher.status === "ACTIVE";
            return (
              <TableRow
                key={teacher.id}
                className="border-brand-100/70 hover:bg-brand-50/40"
              >
                <TableCell className="py-3.5 pl-5">
                  <Link href={`${editHrefBase}/${teacher.id}`} className="group block min-w-0">
                    <p className="font-semibold text-neutral-950 group-hover:text-brand-800 group-hover:underline">
                      {capitalizeWords(teacher.name)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{teacher.email}</p>
                  </Link>
                </TableCell>
                {showSchool && (
                  <TableCell className="text-sm text-neutral-700">
                    <p className="font-medium text-neutral-900">{teacher.school.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
                      {teacher.school.code}
                    </p>
                  </TableCell>
                )}
                <TableCell className="hidden max-w-sm md:table-cell">
                  {teacher.assignments.length === 0 ? (
                    <span className="text-xs text-neutral-400">No assignments</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {teacher.assignments.slice(0, 4).map((item) => (
                        <span
                          key={`${item.programId}-${item.classLevel}-${item.subject}`}
                          className="rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800"
                        >
                          C{item.classLevel} · {SUBJECT_LABELS[item.subject]}
                        </span>
                      ))}
                      {teacher.assignments.length > 4 && (
                        <span className="text-[11px] font-medium text-neutral-500">
                          +{teacher.assignments.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Switch
                      className="cursor-pointer"
                      checked={active}
                      disabled={pendingId === teacher.id}
                      onCheckedChange={(checked) => {
                        setPendingId(teacher.id);
                        startTransition(async () => {
                          const next = checked ? "ACTIVE" : "INACTIVE";
                          try {
                            const result = await onToggleStatus(teacher.id, next);
                            if (!result.ok) {
                              toast.error(result.message ?? "Update failed");
                              return;
                            }
                            toast.success(
                              `${teacher.name} is now ${TEACHER_STATUS_LABELS[next].toLowerCase()}`,
                            );
                            router.refresh();
                          } finally {
                            setPendingId(null);
                          }
                        });
                      }}
                    />
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        active
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-neutral-100 text-neutral-600",
                      )}
                    >
                      {TEACHER_STATUS_LABELS[teacher.status]}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <IconRowActions
                    viewHref={`${editHrefBase}/${teacher.id}`}
                    editHref={`${editHrefBase}/${teacher.id}/edit`}
                    label={teacher.name}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
