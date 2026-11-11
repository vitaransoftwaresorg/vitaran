import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const iconBtn =
  "flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-brand-50 hover:text-brand-800";

type AdminRowActionsProps = {
  viewHref?: string;
  editHref?: string;
  deleteHref?: string;
  onDelete?: () => void;
};

export function AdminRowActions({
  viewHref,
  editHref,
  deleteHref,
  onDelete,
}: AdminRowActionsProps) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-0.5">
      {viewHref ? (
        <Tooltip>
          <TooltipTrigger
            render={<Link href={viewHref} aria-label="View" className={iconBtn} />}
          >
            <Eye className="size-3.5" strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent side="top">View</TooltipContent>
        </Tooltip>
      ) : null}
      {editHref ? (
        <Tooltip>
          <TooltipTrigger
            render={<Link href={editHref} aria-label="Edit" className={iconBtn} />}
          >
            <Pencil className="size-3.5" strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent side="top">Edit</TooltipContent>
        </Tooltip>
      ) : null}
      {deleteHref || onDelete ? (
        <Tooltip>
          <TooltipTrigger
            render={
              deleteHref ? (
                <Link
                  href={deleteHref}
                  aria-label="Delete"
                  className={cn(iconBtn, "text-red-600")}
                />
              ) : (
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={onDelete}
                  className={cn(iconBtn, "text-red-600")}
                />
              )
            }
          >
            <Trash2 className="size-3.5" strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent side="top">Delete</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
