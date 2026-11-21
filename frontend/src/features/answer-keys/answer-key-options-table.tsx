"use client";

import { cn } from "@/lib/utils";
import type { KeyAnswer, KeyTypeRange } from "@/types/answer-key";
import { ANSWER_KEY_QUESTION_TYPES } from "@/types/answer-key";
import {
  ANSWER_KEY_TABLE_COLUMNS,
  answerKeyTableQuestion,
  answerKeyTableRows,
} from "./answer-key-table-layout";

export { ANSWER_KEY_TABLE_COLUMNS } from "./answer-key-table-layout";

type AnswerKeyOptionsTableProps = {
  questions: number[];
  answers: Record<string, KeyAnswer | string | undefined>;
  /** Hide the card chrome when embedded (e.g. inside another panel). */
  bare?: boolean;
  className?: string;
  correctMarks?: number;
  wrongMarks?: number;
  keyTypeRanges?: KeyTypeRange[];
};

function typeLabel(type: KeyTypeRange["type"]) {
  return ANSWER_KEY_QUESTION_TYPES.find((item) => item.value === type)?.label ?? type;
}

/**
 * Integrated Q→key table used everywhere answer options are shown.
 * Column-major fill (Q1 down col 1, next batch in col 2, …). One table; scrolls on small screens.
 */
export function AnswerKeyOptionsTable({
  questions,
  answers,
  bare = false,
  className,
  keyTypeRanges = [],
}: AnswerKeyOptionsTableProps) {
  const columns = ANSWER_KEY_TABLE_COLUMNS;
  const rows = answerKeyTableRows(questions.length);

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, col) => {
                const question = answerKeyTableQuestion(questions, row, col);
                const answer = question != null ? answers[String(question)] : undefined;
                return (
                  <td
                    key={col}
                    className="border border-neutral-300 px-2 py-1.5 text-center align-middle"
                  >
                    {question != null ? (
                      <span className="inline-flex items-baseline justify-center gap-1.5 tabular-nums">
                        <span className="text-xs font-semibold text-neutral-500">{question}</span>
                        <span className="text-sm font-bold text-neutral-950">
                          {answer ?? <span className="text-amber-700">—</span>}
                        </span>
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (bare) return <div className={className}>{table}</div>;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]",
        className,
      )}
    >
      <header className="border-b border-brand-100 bg-brand-50/60 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-brand-950">Answer key</h2>
            <p className="text-xs text-neutral-500">{questions.length} questions · options only</p>
          </div>
        </div>
        {keyTypeRanges.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-brand-200/80 bg-white">
            <p className="border-b border-brand-100 bg-brand-50/80 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              Configuration
            </p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-100 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                  <th className="px-3 py-1.5 font-semibold">Questions</th>
                  <th className="px-3 py-1.5 font-semibold">Type</th>
                  <th className="px-3 py-1.5 font-semibold tabular-nums">Correct</th>
                  <th className="px-3 py-1.5 font-semibold tabular-nums">Wrong</th>
                </tr>
              </thead>
              <tbody>
                {keyTypeRanges.map((range) => (
                  <tr
                    key={`${range.from}-${range.to}-${range.type}-${range.correctMarks}-${range.wrongMarks}`}
                    className="border-b border-brand-50 last:border-0"
                  >
                    <td className="px-3 py-1.5 font-semibold tabular-nums text-brand-950">
                      {range.from === range.to ? `Q${range.from}` : `Q${range.from}–${range.to}`}
                    </td>
                    <td className="px-3 py-1.5 font-medium text-neutral-800">{typeLabel(range.type)}</td>
                    <td className="px-3 py-1.5 font-semibold tabular-nums text-emerald-700">
                      +{range.correctMarks}
                    </td>
                    <td className="px-3 py-1.5 font-semibold tabular-nums text-neutral-700">
                      −{range.wrongMarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </header>
      {table}
    </section>
  );
}
