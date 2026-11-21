"use client";

import { cn } from "@/lib/utils";
import {
  keyTypeForQuestion,
  type KeyTypeRange,
} from "@/types/answer-key";

type AnswerTone = "correct" | "wrong" | "partial" | "blank" | "plain";

/** Partial credit only when the key has at least one MCQ-typed range. */
export function keyHasMcq(keyTypeRanges?: KeyTypeRange[] | null) {
  return (keyTypeRanges ?? []).some((range) => range.type === "mcq");
}

/** @deprecated Prefer keyHasMcq(keyTypeRanges) — multi-option answers can be Normal too. */
export function keyHasMultiCorrect(
  keyAnswers?: Record<string, string>,
  keyTypeRanges?: KeyTypeRange[] | null,
) {
  if (keyTypeRanges != null) return keyHasMcq(keyTypeRanges);
  if (!keyAnswers) return false;
  return Object.values(keyAnswers).some((answer) => {
    if (!answer || answer === "ADD") return false;
    const options = answer
      .split("/")
      .filter((part) => part === "A" || part === "B" || part === "C" || part === "D");
    return options.length > 1;
  });
}

function answerTone(
  marked: Array<"A" | "B" | "C" | "D">,
  expected: string | undefined,
  mode: "normal" | "mcq",
): AnswerTone {
  if (!expected) return marked.length === 0 ? "blank" : "plain";
  if (marked.length === 0) return "blank";
  if (expected === "ADD") return "correct";
  const wanted = expected
    .split("/")
    .filter((part) => part === "A" || part === "B" || part === "C" || part === "D");
  if (wanted.length === 0) return "plain";

  // Any wrong (non-key) option → 0 for Normal and MCQ.
  const hasExtra = marked.some((option) => !wanted.includes(option));
  if (hasExtra) return "wrong";

  // Normal: any non-empty subset of key options → full credit.
  if (mode === "normal") return "correct";

  // MCQ: equal partial per key option marked.
  const hit = wanted.filter((option) => marked.includes(option)).length;
  if (hit === wanted.length) return "correct";
  if (hit > 0) return "partial";
  return "wrong";
}

type ReadVsKeyTableProps = {
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  keyAnswers?: Record<string, string>;
  keyTypeRanges?: KeyTypeRange[];
  ranges?: Array<{ from: number; to: number }>;
  className?: string;
};

/** Same 9-column integrated table as OMR review / portal answer keys (column-major). */
export function ReadVsKeyTable({
  answers,
  keyAnswers,
  keyTypeRanges = [],
  ranges = [],
  className,
}: ReadVsKeyTableProps) {
  const showPartial = keyHasMcq(keyTypeRanges);
  const onPaper = (question: number) =>
    ranges.length === 0 || ranges.some((range) => question >= range.from && question <= range.to);
  const columns = 9;
  const questions = Array.from({ length: 100 }, (_, index) => index + 1).filter(onPaper);
  const rows = Math.max(1, Math.ceil(Math.max(questions.length, 1) / columns));
  const cellAt = (row: number, col: number) => {
    const index = col * rows + row;
    if (index >= questions.length) return null;
    return questions[index]!;
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-brand-200 bg-white", className)}>
      <header className="border-b border-brand-100 bg-brand-50/60 px-3 py-2.5">
        <p className="text-sm font-bold text-brand-950">Read vs answer key</p>
        <p className="text-xs text-neutral-500">
          {showPartial
            ? "Normal: any subset of correct options = full; any wrong option = 0. MCQ: equal partial; any wrong = 0."
            : "Green = correct, red = wrong, amber = blank. Subset of correct options = full; any wrong option = 0."}
        </p>
      </header>
      <div data-table-scroll className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px] sm:text-sm">
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row}>
                {Array.from({ length: columns }, (_, col) => {
                  const question = cellAt(row, col);
                  if (question == null) {
                    return <td key={col} className="border border-neutral-300 px-1 py-1 sm:px-2 sm:py-1.5" />;
                  }
                  const marked = answers[String(question)] ?? [];
                  const expected = keyAnswers?.[String(question)];
                  const mode = keyTypeForQuestion(keyTypeRanges, question);
                  const tone = answerTone(marked, expected, mode);
                  const toneClass =
                    tone === "correct"
                      ? "text-emerald-800"
                      : tone === "partial"
                        ? "text-yellow-700"
                        : tone === "wrong"
                          ? "text-red-800"
                          : tone === "blank"
                            ? "text-amber-800"
                            : "text-neutral-900";
                  return (
                    <td
                      key={col}
                      className={cn(
                        "border border-neutral-300 px-1 py-1 text-center align-middle tabular-nums sm:px-2 sm:py-1.5",
                        toneClass,
                      )}
                    >
                      <span className="inline-flex items-baseline justify-center gap-1 sm:gap-1.5">
                        <span className="text-[10px] font-semibold opacity-70 sm:text-xs">{question}</span>
                        <span className="text-xs font-bold sm:text-sm">
                          {tone === "blank" ? "—" : marked.join("")}
                        </span>
                        {(tone === "wrong" || tone === "partial") && expected ? (
                          <span className="text-[9px] font-semibold text-neutral-400 sm:text-[10px]">
                            {expected}
                          </span>
                        ) : null}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
