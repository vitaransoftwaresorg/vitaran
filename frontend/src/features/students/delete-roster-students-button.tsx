"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deleteClassStudentsAction,
  deleteSectionStudentsAction,
} from "@/features/students/actions";
import {
  deleteAdminClassStudentsAction,
  deleteAdminSectionStudentsAction,
} from "@/features/students/admin-student-actions";

type DeleteRosterStudentsButtonProps = {
  mode: "school" | "admin";
  schoolId?: string;
  classLevel: number;
  /** When set, deletes only this section’s students (class/section stay). */
  sectionId?: string | null;
  sectionLabel?: string;
  studentCount: number;
};

/**
 * Delete all students in a section (or whole class) without removing the class/section setup.
 */
export function DeleteRosterStudentsButton({
  mode,
  schoolId,
  classLevel,
  sectionId,
  sectionLabel,
  studentCount,
}: DeleteRosterStudentsButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (studentCount <= 0) return null;
  if (mode === "admin" && !schoolId) return null;

  const scopeLabel = sectionId
    ? `Class ${classLevel}-${sectionLabel || "A"}`
    : `Class ${classLevel}`;

  function onClick() {
    const confirmed = window.confirm(
      sectionId
        ? `Delete all ${studentCount} student${studentCount === 1 ? "" : "s"} in ${scopeLabel}? The class and section stay. Results and OMR for these rolls are removed too.`
        : `Delete all ${studentCount} student${studentCount === 1 ? "" : "s"} in ${scopeLabel}? Class and sections stay. Results and OMR for these rolls are removed too.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result =
        mode === "admin" && schoolId
          ? sectionId
            ? await deleteAdminSectionStudentsAction(schoolId, sectionId)
            : await deleteAdminClassStudentsAction(schoolId, classLevel)
          : sectionId
            ? await deleteSectionStudentsAction(sectionId)
            : await deleteClassStudentsAction(classLevel);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        result.deleted === 1
          ? `Deleted 1 student from ${scopeLabel}`
          : `Deleted ${result.deleted} students from ${scopeLabel}`,
      );
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 rounded-lg border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
      disabled={pending}
      onClick={onClick}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      {sectionId ? "Delete section students" : "Delete class students"}
    </Button>
  );
}
