"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, ImageIcon, Loader2, MessageSquareWarning, X } from "lucide-react";
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
import { matchesSearch, TableSearch } from "@/components/shared/table-search";
import { documentAnswersHref } from "@/features/documents/constants";
import { capitalizeWords } from "@/features/schools/schema";
import { useResetOnScopeChange } from "@/hooks/use-reset-on-scope-change";
import { cn } from "@/lib/utils";
import {
  ProfileLink,
  schoolProfileHref,
  teacherProfileHref,
} from "@/components/shared/profile-link";
import { formatDateTime } from "@/utils/format";
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
  const [syncedItems, setSyncedItems] = useState(initialItems);
  const [filter, setFilter] = useState<AnswerKeyObjectionStatus | "ALL">("OPEN");
  const [query, setQuery] = useState("");
  // Soft-nav back into objections must not keep a leftover school/name filter.
  useResetOnScopeChange(`objections:${initialItems.length}:${initialItems[0]?.id ?? ""}`, () =>
    setQuery(""),
  );
  const [reviewing, setReviewing] = useState<AnswerKeyObjection | null>(null);
  const [decision, setDecision] = useState<"RESOLVED" | "REJECTED">("RESOLVED");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (syncedItems !== initialItems) {
    setSyncedItems(initialItems);
    setItems(initialItems);
  }

  const counts = useMemo(
    () => ({
      OPEN: items.filter((row) => row.status === "OPEN").length,
      RESOLVED: items.filter((row) => row.status === "RESOLVED").length,
      REJECTED: items.filter((row) => row.status === "REJECTED").length,
      ALL: items.length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const statusFiltered =
      filter === "ALL" ? items : items.filter((row) => row.status === filter);
    return statusFiltered
      .filter((row) =>
        matchesSearch(
          query,
          row.school.name,
          row.school.code,
          row.answerKey.testNumber,
          row.answerKey.testId,
          row.answerKey.classLevel,
          row.answerKey.programCode,
          row.teacher?.name,
          row.raisedBy,
          row.questionNumber,
          row.message,
          row.status,
          row.proposedAnswer,
          row.currentAnswer,
        ),
      )
      .sort((a, b) => {
        if (a.status === "OPEN" && b.status !== "OPEN") return -1;
        if (b.status === "OPEN" && a.status !== "OPEN") return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [filter, items, query]);

  function openReview(row: AnswerKeyObjection) {
    setReviewing(row);
    setDecision("RESOLVED");
    setNote("");
    setError(null);
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex w-full gap-0.5 rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5 sm:w-auto"
          role="tablist"
          aria-label="Filter objections"
        >
          {FILTERS.map((item) => {
            const active = filter === item.value;
            const count = counts[item.value];
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                  active
                    ? "bg-white text-brand-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "min-w-5 rounded px-1 py-px text-[11px] font-semibold tabular-nums",
                    active ? "bg-brand-50 text-brand-800" : "text-neutral-500",
                    item.value === "OPEN" && count > 0 && "text-amber-800",
                    item.value === "OPEN" && count > 0 && active && "bg-amber-50 text-amber-900",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <TableSearch value={query} onChange={setQuery} placeholder="Search school, test, Q…" />
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-20 text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-brand-100">
            <MessageSquareWarning className="size-5" />
          </span>
          <p className="text-sm font-semibold text-neutral-900">
            {query.trim() ? "No matching objections" : emptyTitle(filter)}
          </p>
          <p className="mt-1 max-w-sm text-sm text-neutral-500">
            {query.trim()
              ? "Try another school, test number, or question."
              : emptyHint(filter)}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <ul className="divide-y divide-neutral-100">
            {visible.map((row) => (
              <li key={row.id}>
                <ObjectionRow row={row} onReview={() => openReview(row)} />
              </li>
            ))}
          </ul>
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
        <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <AlertDialogHeader className="space-y-1 border-b border-neutral-100 px-5 py-4 text-left">
            <AlertDialogTitle>Review objection</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600">
              {reviewing ? <KeyContext row={reviewing} /> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {reviewing ? (
            <div className="max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto px-5 py-4">
              <ClaimPanel row={reviewing} />

              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                  Reason
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-900">
                  {reviewing.message}
                </p>
                {reviewing.hasImage ? (
                  <ObjectionPhoto
                    href={objectionImageHref("admin", reviewing.id)}
                    className="mt-3 [&_img]:h-48 [&_img]:max-w-full"
                  />
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDecision("RESOLVED")}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition-colors",
                    decision === "RESOLVED"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600/15"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Check className="size-4" />
                    Resolve
                  </span>
                  <span className="mt-1 block text-xs leading-snug opacity-80">
                    {reviewing.proposedAnswer && reviewing.proposedAnswer !== "NONE"
                      ? "Accept claim and update key"
                      : "Accept claim"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDecision("REJECTED")}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition-colors",
                    decision === "REJECTED"
                      ? "border-red-600 bg-red-50 text-red-950 ring-1 ring-red-600/15"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <X className="size-4" />
                    Reject
                  </span>
                  <span className="mt-1 block text-xs leading-snug opacity-80">
                    Keep published key as is
                  </span>
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
          ) : null}

          <AlertDialogFooter className="border-t border-neutral-100 bg-neutral-50/70 px-5 py-3">
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

function ObjectionRow({
  row,
  onReview,
}: {
  row: AnswerKeyObjection;
  onReview: () => void;
}) {
  const open = row.status === "OPEN";

  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 px-4 py-3.5 transition-colors sm:flex-row sm:items-start sm:gap-4 sm:px-5 sm:py-4",
        open ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-neutral-50/80",
      )}
    >
      {open ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-0.5 bg-amber-500"
        />
      ) : null}

      <div className="flex shrink-0 items-start gap-2.5 sm:w-[4.5rem] sm:flex-col sm:items-center sm:pt-0.5">
        <StatusChip status={row.status} />
        {row.questionNumber != null ? (
          <span className="text-lg font-bold tracking-tight text-brand-900 tabular-nums sm:text-xl">
            Q{row.questionNumber}
          </span>
        ) : (
          <span className="text-xs font-medium text-neutral-400">General</span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <ProfileLink
            href={schoolProfileHref(row.school.id)}
            className="truncate text-sm font-semibold text-neutral-950 hover:text-brand-900"
          >
            {capitalizeWords(row.school.name)}
          </ProfileLink>
          <span className="text-xs text-neutral-400">{row.school.code}</span>
        </div>

        <p className="text-xs text-neutral-500">
          Test {row.answerKey.testNumber}
          {row.answerKey.testId ? (
            <span className="text-neutral-400"> · {row.answerKey.testId}</span>
          ) : null}
          {" · "}
          Class {row.answerKey.classLevel}
          {" · "}
          {row.answerKey.programCode}
          {" · "}
          <RaisedBy row={row} />
          {" · "}
          {formatDateTime(row.createdAt)}
        </p>

        <AnswerChange row={row} />

        <p className="line-clamp-2 text-sm leading-relaxed text-neutral-700">{row.message}</p>

        {row.hasImage ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
            <ImageIcon className="size-3.5" />
            Photo attached
          </span>
        ) : null}

        {row.resolutionNote ? (
          <p className="rounded-md border border-neutral-100 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">
            <span className="font-semibold text-neutral-800">Note · </span>
            {row.resolutionNote}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
        {open ? (
          <Button type="button" size="sm" onClick={onReview} className="gap-1.5">
            Review
            <ArrowRight className="size-3.5" />
          </Button>
        ) : null}
        <Link
          href={documentAnswersHref(ANSWER_KEYS_PATH, row.answerKeyId)}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-1.5",
          )}
        >
          <ExternalLink className="size-3.5" />
          Open key
        </Link>
      </div>
    </article>
  );
}

function ClaimPanel({ row }: { row: AnswerKeyObjection }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3.5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {row.questionNumber != null ? (
          <span className="rounded-md bg-brand-900 px-2 py-1 text-sm font-bold text-white tabular-nums">
            Q{row.questionNumber}
          </span>
        ) : (
          <span className="rounded-md bg-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700">
            General
          </span>
        )}
        <RaisedBy row={row} className="text-sm text-neutral-600" />
      </div>
      <AnswerChange row={row} large />
    </div>
  );
}

function KeyContext({ row }: { row: AnswerKeyObjection }) {
  return (
    <>
      <ProfileLink
        href={schoolProfileHref(row.school.id)}
        className="font-medium text-neutral-800 hover:text-brand-900"
      >
        {capitalizeWords(row.school.name)}
      </ProfileLink>
      {" · "}
      Test {row.answerKey.testNumber}
      {" · "}
      Class {row.answerKey.classLevel}
      {" · "}
      {row.answerKey.programCode}
    </>
  );
}

function RaisedBy({
  row,
  className,
}: {
  row: AnswerKeyObjection;
  className?: string;
}) {
  if (row.raisedBy === "TEACHER") {
    return (
      <ProfileLink
        href={row.teacher ? teacherProfileHref("admin", row.teacher.id) : null}
        className={cn("font-medium text-neutral-700", className)}
      >
        {capitalizeWords(row.teacher?.name ?? "Teacher")}
      </ProfileLink>
    );
  }
  return <span className={cn("font-medium text-neutral-700", className)}>School account</span>;
}

function emptyTitle(filter: AnswerKeyObjectionStatus | "ALL") {
  if (filter === "OPEN") return "No open objections";
  if (filter === "RESOLVED") return "No resolved objections yet";
  if (filter === "REJECTED") return "No rejected objections";
  return "No objections yet";
}

function emptyHint(filter: AnswerKeyObjectionStatus | "ALL") {
  if (filter === "OPEN") {
    return "When schools or teachers raise a key objection, it shows up here for review.";
  }
  return "Switch filters to see other statuses.";
}

function StatusChip({ status }: { status: AnswerKeyObjectionStatus }) {
  const styles =
    status === "OPEN"
      ? "bg-amber-100 text-amber-950"
      : status === "RESOLVED"
        ? "bg-emerald-100 text-emerald-950"
        : "bg-red-100 text-red-950";
  const label =
    status === "OPEN" ? "Open" : status === "RESOLVED" ? "Resolved" : "Rejected";
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        styles,
      )}
    >
      {label}
    </span>
  );
}

function formatAnswer(value: string | null | undefined) {
  if (!value) return "not set";
  if (value === "NONE") return "no right answer";
  if (value === "ADD") return "ADD marks";
  return value;
}

/** Current key answer next to the claimed one. */
function AnswerChange({
  row,
  className,
  large,
}: {
  row: AnswerKeyObjection;
  className?: string;
  large?: boolean;
}) {
  if (!row.proposedAnswer && !row.currentAnswer) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        large ? "text-base" : "text-sm",
        className,
      )}
    >
      {row.questionNumber != null ? (
        <span
          className={cn(
            "inline-flex items-center rounded-md border border-neutral-200 bg-white font-semibold text-neutral-800",
            large ? "px-2.5 py-1.5" : "px-2 py-1 text-xs",
          )}
        >
          Key {formatAnswer(row.currentAnswer)}
        </span>
      ) : null}
      {row.proposedAnswer ? (
        <>
          {row.questionNumber != null ? (
            <ArrowRight className={cn("shrink-0 text-neutral-400", large ? "size-4" : "size-3.5")} />
          ) : null}
          <span
            className={cn(
              "inline-flex items-center rounded-md border border-brand-200 bg-brand-50 font-semibold text-brand-950",
              large ? "px-2.5 py-1.5" : "px-2 py-1 text-xs",
            )}
          >
            Claims {formatAnswer(row.proposedAnswer)}
          </span>
        </>
      ) : null}
    </div>
  );
}
