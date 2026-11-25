"use client";

import { KeyRound } from "lucide-react";
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

  const hasExtra = marked.some((option) => !wanted.includes(option));
  if (hasExtra) return "wrong";

  if (mode === "normal") return "correct";

  const hit = wanted.filter((option) => marked.includes(option)).length;
  if (hit === wanted.length) return "correct";
  if (hit > 0) return "partial";
  return "wrong";
}

function toneClass(tone: AnswerTone) {
  if (tone === "correct") return "text-emerald-700";
  if (tone === "partial") return "text-yellow-700";
  if (tone === "wrong") return "text-red-700";
  if (tone === "blank") return "text-amber-700";
  return "text-neutral-900";
}

type ReadVsKeyTableProps = {
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  keyAnswers?: Record<string, string>;
  keyTypeRanges?: KeyTypeRange[];
  ranges?: Array<{ from: number; to: number }>;
  className?: string;
};

/** Integrated table: Sl No · Key · Response (repeated across columns). */
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
  /** How many Sl No / Key / Response groups sit side by side. */
  const groups = 4;
  const questions = Array.from({ length: 100 }, (_, index) => index + 1).filter(onPaper);
  const rows = Math.max(1, Math.ceil(Math.max(questions.length, 1) / groups));
  const cellAt = (row: number, group: number) => {
    const index = group * rows + row;
    if (index >= questions.length) return null;
    return questions[index]!;
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-neutral-200 bg-white", className)}>
      <header className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2.5">
        <KeyRound className="size-4 shrink-0 text-brand-800" strokeWidth={2.25} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-neutral-900">Answer key and response</p>
          <p className="text-[11px] text-neutral-500">
            {showPartial
              ? "Green = correct, yellow = partial, red = wrong, amber = blank."
              : "Green = correct, red = wrong, amber = blank."}
          </p>
        </div>
      </header>
      <div data-table-scroll className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-[11px] sm:text-sm">
          <thead>
            <tr className="bg-neutral-50 text-[10px] font-semibold tracking-wide text-neutral-600 uppercase sm:text-xs">
              {Array.from({ length: groups }, (_, group) => (
                <FragmentHead key={group} showDivider={group > 0} />
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row} className="odd:bg-white even:bg-neutral-50/40">
                {Array.from({ length: groups }, (_, group) => {
                  const question = cellAt(row, group);
                  if (question == null) {
                    return (
                      <FragmentEmpty key={group} showDivider={group > 0} />
                    );
                  }
                  const marked = answers[String(question)] ?? [];
                  const expected = keyAnswers?.[String(question)];
                  const mode = keyTypeForQuestion(keyTypeRanges, question);
                  const tone = answerTone(marked, expected, mode);
                  const keyLabel =
                    !expected || expected === "ADD" ? "—" : expected.replaceAll("/", "");
                  const responseLabel = marked.length === 0 ? "—" : marked.join("");
                  return (
                    <FragmentRow
                      key={group}
                      showDivider={group > 0}
                      question={question}
                      keyLabel={keyLabel}
                      responseLabel={responseLabel}
                      tone={tone}
                    />
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

function FragmentHead({ showDivider }: { showDivider: boolean }) {
  return (
    <>
      <th
        className={cn(
          "border border-neutral-200 px-1.5 py-1.5 text-center font-semibold sm:px-2",
          showDivider && "border-l-2 border-l-neutral-300",
        )}
      >
        Sl No
      </th>
      <th className="border border-neutral-200 px-1.5 py-1.5 text-center font-semibold sm:px-2">
        Key
      </th>
      <th className="border border-neutral-200 px-1.5 py-1.5 text-center font-semibold sm:px-2">
        Response
      </th>
    </>
  );
}

function FragmentEmpty({ showDivider }: { showDivider: boolean }) {
  return (
    <>
      <td
        className={cn(
          "border border-neutral-200 px-1.5 py-1 sm:px-2 sm:py-1.5",
          showDivider && "border-l-2 border-l-neutral-300",
        )}
      />
      <td className="border border-neutral-200 px-1.5 py-1 sm:px-2 sm:py-1.5" />
      <td className="border border-neutral-200 px-1.5 py-1 sm:px-2 sm:py-1.5" />
    </>
  );
}

function FragmentRow({
  showDivider,
  question,
  keyLabel,
  responseLabel,
  tone,
}: {
  showDivider: boolean;
  question: number;
  keyLabel: string;
  responseLabel: string;
  tone: AnswerTone;
}) {
  const color = toneClass(tone);
  return (
    <>
      <td
        className={cn(
          "border border-neutral-200 px-1.5 py-1 text-center font-semibold text-neutral-600 tabular-nums sm:px-2 sm:py-1.5",
          showDivider && "border-l-2 border-l-neutral-300",
        )}
      >
        {question}
      </td>
      <td
        className={cn(
          "border border-neutral-200 px-1.5 py-1 text-center font-bold tabular-nums sm:px-2 sm:py-1.5",
          color,
        )}
      >
        {keyLabel}
      </td>
      <td
        className={cn(
          "border border-neutral-200 px-1.5 py-1 text-center font-bold tabular-nums sm:px-2 sm:py-1.5",
          color,
        )}
      >
        {responseLabel}
      </td>
    </>
  );
}
