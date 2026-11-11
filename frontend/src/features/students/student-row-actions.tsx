"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteStudentAction } from "@/features/students/actions";
import { cn } from "@/lib/utils";

const iconBtn =
  "flex size-8 cursor-pointer items-center justify-center rounded-md text-neutral-500 hover:bg-brand-50 hover:text-brand-800 disabled:pointer-events-none disabled:opacity-40";

type StudentRowActionsProps = {
  studentId: string;
  viewHref: string;
  editHref: string;
  deleteReturnTo: string;
};

export function StudentRowActions({
  studentId,
  viewHref,
  editHref,
  deleteReturnTo,
}: StudentRowActionsProps) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 items-center justify-end gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={<Link href={viewHref} aria-label="View student" className={iconBtn} />}
        >
          <Eye className="size-3.5" strokeWidth={2} />
        </TooltipTrigger>
        <TooltipContent side="top">View</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={<Link href={editHref} aria-label="Edit student" className={iconBtn} />}
        >
          <Pencil className="size-3.5" strokeWidth={2} />
        </TooltipTrigger>
        <TooltipContent side="top">Edit</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              disabled={pending}
              aria-label="Delete student"
              className={cn(iconBtn, "text-red-600")}
              onClick={() => {
                if (!window.confirm("Delete this student?")) return;
                startTransition(() => {
                  void deleteStudentAction(studentId, deleteReturnTo).catch(() => {
                    toast.error("Could not delete student");
                  });
                });
              }}
            />
          }
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" strokeWidth={2} />
          )}
        </TooltipTrigger>
        <TooltipContent side="top">Delete</TooltipContent>
      </Tooltip>
    </div>
  );
}
