"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Save, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DocumentFormShellProps = {
  message?: string;
  cancelHref: string;
  editing: boolean;
  /** Edits only show "Save changes" once something changed. */
  changed: boolean;
  pending: boolean;
  /** e.g. "Upload result". */
  uploadLabel: string;
  children: ReactNode;
};

export function DocumentFormShell({
  message,
  cancelHref,
  editing,
  changed,
  pending,
  uploadLabel,
  children,
}: DocumentFormShellProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_1px_2px_rgb(25_28_95/0.04),0_12px_32px_-16px_rgb(25_28_95/0.18)]">
      {message && (
        <div
          role="alert"
          className="flex items-center gap-2.5 border-b border-destructive/15 bg-destructive/5 px-6 py-3 text-sm font-medium text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          {message}
        </div>
      )}

      <div className="divide-y divide-brand-100/70">{children}</div>

      <div className="flex items-center justify-between gap-3 border-t border-brand-100 bg-brand-50/40 px-6 py-3.5">
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        {(!editing || changed) && (
          <Button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-brand-900 px-5 text-white animate-in fade-in-0 zoom-in-95 duration-150 hover:bg-brand-800"
          >
            {pending ? <Loader2 className="animate-spin" /> : editing ? <Save /> : <Upload />}
            {pending ? "Saving…" : editing ? "Save changes" : uploadLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="px-6 py-5">
      <h2 className={cn("text-base font-bold text-neutral-950", !description && "mb-3.5")}>{title}</h2>
      {description ? (
        <p className="mt-1 mb-3.5 max-w-2xl text-sm text-neutral-500">{description}</p>
      ) : null}
      {children}
    </section>
  );
}
