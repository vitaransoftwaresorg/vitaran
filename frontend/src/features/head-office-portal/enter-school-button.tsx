"use client";

import { useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openHeadOfficeSchoolWorkspaceAction } from "@/features/head-office-portal/actions";
import { cn } from "@/lib/utils";

type EnterSchoolButtonProps = {
  schoolId: string;
  label?: string;
  /** Compact outline for tables; solid brand CTA elsewhere. */
  tone?: "primary" | "compact";
  className?: string;
};

export function EnterSchoolButton({
  schoolId,
  label = "Open school",
  tone = "primary",
  className,
}: EnterSchoolButtonProps) {
  const [pending, startTransition] = useTransition();
  const compact = tone === "compact";

  return (
    <Button
      type="button"
      size={compact ? "sm" : "default"}
      disabled={pending}
      aria-label={label}
      className={cn(
        "group gap-1.5 font-semibold",
        compact
          ? "border-brand-200 bg-white text-brand-900 hover:border-brand-800 hover:bg-brand-800 hover:text-white"
          : "h-9 bg-brand-900 px-4 text-white shadow-[0_8px_20px_-10px_rgb(25_28_95/0.65)] hover:bg-brand-800",
        className,
      )}
      variant={compact ? "outline" : "default"}
      onClick={() =>
        startTransition(async () => {
          const result = await openHeadOfficeSchoolWorkspaceAction(schoolId);
          if (result && !result.ok) toast.error(result.message);
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {label}
      {!pending ? (
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </Button>
  );
}
