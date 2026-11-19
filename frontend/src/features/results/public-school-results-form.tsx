"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PUBLIC_RESULTS_PATH } from "./constants";

type PublicSchoolResultsFormProps = {
  initialCode?: string;
  /** Shown under the field after a lookup that found no school. */
  error?: string | null;
  compact?: boolean;
};

/** Guests enter their School ID to open that school's published results. */
export function PublicSchoolResultsForm({
  initialCode = "",
  error = null,
  compact = false,
}: PublicSchoolResultsFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={
        compact
          ? "flex flex-wrap items-end gap-2"
          : "mx-auto w-full max-w-md space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      }
      onSubmit={(event) => {
        event.preventDefault();
        const next = code.trim();
        if (!next) return;
        startTransition(() => {
          router.push(`${PUBLIC_RESULTS_PATH}?school=${encodeURIComponent(next)}`);
        });
      }}
    >
      {!compact ? (
        <h2 className="text-lg font-bold text-neutral-950">Find your school results</h2>
      ) : null}
      <div className={compact ? "min-w-0 flex-1" : "space-y-1.5"}>
        {!compact ? (
          <label htmlFor="school-id" className="text-xs font-semibold tracking-wide text-neutral-600 uppercase">
            School ID
          </label>
        ) : (
          <label htmlFor="school-id" className="sr-only">
            School ID
          </label>
        )}
        <Input
          id="school-id"
          name="school"
          value={code}
          onChange={(event) => setCode(event.currentTarget.value)}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          placeholder="e.g. 1018"
          className="h-10 font-mono text-sm"
          aria-invalid={Boolean(error)}
          disabled={pending}
        />
        {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : null}
      </div>
      <Button type="submit" disabled={pending || !code.trim()} className="h-10 shrink-0 gap-1.5">
        <Search className="size-4" />
        {pending ? "Looking…" : "Get results"}
      </Button>
    </form>
  );
}
