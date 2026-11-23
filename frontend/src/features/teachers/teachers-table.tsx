"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { IconRowActions } from "@/components/shared/icon-row-actions";
import { matchesSearch, TableSearch } from "@/components/shared/table-search";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProfileLink, schoolProfileHref } from "@/components/shared/profile-link";
import { silenceLive } from "@/features/live/silence";
import { subjectLabel } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import type { Teacher, TeacherStatus } from "@/types/teacher";
import { TEACHER_STATUS_LABELS } from "./constants";

type TeachersTableProps = {
  teachers: Teacher[];
  /** Base path only, e.g. `/admin/teachers` → links to `${editHrefBase}/${id}/edit`. */
  editHrefBase: string;
  onToggleStatus: (id: string, status: TeacherStatus) => Promise<{ ok: boolean; message?: string }>;
  showSchool?: boolean;
  pagination?: ReactNode;
};

function StatusSwitch({
  teacher,
  status,
  onToggleStatus,
}: {
  teacher: Teacher;
  status: TeacherStatus;
  onToggleStatus: TeachersTableProps["onToggleStatus"];
}) {
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(status === "ACTIVE");

  // Sync from server only when idle — never yank this switch during a neighbor's save.
  useEffect(() => {
    if (!pending) setChecked(status === "ACTIVE");
  }, [status, pending]);

  const toggle = (next: boolean) => {
    const previous = checked;
    const nextStatus: TeacherStatus = next ? "ACTIVE" : "INACTIVE";
    // Keep this tab from live-refreshing and blinking the other switches.
    silenceLive(4_000);
    setChecked(next);
    startTransition(async () => {
      try {
        const result = await onToggleStatus(teacher.id, nextStatus);
        if (!result.ok) {
          setChecked(previous);
          toast.error(result.message ?? "Update failed");
          return;
        }
        toast.success(
          `${teacher.name} is now ${TEACHER_STATUS_LABELS[nextStatus].toLowerCase()}`,
        );
      } catch {
        setChecked(previous);
        toast.error("Update failed");
      }
    });
  };

  return (
    <div className="flex items-center gap-2.5">
      <Switch
        className="cursor-pointer"
        checked={checked}
        disabled={pending}
        onCheckedChange={toggle}
      />
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
          checked ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-600",
        )}
      >
        {TEACHER_STATUS_LABELS[checked ? "ACTIVE" : "INACTIVE"]}
      </span>
    </div>
  );
}

export function TeachersTable({
  teachers,
  editHrefBase,
  onToggleStatus,
  showSchool,
  pagination,
}: TeachersTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      teachers.filter((teacher) =>
        matchesSearch(
          query,
          teacher.name,
          teacher.email,
          teacher.school?.name,
          teacher.school?.code,
          TEACHER_STATUS_LABELS[teacher.status],
          ...teacher.assignments.flatMap((item) => [
            `C${item.classLevel}`,
            subjectLabel(item.subject),
          ]),
        ),
      ),
    [teachers, query],
  );

  if (teachers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
        <p className="text-sm font-semibold text-neutral-950">No teachers yet</p>
        <p className="mt-1 text-sm text-neutral-500">Add a teacher to assign classes and subjects.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/40 px-3 py-2.5 sm:px-5">
        <p className="text-xs font-medium text-neutral-500 tabular-nums">
          {filtered.length === teachers.length
            ? `${teachers.length} teacher${teachers.length === 1 ? "" : "s"}`
            : `${filtered.length} of ${teachers.length} teachers`}
        </p>
        <TableSearch value={query} onChange={setQuery} placeholder="Search teachers" />
      </div>
      {filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-500">No matching teachers.</p>
      ) : (
      <div className="overflow-x-auto">
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
          {filtered.map((teacher) => (
              <TableRow
                key={teacher.id}
                className="border-brand-100/70 hover:bg-brand-50/40"
              >
                <TableCell className="py-3.5 pl-5">
                  <div className="min-w-0">
                    <ProfileLink href={`${editHrefBase}/${teacher.id}`} className="font-semibold">
                      {teacher.name}
                    </ProfileLink>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{teacher.email}</p>
                  </div>
                </TableCell>
                {showSchool && (
                  <TableCell className="text-sm text-neutral-700">
                    <ProfileLink href={schoolProfileHref(teacher.school.id)}>
                      {teacher.school.name}
                    </ProfileLink>
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
                          C{item.classLevel} · {subjectLabel(item.subject)}
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
                  <StatusSwitch
                    teacher={teacher}
                    status={teacher.status}
                    onToggleStatus={onToggleStatus}
                  />
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <IconRowActions
                    viewHref={`${editHrefBase}/${teacher.id}`}
                    editHref={`${editHrefBase}/${teacher.id}/edit`}
                    label={teacher.name}
                  />
                </TableCell>
              </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      )}
      {pagination}
    </div>
  );
}
