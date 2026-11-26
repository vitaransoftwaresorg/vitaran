"use client";

import { useSyncExternalStore } from "react";
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

/** Side-by-side Sl No/Key/Response groups — fewer on narrow screens so the table never scrolls sideways. */
function groupCountForWidth(width: number) {
  if (width < 420) return 2;
  if (width < 720) return 3;
  return 4;
}

function subscribeWidth(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function useTableGroups() {
  const width = useSyncExternalStore(
    subscribeWidth,
    () => (typeof window === "undefined" ? 1024 : window.innerWidth),
    () => 1024,
  );
  return groupCountForWidth(width);
}

type ReadVsKeyTableProps = {
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  keyAnswers?: Record<string, string>;
  keyTypeRanges?: KeyTypeRange[];
  ranges?: Array<{ from: number; to: number }>;
  className?: string;
};

/** Integrated table: Sl No · Key · Response — always fits the width (no sideways drag). */
export function ReadVsKeyTable({
  answers,
  keyAnswers,
  keyTypeRanges = [],
  ranges = [],
  className,
}: ReadVsKeyTableProps) {
  const showPartial = keyHasMcq(keyTypeRanges);
  const groups = useTableGroups();
  const onPaper = (question: number) =>
    ranges.length === 0 || ranges.some((range) => question >= range.from && question <= range.to);
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
      <div data-table-scroll className="w-full overflow-x-hidden">
        <table className="w-full table-fixed border-collapse text-[10px] sm:text-[11px] md:text-sm">
          <thead>
            <tr className="bg-neutral-50 text-[9px] font-semibold tracking-wide text-neutral-600 uppercase sm:text-[10px] md:text-xs">
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
          "w-[12%] border border-neutral-200 px-0.5 py-1 text-center font-semibold sm:px-1.5 sm:py-1.5",
          showDivider && "border-l-2 border-l-neutral-300",
        )}
      >
        <span className="sm:hidden">Sl</span>
        <span className="hidden sm:inline">Sl No</span>
      </th>
      <th className="w-[10%] border border-neutral-200 px-0.5 py-1 text-center font-semibold sm:px-1.5 sm:py-1.5">
        Key
      </th>
      <th className="w-[12%] border border-neutral-200 px-0.5 py-1 text-center font-semibold sm:px-1.5 sm:py-1.5">
        <span className="sm:hidden">Res</span>
        <span className="hidden sm:inline">Response</span>
      </th>
    </>
  );
}

function FragmentEmpty({ showDivider }: { showDivider: boolean }) {
  return (
    <>
      <td
        className={cn(
          "border border-neutral-200 px-0.5 py-0.5 sm:px-1.5 sm:py-1",
          showDivider && "border-l-2 border-l-neutral-300",
        )}
      />
      <td className="border border-neutral-200 px-0.5 py-0.5 sm:px-1.5 sm:py-1" />
      <td className="border border-neutral-200 px-0.5 py-0.5 sm:px-1.5 sm:py-1" />
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
          "border border-neutral-200 px-0.5 py-0.5 text-center font-semibold text-neutral-600 tabular-nums sm:px-1.5 sm:py-1",
          showDivider && "border-l-2 border-l-neutral-300",
        )}
      >
        {question}
      </td>
      <td
        className={cn(
          "border border-neutral-200 px-0.5 py-0.5 text-center font-bold break-all tabular-nums sm:px-1.5 sm:py-1",
          color,
        )}
      >
        {keyLabel}
      </td>
      <td
        className={cn(
          "border border-neutral-200 px-0.5 py-0.5 text-center font-bold break-all tabular-nums sm:px-1.5 sm:py-1",
          color,
        )}
      >
        {responseLabel}
      </td>
    </>
  );
}
