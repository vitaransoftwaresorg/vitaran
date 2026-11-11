import { cn } from "@/lib/utils";
import type { SchoolType } from "@/types/school";
import { TYPE_LABELS } from "./constants";

/** Customized schools are solid blue; regular schools are outlined. */
export function SchoolTypeBadge({ type, size = "default" }: { type: SchoolType; size?: "default" | "sm" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-xs",
        type === "CUSTOMIZED" ? "bg-brand-900 text-white" : "border border-brand-200 bg-white text-brand-800",
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}
