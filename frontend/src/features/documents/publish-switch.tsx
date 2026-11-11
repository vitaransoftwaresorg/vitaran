"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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
  const [optimistic, setOptimistic] = useOptimistic(published);

  const toggle = (next: boolean) => {
    startTransition(async () => {
      setOptimistic(next);
      const result = await onToggle(next);
      if (!result.ok) toast.error(result.message);
      else toast.success(next ? "Published. Schools can see it now." : "Hidden from schools.");
    });
  };

  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <Switch
        checked={optimistic}
        onCheckedChange={toggle}
        disabled={pending}
        aria-label={`${optimistic ? "Hide" : "Publish"} ${label}`}
        className="data-checked:bg-brand-900"
      />
      <span
        className={cn(
          "w-14 text-xs font-semibold",
          optimistic ? "text-brand-900" : "text-neutral-400",
        )}
      >
        {optimistic ? "Published" : "Hidden"}
      </span>
    </label>
  );
}
