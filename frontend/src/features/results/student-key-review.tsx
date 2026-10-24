"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OmQuestionReview } from "@/types/om-scan";
import type { Subject } from "@/types/school";
import { MPCB } from "@/features/student-portal/subject-colors";
import { StatStrip } from "@/features/student-portal/student-ui";

const OPTIONS = ["A", "B", "C", "D"] as const;
type ResultFilter = "ALL" | OmQuestionReview["result"];

const TAB_LABELS: Record<Subject, string> = {
  MATHEMATICS: "Maths",
  PHYSICS: "Physics",
  CHEMISTRY: "Chemistry",
  BIOLOGY: "Biology",
  SCIENCE: "Science",
};

const RESULT_BADGE: Record<OmQuestionReview["result"], { label: string; className: string }> = {
  OK: { label: "Correct", className: "bg-emerald-50 text-emerald-800" },
  PARTIAL: { label: "Partial", className: "bg-amber-50 text-amber-800" },
  BONUS: { label: "Bonus", className: "bg-sky-50 text-sky-800" },
  WRONG: { label: "Wrong", className: "bg-rose-50 text-rose-800" },
  BLANK: { label: "Blank", className: "bg-neutral-100 text-neutral-600" },
  INVALID: { label: "Invalid", className: "bg-amber-50 text-amber-800" },
};

function countsOf(rows: OmQuestionReview[]) {
  return {
    ALL: rows.length,
    OK: rows.filter((row) => row.result === "OK" || row.result === "BONUS").length,
    PARTIAL: rows.filter((row) => row.result === "PARTIAL").length,
    BONUS: rows.filter((row) => row.result === "BONUS").length,
    WRONG: rows.filter((row) => row.result === "WRONG").length,
    BLANK: rows.filter((row) => row.result === "BLANK").length,
    INVALID: rows.filter((row) => row.result === "INVALID").length,
  };
}

function accuracyOf(counts: ReturnType<typeof countsOf>) {
  const attempted = counts.OK + counts.PARTIAL + counts.WRONG;
  return attempted ? Math.round((counts.OK / attempted) * 1000) / 10 : null;
}

function stripItems(counts: ReturnType<typeof countsOf>) {
  const accuracy = accuracyOf(counts);
  const items = [
    { label: "Correct", value: counts.OK, tone: "good" as const },
    { label: "Partial", value: counts.PARTIAL, tone: "warn" as const },
    { label: "Wrong", value: counts.WRONG, tone: "bad" as const },
    { label: "Blank", value: counts.BLANK },
    { label: "Accuracy", value: accuracy != null ? `${accuracy}%` : "—", tone: "brand" as const },
  ];
  if (counts.PARTIAL === 0) items.splice(1, 1);
  if (counts.INVALID > 0) items.splice(2, 0, { label: "Invalid", value: counts.INVALID, tone: "warn" as const });
  return items;
}

function SubjectPanel({ rows }: { rows: OmQuestionReview[] }) {
  const [filter, setFilter] = useState<ResultFilter>("ALL");
  const counts = countsOf(rows);
  const visible = rows.filter((row) => filter === "ALL" || row.result === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["ALL", "All"],
            ["WRONG", "Wrong"],
            ["OK", "Correct"],
            ["PARTIAL", "Partial"],
            ["BONUS", "Bonus"],
            ["BLANK", "Blank"],
            ["INVALID", "Invalid"],
          ] as Array<[ResultFilter, string]>
        )
          .filter(([id]) => id === "ALL" || counts[id] > 0)
          .map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                filter === id
                  ? "bg-brand-900 text-white"
                  : "border border-brand-100 bg-white text-brand-800 hover:bg-brand-50",
              )}
            >
              {label}
              <span className="tabular-nums opacity-70">{counts[id]}</span>
            </button>
          ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-6 py-10 text-center text-sm text-brand-700">
          Nothing in this filter.
        </p>
      ) : (
        <ol className="max-w-3xl space-y-2.5">
          {visible.map((row) => (
            <QuestionRow key={row.question} row={row} />
          ))}
        </ol>
      )}
    </div>
  );
}

function QuestionRow({ row }: { row: OmQuestionReview }) {
  const [open, setOpen] = useState(false);
  const summary =
    row.result === "INVALID"
      ? "Could not read this question."
      : row.result === "BONUS"
        ? `Bonus — ${row.marks} marks.`
        : row.result === "PARTIAL"
          ? `You marked ${row.marked} · Key ${row.key ?? "—"} · ${row.marks} marks`
          : row.marked
            ? `You marked ${row.marked} · Key ${row.key ?? "—"} · ${row.marks} marks`
            : `Left blank · Key ${row.key ?? "—"}`;

  return (
    <li className="rounded-xl border border-brand-100 bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-bold text-neutral-950">Q{row.question}</p>
        <div className="flex items-center gap-1.5">
          {OPTIONS.map((option) => (
            <Bubble
              key={option}
              option={option}
              marked={Boolean(row.marked && row.marked.replace(/[^A-D]/g, "").includes(option))}
              isKey={Boolean(row.key && row.key !== "ADD" && row.key.split(/[,/]/).includes(option))}
            />
          ))}
        </div>
        <p className="text-xs text-neutral-500">{summary}</p>
        <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", RESULT_BADGE[row.result].className)}>
          {RESULT_BADGE[row.result].label}
        </span>
        {row.explanation ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-800 hover:text-brand-950"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            {open ? "Hide explanation" : "See explanation"}
          </button>
        ) : null}
      </div>
      {open && row.explanation ? (
        <p className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-brand-50 px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-neutral-700">
          {row.explanation}
        </p>
      ) : null}
    </li>
  );
}

function Bubble({ option, marked, isKey }: { option: string; marked: boolean; isKey: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-full border text-xs font-bold",
        marked && isKey && "border-emerald-600 bg-emerald-600 text-white",
        marked && !isKey && "border-rose-600 bg-rose-600 text-white",
        !marked && isKey && "border-emerald-600 bg-white text-emerald-700 ring-2 ring-emerald-200",
        !marked && !isKey && "border-neutral-200 bg-white text-neutral-400",
      )}
      title={marked && isKey ? "Your answer · correct" : marked ? "Your answer" : isKey ? "Correct answer" : undefined}
    >
      {option}
    </span>
  );
}

export function StudentKeyReview({ review }: { review: OmQuestionReview[] }) {
  const subjects = useMemo(() => {
    const present = new Set(review.flatMap((row) => (row.subject ? [row.subject] : [])));
    const paper = MPCB.filter((id) => present.has(id));
    return paper.length ? paper : [...present];
  }, [review]);
  const [tab, setTab] = useState<Subject>(subjects[0] ?? "MATHEMATICS");
  const bySubject = useMemo(() => {
    const map = new Map<Subject, OmQuestionReview[]>();
    for (const row of review) {
      if (!row.subject) continue;
      map.set(row.subject, [...(map.get(row.subject) ?? []), row]);
    }
    return map;
  }, [review]);
  const overall = countsOf(review);

  if (subjects.length === 0) {
    return <p className="text-sm text-neutral-500">No questions to review on this test.</p>;
  }

  const active = subjects.includes(tab) ? tab : subjects[0];

  return (
    <div className="space-y-4">
      <StatStrip items={stripItems(overall)} />

      <div
        role="tablist"
        aria-label="Subject"
        className="grid grid-cols-2 gap-1.5 rounded-2xl border border-brand-100 bg-white p-1.5 sm:grid-cols-4"
      >
        {subjects.map((id) => {
          const selected = id === active;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                selected ? "bg-brand-900 text-white" : "text-brand-800 hover:bg-brand-50",
              )}
            >
              {TAB_LABELS[id]}
            </button>
          );
        })}
      </div>

      <SubjectPanel key={active} rows={bySubject.get(active) ?? []} />
    </div>
  );
}
