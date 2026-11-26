"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
  /** Controlled dialog open (e.g. opened from a mobile More menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the default trigger when another control opens the dialog. */
  hideTrigger?: boolean;
};

const CONFIRM_WORD = "delete";

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
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: DeleteRosterStudentsButtonProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  if (studentCount <= 0) return null;
  if (mode === "admin" && !schoolId) return null;

  const scopeLabel = sectionId
    ? `Class ${classLevel}-${sectionLabel || "A"}`
    : `Class ${classLevel}`;
  const canConfirm = typed.trim().toLowerCase() === CONFIRM_WORD;

  function closeDialog() {
    if (pending) return;
    setOpen(false);
    setTyped("");
  }

  function onConfirm() {
    if (!canConfirm || pending) return;
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
      setOpen(false);
      setTyped("");
      router.refresh();
    });
  }

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 rounded-md border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50 hover:text-red-800"
          disabled={pending}
          onClick={() => {
            setTyped("");
            setOpen(true);
          }}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          {sectionId ? "Delete section" : "Delete class"}
        </Button>
      )}

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setTyped("");
            setOpen(true);
          } else {
            closeDialog();
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sectionId ? "Delete section students?" : "Delete class students?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove {studentCount} student{studentCount === 1 ? "" : "s"} from{" "}
              <span className="font-medium text-foreground">{scopeLabel}</span>. Results and OMR for
              these rolls are removed too. Type <span className="font-semibold text-foreground">delete</span>{" "}
              to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            value={typed}
            disabled={pending}
            placeholder="delete"
            aria-label="Type delete to confirm"
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onConfirm();
              }
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!canConfirm || pending}
              onClick={onConfirm}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
