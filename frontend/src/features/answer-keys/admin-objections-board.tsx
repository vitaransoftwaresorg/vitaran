"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { documentAnswersHref } from "@/features/documents/constants";
import { capitalizeWords } from "@/features/schools/schema";
import { cn } from "@/lib/utils";
import type { AnswerKeyObjection, AnswerKeyObjectionStatus } from "@/types/answer-key-objection";
import { ANSWER_KEYS_PATH, objectionImageHref } from "./constants";
import { resolveObjectionAction } from "./objection-actions";
import { ObjectionPhoto } from "./objection-photo";

type AdminObjectionsBoardProps = {
  initialItems: AnswerKeyObjection[];
};

const FILTERS: Array<{ value: AnswerKeyObjectionStatus | "ALL"; label: string }> = [
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export function AdminObjectionsBoard({ initialItems }: AdminObjectionsBoardProps) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<AnswerKeyObjectionStatus | "ALL">("OPEN");
  const [reviewing, setReviewing] = useState<AnswerKeyObjection | null>(null);
  const [decision, setDecision] = useState<"RESOLVED" | "REJECTED">("RESOLVED");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const visible = useMemo(
    () => (filter === "ALL" ? items : items.filter((row) => row.status === filter)),
    [filter, items],
  );

  function submitReview() {
    if (!reviewing) return;
    const trimmed = note.trim();
    if (trimmed.length < 3) {
      setError("Add a short explanation.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resolveObjectionAction(reviewing.id, {
        status: decision,
        resolutionNote: trimmed,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setItems((prev) => prev.map((row) => (row.id === result.objection.id ? result.objection : row)));
      if (decision === "REJECTED") {
        toast.success("Objection rejected");
      } else if (result.objection.keyUpdated) {
        toast.success(`Objection resolved · key updated to ${result.objection.proposedAnswer}`);
      } else if (result.objection.proposedAnswer === "NONE") {
        toast.success("Objection resolved · key left unchanged (no right answer)");
      } else {
        toast.success("Objection resolved");
      }
      setReviewing(null);
      setNote("");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold",
              filter === item.value
                ? "border-brand-700 bg-brand-800 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
            )}
          >
            {item.label}
            {item.value !== "ALL" ? (
              <span className="ml-1 opacity-70">
                ({items.filter((row) => row.status === item.value).length})
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          No objections in this view.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-brand-100 bg-brand-50/70 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">School</th>
                  <th className="px-4 py-2.5">Key</th>
                  <th className="px-4 py-2.5">From</th>
                  <th className="px-4 py-2.5">Objection</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-950">
                        {capitalizeWords(row.school.name)}
                      </p>
                      <p className="text-xs text-neutral-500">{row.school.code}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      Test {row.answerKey.testNumber}
                      {row.answerKey.testId ? ` · ${row.answerKey.testId}` : ""}
                      <br />
                      <span className="text-xs text-neutral-500">
                        Class {row.answerKey.classLevel} · {row.answerKey.programCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {row.raisedBy === "TEACHER"
                        ? capitalizeWords(row.teacher?.name ?? "Teacher")
                        : "School"}
                      {row.questionNumber != null ? (
                        <p className="text-xs text-neutral-500">Q{row.questionNumber}</p>
                      ) : null}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-neutral-800">
                      {row.proposedAnswer ? (
                        <p className="mb-1 text-xs font-semibold text-brand-900">
                          Claims{" "}
                          {row.proposedAnswer === "NONE" ? "no right answer" : row.proposedAnswer}
                        </p>
                      ) : null}
                      <p className="line-clamp-3">{row.message}</p>
                      {row.hasImage ? <ObjectionPhoto href={objectionImageHref("admin", row.id)} /> : null}
                      {row.resolutionNote ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          Note: {row.resolutionNote}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          href={documentAnswersHref(ANSWER_KEYS_PATH, row.answerKeyId)}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Open key
                        </Link>
                        {row.status === "OPEN" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setReviewing(row);
                              setDecision("RESOLVED");
                              setNote("");
                              setError(null);
                            }}
                          >
                            Review
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!reviewing}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setReviewing(null);
            setNote("");
            setError(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Review objection</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewing
                ? `${capitalizeWords(reviewing.school.name)} · Test ${reviewing.answerKey.testNumber}`
                : null}
              {reviewing?.questionNumber != null ? ` · Q${reviewing.questionNumber}` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {reviewing ? (
            <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
              {reviewing.proposedAnswer ? (
                <p className="text-xs font-semibold text-brand-900">
                  Claims{" "}
                  {reviewing.proposedAnswer === "NONE"
                    ? "no right answer"
                    : reviewing.proposedAnswer}
                </p>
              ) : null}
              <p>{reviewing.message}</p>
              {reviewing.hasImage ? (
                <ObjectionPhoto href={objectionImageHref("admin", reviewing.id)} className="[&_img]:h-40" />
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 py-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDecision("RESOLVED")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-semibold",
                  decision === "RESOLVED"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                    : "border-neutral-200 text-neutral-700",
                )}
              >
                Resolve
              </button>
              <button
                type="button"
                onClick={() => setDecision("REJECTED")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-semibold",
                  decision === "REJECTED"
                    ? "border-red-600 bg-red-50 text-red-900"
                    : "border-neutral-200 text-neutral-700",
                )}
              >
                Reject
              </button>
            </div>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="resolution-note">Explanation *</FieldLabel>
              <Textarea
                id="resolution-note"
                value={note}
                rows={3}
                placeholder={
                  decision === "RESOLVED"
                    ? "What was fixed or confirmed…"
                    : "Why this objection is rejected…"
                }
                onChange={(e) => {
                  setNote(e.currentTarget.value);
                  setError(null);
                }}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={pending} onClick={submitReview} className="gap-1.5">
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : decision === "RESOLVED" ? (
                <Check className="size-4" />
              ) : (
                <X className="size-4" />
              )}
              {decision === "RESOLVED" ? "Resolve" : "Reject"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusChip({ status }: { status: AnswerKeyObjectionStatus }) {
  const styles =
    status === "OPEN"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : status === "RESOLVED"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : "bg-red-50 text-red-800 border-red-200";
  const label =
    status === "OPEN" ? "Open" : status === "RESOLVED" ? "Resolved" : "Rejected";
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", styles)}>
      {label}
    </span>
  );
}
