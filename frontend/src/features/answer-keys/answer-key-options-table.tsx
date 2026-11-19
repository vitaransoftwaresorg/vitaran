"use client";

import { cn } from "@/lib/utils";
import type { KeyAnswer } from "@/types/answer-key";

/** Desktop/print density — same column count across school, teacher, public, and admin. */
export const ANSWER_KEY_TABLE_COLUMNS = 9;

type AnswerKeyOptionsTableProps = {
  questions: number[];
  answers: Record<string, KeyAnswer | string | undefined>;
  /** Hide the card chrome when embedded (e.g. inside another panel). */
  bare?: boolean;
  className?: string;
};

/**
 * Integrated Q→key table used everywhere answer options are shown.
 * Column-major fill (Q1 down col 1, next batch in col 2, …). One table; scrolls on small screens.
 */
export function AnswerKeyOptionsTable({
  questions,
  answers,
  bare = false,
  className,
}: AnswerKeyOptionsTableProps) {
  const columns = ANSWER_KEY_TABLE_COLUMNS;
  const rows = Math.max(1, Math.ceil(questions.length / columns));
  const cellAt = (row: number, col: number) => {
    const index = col * rows + row;
    if (index >= questions.length) return null;
    const question = questions[index]!;
    return { question, answer: answers[String(question)] };
  };

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, col) => {
                const cell = cellAt(row, col);
                return (
                  <td
                    key={col}
                    className="border border-neutral-300 px-2 py-1.5 text-center align-middle"
                  >
                    {cell ? (
                      <span className="inline-flex items-baseline justify-center gap-1.5 tabular-nums">
                        <span className="text-xs font-semibold text-neutral-500">{cell.question}</span>
                        <span className="text-sm font-bold text-neutral-950">
                          {cell.answer ?? <span className="text-amber-700">—</span>}
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
        <h2 className="text-sm font-bold text-brand-950">Answer key</h2>
        <p className="text-xs text-neutral-500">{questions.length} questions · options only</p>
      </header>
      {table}
    </section>
  );
}
