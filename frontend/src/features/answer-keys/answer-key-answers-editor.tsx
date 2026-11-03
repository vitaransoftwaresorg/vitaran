"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { subjectLabel } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import type { AnswerKeyDetail, AnswerOption, KeyAnswer, SubjectRange } from "@/types/answer-key";
import { isBonusKey, keyOptions } from "@/types/answer-key";
import { saveAnswerKeyAnswersAction } from "./actions";
import { enteredTestId } from "./test-id";

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];
const DEFAULT_CORRECT_MARKS = 1;
const MAX_SUBJECT_QUESTIONS = 100;
const MAX_MARK_VALUE = 100;

type AnswerKeyAnswersEditorProps = {
  answerKey: AnswerKeyDetail;
  /** Program · Test · Class, shown on the same row as Save. */
  heading?: string;
  /** School / teacher: look, don't edit. */
  readOnly?: boolean;
};

function questionsIn(range: SubjectRange) {
  return Array.from({ length: Math.max(0, range.to - range.from + 1) }, (_, index) => range.from + index);
}

function countOf(range: SubjectRange) {
  return Math.max(0, range.to - range.from + 1);
}

function snapshot(
  answers: Record<string, KeyAnswer>,
  explanations: Record<string, string>,
  ranges: SubjectRange[],
  testId: string,
  correctMarks: number,
  wrongMarks: number,
) {
  return JSON.stringify({ answers, explanations, ranges, testId, correctMarks, wrongMarks });
}

function rangesFromCounts(
  rows: Array<{ subject: string; count: number }>,
  correctMarks: number,
): SubjectRange[] {
  let from = 1;
  return rows
    .filter((row) => row.count > 0)
    .map((row) => {
      const to = from + row.count - 1;
      const range = { subject: row.subject, from, to, maxMarks: row.count * correctMarks };
      from = to + 1;
      return range;
    });
}

function remapBySubject<T>(
  previous: Record<string, T>,
  fromRanges: SubjectRange[],
  toRanges: SubjectRange[],
) {
  const next: Record<string, T> = {};
  for (const oldRange of fromRanges) {
    const newRange = toRanges.find((range) => range.subject === oldRange.subject);
    if (!newRange) continue;
    const oldQuestions = questionsIn(oldRange);
    const newQuestions = questionsIn(newRange);
    oldQuestions.forEach((oldQuestion, index) => {
      const value = previous[String(oldQuestion)];
      if (value === undefined || index >= newQuestions.length) return;
      next[String(newQuestions[index]!)] = value;
    });
  }
  return next;
}

const FALLBACK_RANGES: SubjectRange[] = [
  { subject: "MATHEMATICS", from: 1, to: 100, maxMarks: 400 },
];

function parseMark(value: string, fallback: number) {
  const next = Number.parseInt(value, 10);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(MAX_MARK_VALUE, Math.max(0, next));
}

export function AnswerKeyAnswersEditor({ answerKey, heading, readOnly = false }: AnswerKeyAnswersEditorProps) {
  const [saving, startSaving] = useTransition();
  const initialRanges =
    answerKey.subjectRanges.length > 0 ? answerKey.subjectRanges : FALLBACK_RANGES;
  const [answers, setAnswers] = useState<Record<string, KeyAnswer>>(() => answerKey.answers);
  const [explanations, setExplanations] = useState<Record<string, string>>(() => answerKey.explanations);
  const [testId, setTestId] = useState(() => enteredTestId(answerKey.testId));
  const [correctMarks, setCorrectMarks] = useState(
    () => answerKey.correctMarks ?? DEFAULT_CORRECT_MARKS,
  );
  const [wrongMarks, setWrongMarks] = useState(() => answerKey.wrongMarks ?? 0);
  const [counts, setCounts] = useState(() =>
    initialRanges.map((range) => ({ subject: range.subject, count: countOf(range) })),
  );
  const ranges = useMemo(() => rangesFromCounts(counts, correctMarks), [counts, correctMarks]);
  const [baseline, setBaseline] = useState(() =>
    snapshot(
      answerKey.answers,
      answerKey.explanations,
      initialRanges,
      enteredTestId(answerKey.testId),
      answerKey.correctMarks ?? DEFAULT_CORRECT_MARKS,
      answerKey.wrongMarks ?? 0,
    ),
  );
  const [printedAnswers, setPrintedAnswers] = useState(() => answerKey.printedAnswers ?? {});

  const dirty = useMemo(
    () => snapshot(answers, explanations, ranges, testId.trim(), correctMarks, wrongMarks) !== baseline,
    [answers, explanations, ranges, testId, correctMarks, wrongMarks, baseline],
  );
  const totalQuestions = ranges.reduce((sum, range) => sum + countOf(range), 0);
  const incomplete = ranges.flatMap((range) => questionsIn(range).filter((question) => !answers[String(question)]));
  const pending = saving;

  function setSubjectCount(subject: string, count: number) {
    const nextCount = Math.min(MAX_SUBJECT_QUESTIONS, Math.max(0, Number.isFinite(count) ? count : 0));
    const nextCounts = counts.map((row) =>
      row.subject === subject ? { ...row, count: nextCount } : row,
    );
    const nextRanges = rangesFromCounts(nextCounts, correctMarks);
    setAnswers((current) => remapBySubject(current, ranges, nextRanges));
    setExplanations((current) => remapBySubject(current, ranges, nextRanges));
    setCounts(nextCounts);
  }

  function save() {
    if (!dirty) return;
    const nextTestId = testId.trim();
    if (!nextTestId) {
      toast.error("Enter the test ID");
      return;
    }
    startSaving(async () => {
      try {
        const saved = await saveAnswerKeyAnswersAction(answerKey.id, {
          answers,
          explanations,
          printedAnswers,
          subjectRanges: ranges,
          testId: nextTestId,
          correctMarks,
          wrongMarks,
        });
        setAnswers(saved.answers);
        setExplanations(saved.explanations);
        setPrintedAnswers(saved.printedAnswers ?? {});
        setTestId(enteredTestId(saved.testId));
        setCorrectMarks(saved.correctMarks ?? DEFAULT_CORRECT_MARKS);
        setWrongMarks(saved.wrongMarks ?? 0);
        setCounts(
          saved.subjectRanges.map((range) => ({ subject: range.subject, count: countOf(range) })),
        );
        setBaseline(
          snapshot(
            saved.answers,
            saved.explanations,
            saved.subjectRanges,
            enteredTestId(saved.testId),
            saved.correctMarks ?? DEFAULT_CORRECT_MARKS,
            saved.wrongMarks ?? 0,
          ),
        );
        toast.success("Saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save answers");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {heading ? (
          <h1 className="text-base font-bold text-brand-900 sm:text-lg">{heading}</h1>
        ) : null}
        <p className="text-sm font-medium text-neutral-500">{totalQuestions} questions</p>
        {incomplete.length > 0 ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {incomplete.length} incomplete
          </p>
        ) : null}
        {!readOnly && (
          <Button type="button" className="ml-auto" onClick={save} disabled={pending || !dirty || !testId.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase">
              <th className="px-4 py-2 font-medium">Test ID</th>
              <th className="px-4 py-2 font-medium">Correct answer</th>
              <th className="px-4 py-2 font-medium">Wrong answer</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3">
                <Input
                  value={testId}
                  disabled={pending || readOnly}
                  maxLength={64}
                  placeholder="Enter test ID"
                  aria-label="Test ID"
                  className="h-9 w-full max-w-56 bg-white font-mono text-sm"
                  onChange={(event) => setTestId(event.currentTarget.value)}
                />
              </td>
              <td className="px-4 py-3">
                <Input
                  type="number"
                  min={0}
                  max={MAX_MARK_VALUE}
                  value={correctMarks}
                  disabled={pending || readOnly}
                  aria-label="Marks for a correct answer"
                  className="h-9 w-20 bg-white tabular-nums"
                  onChange={(event) => setCorrectMarks(parseMark(event.currentTarget.value, correctMarks))}
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-500">−</span>
                  <Input
                    type="number"
                    min={0}
                    max={MAX_MARK_VALUE}
                    value={wrongMarks}
                    disabled={pending || readOnly}
                    aria-label="Negative marks for a wrong answer"
                    className="h-9 w-20 bg-white tabular-nums"
                    onChange={(event) => setWrongMarks(parseMark(event.currentTarget.value, wrongMarks))}
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!readOnly && counts.length > 0 ? (
        <div className="flex flex-wrap gap-3 rounded-2xl border border-brand-100 bg-white p-4">
          {counts.map((row) => (
            <label key={row.subject} className="flex min-w-40 flex-1 items-center gap-2">
              <span className="text-sm font-semibold text-neutral-800">{subjectLabel(row.subject)}</span>
              <Input
                type="number"
                min={0}
                max={MAX_SUBJECT_QUESTIONS}
                value={row.count}
                disabled={pending}
                aria-label={`${subjectLabel(row.subject)} questions`}
                className="h-9 w-20 bg-white tabular-nums"
                onChange={(event) => setSubjectCount(row.subject, Number.parseInt(event.currentTarget.value, 10))}
              />
            </label>
          ))}
        </div>
      ) : null}

      {ranges.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          {readOnly ? "No answers published for this test yet." : "Set questions for each subject, then fill the key."}
        </p>
      ) : (
        ranges.map((range) => (
          <section
            key={`${range.subject}-${range.from}`}
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
          >
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="text-sm font-bold text-neutral-900">
                {subjectLabel(range.subject)} · {countOf(range)} questions
              </h2>
            </header>
            <ol className="divide-y divide-neutral-100">
              {questionsIn(range).map((question) => {
                const key = String(question);
                const missing = !answers[key];
                return (
                  <li
                    key={question}
                    className={cn(
                      "grid gap-3 px-4 py-3 md:grid-cols-[4.5rem_auto_minmax(0,1fr)] md:items-start",
                      missing && "bg-red-50",
                    )}
                  >
                    <div>
                      <p className="text-sm font-bold text-neutral-700 tabular-nums">Q{question}</p>
                      {missing ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-red-700">Incomplete</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
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
                                else next[key] = [...picked].join("/") as KeyAnswer;
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
                        title={`Bonus: ${correctMarks} marks if the student attempted this question`}
                        className={cn(
                          "h-8 rounded-md px-2 text-[11px] font-bold",
                          isBonusKey(answers[key])
                            ? "bg-sky-700 text-white"
                            : "border border-neutral-200 bg-white text-neutral-700",
                          !readOnly && !isBonusKey(answers[key]) && "hover:bg-neutral-50",
                          readOnly && "cursor-default",
                        )}
                      >
                        ADD
                      </button>
                    </div>
                    {readOnly ? (
                      <p className="w-full min-w-0 whitespace-pre-wrap text-sm text-neutral-700">
                        {explanations[key] || <span className="text-neutral-400">No explanation</span>}
                      </p>
                    ) : (
                      <Textarea
                        value={explanations[key] ?? ""}
                        disabled={pending}
                        rows={2}
                        placeholder="Explanation"
                        className="w-full min-w-0"
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
        ))
      )}
    </div>
  );
}
