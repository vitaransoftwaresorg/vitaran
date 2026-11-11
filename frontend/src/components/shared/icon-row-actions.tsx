"use client";

import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const cellClass =
  "flex size-8 items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-950 disabled:pointer-events-none disabled:opacity-40";

const dangerClass =
  "flex size-8 items-center justify-center text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-40";

type IconRowActionsProps = {
  viewHref: string;
  editHref: string;
  label: string;
  className?: string;
  onDelete?: () => void;
  deleteDisabled?: boolean;
};

/** View + Edit (+ optional Delete) in one bordered group, with hover tooltips. */
export function IconRowActions({
  viewHref,
  editHref,
  label,
  className,
  onDelete,
  deleteDisabled,
}: IconRowActionsProps) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={viewHref}
              aria-label={`View ${label}`}
              className={cellClass}
            />
          }
        >
          <Eye className="size-3.5" strokeWidth={2} />
        </TooltipTrigger>
        <TooltipContent side="top">View</TooltipContent>
      </Tooltip>

      <span aria-hidden className="w-px self-stretch bg-neutral-200" />

      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={editHref}
              aria-label={`Edit ${label}`}
              className={cellClass}
            />
          }
        >
          <Pencil className="size-3.5" strokeWidth={2} />
        </TooltipTrigger>
        <TooltipContent side="top">Edit</TooltipContent>
      </Tooltip>

      {onDelete && (
        <>
          <span aria-hidden className="w-px self-stretch bg-neutral-200" />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={deleteDisabled}
                  aria-label={`Delete ${label}`}
                  onClick={onDelete}
                  className={dangerClass}
                />
              }
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
            </TooltipTrigger>
            <TooltipContent side="top">Delete</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
