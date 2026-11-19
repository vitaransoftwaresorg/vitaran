"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { silenceLive } from "@/features/live/silence";
import { cn } from "@/lib/utils";
import type { DeleteResult } from "@/types/document";

type PublishSwitchProps = {
  published: boolean;
  /** What is being toggled, for the accessible label, e.g. "Test 3 · Olympiad Program". */
  label: string;
  onToggle: (published: boolean) => Promise<DeleteResult>;
};

/** Shows or hides an item from schools; flips instantly and rolls back if the save fails. */
export function PublishSwitch({ published, label, onToggle }: PublishSwitchProps) {
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(published);

  // Sync from server only when idle — never yank other switches during a neighbor's refresh.
  useEffect(() => {
    if (!pending) setChecked(published);
  }, [published, pending]);

  const toggle = (next: boolean) => {
    // Don't let this tab's SSE / soft refresh remount every switch.
    silenceLive(4_000);
    setChecked(next);
    startTransition(async () => {
      const result = await onToggle(next);
      if (!result.ok) {
        setChecked(published);
        toast.error(result.message);
        return;
      }
      toast.success(next ? "Published. Schools can see it now." : "Hidden from schools.");
    });
  };

  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={toggle}
        disabled={pending}
        aria-label={`${checked ? "Hide" : "Publish"} ${label}`}
        className="data-checked:bg-brand-900"
      />
      <span
        className={cn(
          "w-14 text-xs font-semibold",
          checked ? "text-brand-900" : "text-neutral-400",
        )}
      >
        {checked ? "Published" : "Hidden"}
      </span>
    </label>
  );
}
