"use client";

import { Fragment } from "react";
import { MessageSquareWarning } from "lucide-react";
import { subjectLabel } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import type {
  AnswerKeyDetail,
  AnswerOption,
  KeyAnswer,
  SubjectRange,
} from "@/types/answer-key";
import { isBonusKey, keyOptions } from "@/types/answer-key";
import type { AnswerKeyObjection } from "@/types/answer-key-objection";
import { objectionImageHref } from "./constants";
import { ObjectionPhoto } from "./objection-photo";

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

type AnswerKeyPortalViewProps = {
  answerKey: AnswerKeyDetail;
  role: "school" | "teacher";
  objections: AnswerKeyObjection[];
  onRaiseObjection: (questionNumber: number) => void;
};

function questionsIn(range: SubjectRange) {
  return Array.from(
    { length: Math.max(0, range.to - range.from + 1) },
    (_, index) => range.from + index,
  );
}

function countOf(range: SubjectRange) {
  return Math.max(0, range.to - range.from + 1);
}

function allQuestions(ranges: SubjectRange[]) {
  const set = new Set<number>();
  for (const range of ranges) {
    for (const question of questionsIn(range)) set.add(question);
  }
  return [...set].sort((a, b) => a - b);
}

function claimLabel(proposed: AnswerKeyObjection["proposedAnswer"]) {
  if (!proposed) return null;
  if (proposed === "NONE") return "No right answer";
  return proposed;
}

function StatusChip({ status }: { status: AnswerKeyObjection["status"] }) {
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

function QuestionObjectionCard({
  objection,
  role,
}: {
  objection: AnswerKeyObjection;
  role: "school" | "teacher";
}) {
  const claim = claimLabel(objection.proposedAnswer);
  const tone =
    objection.status === "OPEN"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : objection.status === "RESOLVED"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : "border-red-200 bg-red-50 text-red-950";

  return (
    <div className={cn("rounded-md border px-2.5 py-2 text-xs", tone)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusChip status={objection.status} />
        {claim ? (
          <span>
            You claim <span className="font-semibold">{claim}</span>
          </span>
        ) : (
          <span className="font-semibold">Your objection</span>
        )}
      </div>
      <p className="mt-1 text-sm leading-relaxed break-words">{objection.message}</p>
      {objection.hasImage ? <ObjectionPhoto href={objectionImageHref(role, objection.id)} /> : null}
      {objection.resolutionNote ? (
        <p className="mt-1.5 border-t border-black/5 pt-1.5 text-[11px] leading-relaxed break-words opacity-90">
          <span className="font-semibold">Vitaran Learning:</span>{" "}
          {objection.resolutionNote}
        </p>
      ) : null}
    </div>
  );
}

const DESKTOP_ROWS = 10;

/** Column-wise: Q1–Q10 down col 1, Q11–Q20 down col 2, … */
function columnWiseGrid(questions: number[], rows: number) {
  const columns = Math.max(1, Math.ceil(questions.length / rows));
  const grid: Array<Array<number | null>> = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null),
  );
  questions.forEach((question, index) => {
    const col = Math.floor(index / rows);
    const row = index % rows;
    grid[row]![col] = question;
  });
  return { grid, columns };
}

function KeyCell({
  question,
  answer,
}: {
  question: number;
  answer?: KeyAnswer;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5">
      <span className="text-xs font-bold text-neutral-700 tabular-nums">{question}</span>
      <span className="text-sm font-bold text-neutral-950 tabular-nums">
        {answer ?? <span className="text-amber-700">—</span>}
      </span>
    </div>
  );
}

function AnswerKeyTable({
  questions,
  answers,
}: {
  questions: number[];
  answers: Record<string, KeyAnswer>;
}) {
  const { grid, columns } = columnWiseGrid(questions, DESKTOP_ROWS);

  return (
    <section className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]">
      <header className="border-b border-brand-100 bg-brand-50/60 px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-bold text-brand-950">Answer key</h2>
        <p className="text-xs text-neutral-500">{questions.length} questions · options only</p>
      </header>

      {/* Mobile: compact 2-column cards, no horizontal scroll */}
      <div className="grid grid-cols-2 gap-1.5 p-3 sm:hidden">
        {questions.map((question) => (
          <KeyCell
            key={question}
            question={question}
            answer={answers[String(question)]}
          />
        ))}
      </div>

      {/* Desktop: column-wise table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              {Array.from({ length: columns }, (_, col) => (
                <Fragment key={col}>
                  <th className="px-3 py-2 w-12">Q</th>
                  <th className="px-3 py-2 w-14">Key</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-neutral-100 last:border-0">
                {row.map((question, colIndex) =>
                  question == null ? (
                    <Fragment key={`empty-${colIndex}`}>
                      <td className="border-r border-neutral-100 px-3 py-2" />
                      <td className="border-r border-neutral-100 px-3 py-2 last:border-r-0" />
                    </Fragment>
                  ) : (
                    <Fragment key={question}>
                      <td className="border-r border-neutral-100 px-3 py-2 font-bold text-neutral-800 tabular-nums">
                        {question}
                      </td>
                      <td className="border-r border-neutral-100 px-3 py-2 font-semibold text-neutral-950 tabular-nums last:border-r-0">
                        {answers[String(question)] ?? (
                          <span className="text-amber-700">—</span>
                        )}
                      </td>
                    </Fragment>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Read-only school/teacher display — not the admin edit form. */
export function AnswerKeyPortalView({
  answerKey,
  role,
  objections,
  onRaiseObjection,
}: AnswerKeyPortalViewProps) {
  const ranges =
    answerKey.subjectRanges.length > 0
      ? answerKey.subjectRanges
      : [{ subject: "MATHEMATICS", from: 1, to: 100, maxMarks: 0 }];

  /** One card per question: open first, otherwise the latest review. */
  const byQuestion = new Map<number, AnswerKeyObjection>();
  const sorted = [...objections].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  for (const row of sorted) {
    if (row.questionNumber == null) continue;
    const current = byQuestion.get(row.questionNumber);
    if (!current) {
      byQuestion.set(row.questionNumber, row);
      continue;
    }
    if (current.status !== "OPEN" && row.status === "OPEN") {
      byQuestion.set(row.questionNumber, row);
    }
  }

  const questions = allQuestions(ranges);

  if (Object.keys(answerKey.answers).length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500 sm:p-8">
        No answers published for this test yet.
      </p>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <AnswerKeyTable questions={questions} answers={answerKey.answers} />

      <div className="space-y-4 sm:space-y-5">
        <p className="text-sm font-bold text-neutral-900">Explanations & objections</p>
        {ranges.map((range) => (
          <section key={`${range.subject}-${range.from}`} className="space-y-2.5 sm:space-y-3">
            <header className="px-0.5">
              <h2 className="text-sm font-bold text-neutral-900">
                {subjectLabel(range.subject)} · {countOf(range)} questions
              </h2>
            </header>
            <ol className="space-y-2.5 sm:space-y-3">
              {questionsIn(range).map((question) => {
                const key = String(question);
                const answer = answerKey.answers[key];
                const explanation = answerKey.explanations[key]?.trim() || "";
                const objection = byQuestion.get(question);
                const hasOpen = objection?.status === "OPEN";
                const selected = keyOptions(answer);
                const bonus = isBonusKey(answer);

                return (
                  <li
                    key={question}
                    className="rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_2px_10px_-6px_rgb(25_28_95/0.18)] sm:p-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="min-w-10 text-sm font-bold text-neutral-800 tabular-nums">Q{question}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {OPTIONS.map((option) => {
                          const on = selected.includes(option);
                          return (
                            <span
                              key={option}
                              className={cn(
                                "inline-flex size-7 items-center justify-center rounded-md text-xs font-bold sm:size-8",
                                on
                                  ? "bg-brand-900 text-white"
                                  : "border border-neutral-200 bg-neutral-50 text-neutral-400",
                              )}
                            >
                              {option}
                            </span>
                          );
                        })}
                        {bonus ? (
                          <span className="inline-flex h-7 items-center rounded-md bg-sky-700 px-2 text-[11px] font-bold text-white sm:h-8">
                            ADD
                          </span>
                        ) : null}
                        {!answer ? (
                          <span className="text-xs font-semibold text-amber-700">Not set</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2.5 space-y-2">
                      <div className="rounded-md border border-neutral-100 bg-neutral-50/80 px-2.5 py-2">
                        <p className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                          Explanation
                        </p>
                        {explanation ? (
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed break-words text-neutral-700">
                            {explanation}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-neutral-400">No Explanation</p>
                        )}
                      </div>

                      {objection ? (
                        <QuestionObjectionCard objection={objection} role={role} />
                      ) : null}

                      <button
                        type="button"
                        onClick={() => onRaiseObjection(question)}
                        disabled={hasOpen}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-brand-200 bg-brand-50/60 px-3 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-40 sm:w-auto sm:border-0 sm:bg-transparent sm:px-2 sm:py-1.5 sm:justify-start"
                      >
                        <MessageSquareWarning className="size-3.5" strokeWidth={2} />
                        {hasOpen ? "Objection open" : "Raise objection"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
