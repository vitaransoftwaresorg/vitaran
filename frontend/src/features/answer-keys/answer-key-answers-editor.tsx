"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SUBJECT_LABELS } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import type { AnswerKeyDetail, AnswerOption, KeyAnswer, KeyPattern, SubjectRange } from "@/types/answer-key";
import { formatKeyAnswer, isBonusKey, keyOptions, rewriteKeyAnswers } from "@/types/answer-key";
import { reparseAnswerKeyAction, saveAnswerKeyAnswersAction } from "./actions";

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

type AnswerKeyAnswersEditorProps = {
  answerKey: AnswerKeyDetail;
  /** School / teacher: look, don't edit. */
  readOnly?: boolean;
};

function questionsIn(range: SubjectRange) {
  return Array.from({ length: Math.max(0, range.to - range.from + 1) }, (_, index) => range.from + index);
}

function snapshot(
  answers: Record<string, KeyAnswer>,
  explanations: Record<string, string>,
  ranges: SubjectRange[],
  pattern: KeyPattern,
) {
  return JSON.stringify({ answers, explanations, ranges, pattern });
}

export function AnswerKeyAnswersEditor({ answerKey, readOnly = false }: AnswerKeyAnswersEditorProps) {
  const [saving, startSaving] = useTransition();
  const [parsing, startParsing] = useTransition();
  const [answers, setAnswers] = useState<Record<string, KeyAnswer>>(() => answerKey.answers);
  const [explanations, setExplanations] = useState<Record<string, string>>(() => answerKey.explanations);
  const [ranges, setRanges] = useState<SubjectRange[]>(() => answerKey.subjectRanges);
  const [pattern, setPattern] = useState<KeyPattern>(() => answerKey.pattern ?? "MAINS");
  const [baseline, setBaseline] = useState(() =>
    snapshot(answerKey.answers, answerKey.explanations, answerKey.subjectRanges, answerKey.pattern ?? "MAINS"),
  );

  const [filter, setFilter] = useState<"all" | "filled" | "missing">("all");
  const [printedAnswers, setPrintedAnswers] = useState(() => answerKey.printedAnswers ?? {});
  const [printedExplanations, setPrintedExplanations] = useState(
    () => answerKey.printedExplanations ?? {},
  );

  const dirty = useMemo(
    () => snapshot(answers, explanations, ranges, pattern) !== baseline,
    [answers, explanations, ranges, pattern, baseline],
  );
  const totalQuestions = ranges.reduce((sum, range) => sum + Math.max(0, range.to - range.from + 1), 0);
  const answerCount = Object.keys(answers).length;
  const missingCount = Math.max(0, totalQuestions - answerCount);
  const paper = ranges.map((range) => SUBJECT_LABELS[range.subject][0]).join("") || "—";
  const pending = saving || parsing;

  const visibleQuestions = (range: SubjectRange) =>
    questionsIn(range).filter((question) => {
      const filled = Boolean(answers[String(question)]);
      if (filter === "filled") return filled;
      if (filter === "missing") return !filled;
      return true;
    });

  function save() {
    if (!dirty) return;
    startSaving(async () => {
      try {
        const saved = await saveAnswerKeyAnswersAction(answerKey.id, {
          answers,
          explanations,
          printedAnswers,
          subjectRanges: ranges,
          pattern,
        });
        setAnswers(saved.answers);
        setExplanations(saved.explanations);
        setPrintedAnswers(saved.printedAnswers ?? {});
        setPrintedExplanations(saved.printedExplanations ?? {});
        setRanges(saved.subjectRanges);
        setPattern(saved.pattern ?? pattern);
        setBaseline(snapshot(saved.answers, saved.explanations, saved.subjectRanges, saved.pattern ?? pattern));
        toast.success("Saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save answers");
      }
    });
  }

  function reparse() {
    startParsing(async () => {
      try {
        const parsed = await reparseAnswerKeyAction(answerKey.id);
        setAnswers(parsed.answers);
        setPrintedAnswers(parsed.printedAnswers ?? parsed.answers);
        setPrintedExplanations(parsed.printedExplanations ?? {});
        setExplanations(parsed.explanations);
        setRanges(parsed.subjectRanges);
        if (parsed.pattern) {
          setPattern(parsed.pattern);
          setAnswers(rewriteKeyAnswers(parsed.answers, parsed.pattern));
        }
        setFilter("all");
        toast.success(
          `Read ${parsed.answerCount} answers from the PDF KEY. Change only the options school reported, then save.`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not parse this PDF");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            Test ID {answerKey.testId} · {paper} · {pattern === "ADVANCED" ? "Advanced" : "Mains"} (
            {ranges.map((range) => `${range.from}–${range.to}`).join(", ") || "no ranges yet"})
          </p>
          <p className="text-xs text-neutral-500">
            {readOnly
              ? "View only. Ask admin to change an option or explanation."
              : pattern === "ADVANCED"
                ? "Advanced: pick every correct option. Full 4 only when all are selected; otherwise +1 each. B/C is mains (either = 4)."
                : "Mains: one option, or two like B/C (either = 4). Add = 4 if the student bubbles any option."}
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
              {(["MAINS", "ADVANCED"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setPattern(id);
                    setAnswers((current) => rewriteKeyAnswers(current, id));
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[11px] font-bold",
                    pattern === id ? "bg-brand-900 text-white" : "text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  {id === "ADVANCED" ? "Advanced" : "Mains"}
                </button>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={reparse} disabled={pending}>
              {parsing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {parsing ? "Reading PDF…" : "Re-parse PDF"}
            </Button>
            <Button type="button" onClick={save} disabled={pending || !dirty}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save answers
            </Button>
          </div>
        )}
      </div>

      {totalQuestions > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Filter answers">
          {(
            [
              ["all", `All ${totalQuestions}`],
              ["filled", `Filled ${answerCount}`],
              ["missing", `Missing ${missingCount}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold",
                filter === id
                  ? "border-brand-900 bg-brand-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {ranges.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          {readOnly ? "No answers published for this test yet." : "No answers stored yet. Re-parse the PDF or fill them in."}
        </p>
      ) : (
        ranges.map((range) => {
          const shown = visibleQuestions(range);
          if (shown.length === 0) return null;
          return (
          <section
            key={`${range.subject}-${range.from}`}
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
          >
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="text-sm font-bold text-neutral-900">
                {SUBJECT_LABELS[range.subject]} · Q{range.from}–{range.to} · {range.maxMarks} marks
              </h2>
            </header>
            <ol className="divide-y divide-neutral-100">
              {shown.map((question) => {
                const key = String(question);
                const missing = !answers[key];
                return (
                  <li
                    key={question}
                    className={cn(
                      "grid gap-3 px-4 py-3 md:grid-cols-[4.5rem_auto_minmax(0,1fr)] md:items-start",
                      missing && "bg-amber-50/70",
                    )}
                  >
                    <p className="pt-1 text-sm font-bold text-neutral-700 tabular-nums">Q{question}</p>
                    <div className="flex flex-wrap gap-1">
                      {OPTIONS.map((option) => {
                        const selected = keyOptions(answers[key]).includes(option);
                        return (
                          <button
                            key={option}
                            type="button"
                            disabled={pending || readOnly}
                            onClick={() => {
                              if (readOnly) return;
                              setAnswers((current) => {
                                const picked = new Set(keyOptions(current[key]));
                                if (picked.has(option)) picked.delete(option);
                                else picked.add(option);
                                const next = { ...current };
                                if (picked.size === 0) delete next[key];
                                else next[key] = formatKeyAnswer([...picked] as AnswerOption[], pattern);
                                return next;
                              });
                            }}
                            className={cn(
                              "size-8 rounded-md text-xs font-bold",
                              selected
                                ? "bg-brand-900 text-white"
                                : "border border-neutral-200 bg-white text-neutral-700",
                              !readOnly && !selected && "hover:bg-neutral-50",
                              readOnly && "cursor-default",
                            )}
                          >
                            {option}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        disabled={pending || readOnly}
                        onClick={() => {
                          if (readOnly) return;
                          setAnswers((current) =>
                            isBonusKey(current[key])
                              ? (() => {
                                  const next = { ...current };
                                  delete next[key];
                                  return next;
                                })()
                              : { ...current, [key]: "ADD" },
                          );
                        }}
                        className={cn(
                          "h-8 rounded-md px-2 text-[11px] font-bold",
                          isBonusKey(answers[key])
                            ? "bg-sky-700 text-white"
                            : "border border-neutral-200 bg-white text-neutral-700",
                          !readOnly && !isBonusKey(answers[key]) && "hover:bg-neutral-50",
                          readOnly && "cursor-default",
                        )}
                      >
                        Add
                      </button>
                    </div>
                    {readOnly ? (
                      <p className="whitespace-pre-wrap text-sm text-neutral-700">
                        {explanations[key] || <span className="text-neutral-400">No explanation</span>}
                      </p>
                    ) : (
                      <Textarea
                        value={explanations[key] ?? ""}
                        disabled={pending}
                        rows={2}
                        placeholder="Explanation"
                        onChange={(event) =>
                          setExplanations((current) => ({ ...current, [key]: event.target.value }))
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
          );
        })
      )}
    </div>
  );
}
