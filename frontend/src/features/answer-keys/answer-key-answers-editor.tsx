"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCircle, Loader2, Minus, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { subjectLabel } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import type { AnswerKeyDetail, AnswerOption, KeyAnswer, SubjectRange } from "@/types/answer-key";
import { isBonusKey, isMultiKey, joinKeyOptions, keyOptions } from "@/types/answer-key";
import { saveAnswerKeyAnswersAction } from "./actions";
import { enteredTestId, TEST_ID_LENGTH, TEST_ID_MESSAGE, TEST_ID_PATTERN, testIdDigits } from "./test-id";
import { TestIdStatus, useTestIdCheck } from "./test-id-status";

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];
const DEFAULT_CORRECT_MARKS = 1;
const MAX_SUBJECT_QUESTIONS = 100;
const MAX_MARK_VALUE = 100;

type QuestionMode = "non_mcq" | "mcq";

const MODE_ITEMS = [
  { value: "non_mcq", label: "Non MCQ" },
  { value: "mcq", label: "MCQ" },
] as const;

function inferQuestionMode(answers: Record<string, KeyAnswer>): QuestionMode | "" {
  const values = Object.values(answers);
  if (values.length === 0) return "";
  return values.some(isMultiKey) ? "mcq" : "non_mcq";
}

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

function clampMark(value: number) {
  return Math.min(MAX_MARK_VALUE, Math.max(0, value));
}

/** Number field with − / + for correct and wrong mark values. */
function MarksStepper({
  value,
  onChange,
  disabled,
  ariaLabel,
  prefix,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  ariaLabel: string;
  prefix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {prefix ? <span className="text-sm font-semibold text-neutral-500">{prefix}</span> : null}
      <div className="inline-flex h-9 items-stretch overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs">
        <button
          type="button"
          aria-label={`Decrease ${ariaLabel}`}
          disabled={disabled || value <= 0}
          className="inline-flex w-8 items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onChange(clampMark(value - 1))}
        >
          <Minus className="size-3.5" />
        </button>
        <span
          aria-label={ariaLabel}
          className="inline-flex h-full w-14 items-center justify-center border-x border-neutral-200 text-sm font-semibold tabular-nums text-neutral-950"
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${ariaLabel}`}
          disabled={disabled || value >= MAX_MARK_VALUE}
          className="inline-flex w-8 items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onChange(clampMark(value + 1))}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function AnswerKeyAnswersEditor({ answerKey, heading, readOnly = false }: AnswerKeyAnswersEditorProps) {
  const [saving, startSaving] = useTransition();
  const initialRanges =
    answerKey.subjectRanges.length > 0 ? answerKey.subjectRanges : FALLBACK_RANGES;
  const [answers, setAnswers] = useState<Record<string, KeyAnswer>>(() => answerKey.answers);
  const [explanations, setExplanations] = useState<Record<string, string>>(() => answerKey.explanations);
  const [questionMode, setQuestionMode] = useState<QuestionMode | "">(() =>
    inferQuestionMode(answerKey.answers),
  );
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
  const testIdCheck = useTestIdCheck(readOnly ? "" : testId, answerKey.id);
  const isMcq = questionMode === "mcq";

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

  function goToQuestion(question: number) {
    const el = document.getElementById(`answer-key-q-${question}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("ring-2", "ring-red-400");
    window.setTimeout(() => el?.classList.remove("ring-2", "ring-red-400"), 1600);
  }

  function changeQuestionMode(next: QuestionMode | null) {
    const mode = next ?? "";
    setQuestionMode(mode);
    if (mode !== "non_mcq") return;
    // Non MCQ keeps only the first selected option per question.
    setAnswers((current) => {
      let changed = false;
      const nextAnswers: Record<string, KeyAnswer> = {};
      for (const [question, answer] of Object.entries(current)) {
        if (isBonusKey(answer)) {
          nextAnswers[question] = answer;
          continue;
        }
        const options = keyOptions(answer);
        if (options.length <= 1) {
          nextAnswers[question] = answer;
          continue;
        }
        changed = true;
        nextAnswers[question] = options[0]!;
      }
      if (changed) toast.message("Switched to Non MCQ — kept one option per question");
      return changed ? nextAnswers : current;
    });
  }

  function toggleOption(question: string, option: AnswerOption) {
    if (readOnly) return;
    if (!questionMode) {
      toast.error("Select Non MCQ or MCQ first");
      return;
    }
    setAnswers((current) => {
      const next = { ...current };
      if (isMcq) {
        const picked = new Set(keyOptions(current[question]));
        if (picked.has(option)) picked.delete(option);
        else picked.add(option);
        const joined = joinKeyOptions(picked);
        if (!joined) delete next[question];
        else next[question] = joined;
        return next;
      }
      // Non MCQ: single option only (tap again to clear).
      if (current[question] === option) delete next[question];
      else next[question] = option;
      return next;
    });
  }

  function save() {
    const nextTestId = testId.trim();
    if (!questionMode) {
      toast.error("Select Non MCQ or MCQ at the top");
      return;
    }
    if (!TEST_ID_PATTERN.test(nextTestId)) {
      toast.error(TEST_ID_MESSAGE);
      document.querySelector<HTMLInputElement>('[aria-label="Test ID"]')?.focus();
      return;
    }
    if (testIdCheck.state === "taken") {
      toast.error("This test ID is already used by another answer key.");
      document.querySelector<HTMLInputElement>('[aria-label="Test ID"]')?.focus();
      return;
    }
    if (incomplete.length > 0) {
      const first = incomplete[0]!;
      toast.error(`Complete all answers before saving · Q${first} is incomplete`);
      goToQuestion(first);
      return;
    }
    if (!dirty) {
      toast.message("Nothing to save");
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
        setQuestionMode(inferQuestionMode(saved.answers) || questionMode);
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Question type
          </span>
          <Select
            value={questionMode || null}
            items={[...MODE_ITEMS]}
            onValueChange={(value) => changeQuestionMode((value as QuestionMode | null) ?? null)}
            disabled={pending || readOnly}
          >
            <SelectTrigger className="h-8 w-[8.5rem]" aria-label="Question type" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {MODE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm font-medium text-neutral-500">{totalQuestions} questions</p>
        {incomplete.length > 0 ? (
          <button
            type="button"
            onClick={() => goToQuestion(incomplete[0]!)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline"
          >
            <AlertCircle className="size-4 shrink-0" />
            {incomplete.length} incomplete
          </button>
        ) : null}
        {!readOnly && (
          <Button type="button" className="ml-auto" onClick={save} disabled={pending}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        )}
      </div>
      {questionMode === "mcq" ? (
        <p className="text-xs text-neutral-500">
          MCQ: select every correct option for each question (e.g. A and C → A/C).
        </p>
      ) : questionMode === "non_mcq" ? (
        <p className="text-xs text-neutral-500">Non MCQ: one correct option per question.</p>
      ) : !readOnly ? (
        <p className="text-xs text-amber-700">Choose Non MCQ or MCQ before entering answers.</p>
      ) : null}

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
                <div className="flex flex-col gap-1.5">
                  <Input
                    value={testId}
                    disabled={pending || readOnly}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={TEST_ID_LENGTH}
                    placeholder="6 digits"
                    aria-label="Test ID"
                    aria-invalid={testIdCheck.state === "taken" ? true : undefined}
                    className="h-9 w-full max-w-40 bg-white font-mono text-sm tracking-widest tabular-nums"
                    onChange={(event) => setTestId(testIdDigits(event.currentTarget.value))}
                  />
                  {!readOnly ? <TestIdStatus check={testIdCheck} length={testId.trim().length} /> : null}
                </div>
              </td>
              <td className="px-4 py-3">
                <MarksStepper
                  value={correctMarks}
                  disabled={pending || readOnly}
                  ariaLabel="Marks for a correct answer"
                  onChange={setCorrectMarks}
                />
              </td>
              <td className="px-4 py-3">
                <MarksStepper
                  value={wrongMarks}
                  disabled={pending || readOnly}
                  ariaLabel="Negative marks for a wrong answer"
                  prefix="−"
                  onChange={setWrongMarks}
                />
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
                    id={`answer-key-q-${question}`}
                    key={question}
                    className={cn(
                      "grid gap-3 px-4 py-3 scroll-mt-24 md:grid-cols-[4.5rem_auto_minmax(0,1fr)] md:items-start",
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
                            onClick={() => toggleOption(key, option)}
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
                          if (!questionMode) {
                            toast.error("Select Non MCQ or MCQ first");
                            return;
                          }
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
                      {isMcq && keyOptions(answers[key]).length > 1 ? (
                        <span className="ml-1 text-[11px] font-semibold text-brand-800">
                          {answers[key]}
                        </span>
                      ) : null}
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
