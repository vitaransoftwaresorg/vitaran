"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, Download, FileSpreadsheet, Loader2, Minus, Plus, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { subjectLabel } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import type { AnswerKeyDetail, AnswerOption, KeyAnswer, KeyTypeRange, SubjectRange } from "@/types/answer-key";
import {
  isBonusKey,
  joinKeyOptions,
  keyOptions,
  marksForQuestion,
  normalizeKeyTypeRanges,
} from "@/types/answer-key";
import {
  getAnswerKeyOmrStatusAction,
  parseAnswerKeyPdfAction,
  saveAnswerKeyAnswersAction,
} from "./actions";
import { AnswerKeyConfigDialog } from "./answer-key-config-dialog";
import { downloadAnswerKeyTemplate, readAnswerKeyExcel } from "./answer-key-excel";
import { AnswerKeyOptionsTable } from "./answer-key-options-table";
import { AnswerKeyPdfActions } from "./answer-key-pdf-actions";
import { ANSWER_KEYS_PATH } from "./constants";
import { enteredTestId, TEST_ID_LENGTH, TEST_ID_MESSAGE, TEST_ID_PATTERN, testIdDigits } from "./test-id";
import { TestIdStatus, useTestIdCheck } from "./test-id-status";

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];
const DEFAULT_CORRECT_MARKS = 4;
const MAX_MARK_VALUE = 100;

/** Drafts with no answers yet: treat legacy stored 1 as the new default 4. */
function initialCorrectMarks(answerKey: { answerCount?: number; correctMarks?: number }) {
  const stored = answerKey.correctMarks;
  if ((answerKey.answerCount ?? 0) === 0 && (stored == null || stored === 1)) {
    return DEFAULT_CORRECT_MARKS;
  }
  return stored ?? DEFAULT_CORRECT_MARKS;
}

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

type AnswerKeyAnswersEditorProps = {
  answerKey: AnswerKeyDetail;
  /** Program · Test · Class, shown on the same row as Save. */
  heading?: string;
  /** School / teacher: look, don't edit. */
  readOnly?: boolean;
};

const SUBJECT_BLOCK = 25;

function questionsIn(range: SubjectRange) {
  return Array.from({ length: Math.max(0, range.to - range.from + 1) }, (_, index) => range.from + index);
}

/** maxMarks 0 = reserved empty band (no Maths) — still show Q numbers as "—". */
function isEmptyBand(range: SubjectRange) {
  return range.maxMarks === 0;
}

function countOf(range: SubjectRange) {
  if (isEmptyBand(range)) return 0;
  return Math.max(0, range.to - range.from + 1);
}

function snapshot(
  answers: Record<string, KeyAnswer>,
  explanations: Record<string, string>,
  ranges: SubjectRange[],
  keyTypeRanges: KeyTypeRange[],
  testId: string,
  correctMarks: number,
  wrongMarks: number,
) {
  return JSON.stringify({
    answers,
    explanations,
    ranges,
    keyTypeRanges,
    testId,
    correctMarks,
    wrongMarks,
  });
}

/**
 * Fixed 25-wide slots (Maths 1–25, Physics 26–50, …). Setting a subject to 0 keeps
 * its band as empty "—" placeholders — never renumbers later subjects down to Q1.
 */
function rangesFromCounts(
  rows: Array<{ subject: string; count: number }>,
  correctMarks: number,
): SubjectRange[] {
  return rows.map((row, index) => {
    const from = index * SUBJECT_BLOCK + 1;
    const count = Math.min(SUBJECT_BLOCK, Math.max(0, row.count));
    if (count === 0) {
      return { subject: row.subject, from, to: from + SUBJECT_BLOCK - 1, maxMarks: 0 };
    }
    return {
      subject: row.subject,
      from,
      to: from + count - 1,
      maxMarks: count * correctMarks,
    };
  });
}

/** Drop answers outside a subject's active window; other subjects keep their Q numbers. */
function trimBandAnswers<T>(
  previous: Record<string, T>,
  subjectIndex: number,
  nextRange: SubjectRange | undefined,
) {
  const slotFrom = subjectIndex * SUBJECT_BLOCK + 1;
  const slotTo = slotFrom + SUBJECT_BLOCK - 1;
  const next: Record<string, T> = { ...previous };
  for (let question = slotFrom; question <= slotTo; question += 1) {
    const key = String(question);
    if (!nextRange || isEmptyBand(nextRange) || question < nextRange.from || question > nextRange.to) {
      delete next[key];
    }
  }
  return next;
}

const FALLBACK_RANGES: SubjectRange[] = [
  { subject: "MATHEMATICS", from: 1, to: 100, maxMarks: 400 },
];

const SCIENCE_ORDER = ["MATHEMATICS", "PHYSICS", "CHEMISTRY", "BIOLOGY"] as const;

/** When Physics starts at 26 with no Maths row, reserve Q1–25 as empty "—". */
function padLeadingEmptyBands(ranges: SubjectRange[]): SubjectRange[] {
  if (ranges.length === 0) return ranges;
  const first = ranges[0]!;
  const expectedIndex = SCIENCE_ORDER.indexOf(first.subject as (typeof SCIENCE_ORDER)[number]);
  if (expectedIndex <= 0) return ranges;
  if (first.from !== expectedIndex * SUBJECT_BLOCK + 1) return ranges;
  const leading = SCIENCE_ORDER.slice(0, expectedIndex).map((subject, index) => ({
    subject,
    from: index * SUBJECT_BLOCK + 1,
    to: index * SUBJECT_BLOCK + SUBJECT_BLOCK,
    maxMarks: 0,
  }));
  return [...leading, ...ranges];
}

export function AnswerKeyAnswersEditor({ answerKey, heading, readOnly = false }: AnswerKeyAnswersEditorProps) {
  const [saving, startSaving] = useTransition();
  const initialRanges = padLeadingEmptyBands(
    answerKey.subjectRanges.length > 0 ? answerKey.subjectRanges : FALLBACK_RANGES,
  );
  const [answers, setAnswers] = useState<Record<string, KeyAnswer>>(() => answerKey.answers);
  const [explanations, setExplanations] = useState<Record<string, string>>(() => answerKey.explanations);
  const [correctMarks, setCorrectMarks] = useState(() => initialCorrectMarks(answerKey));
  const [wrongMarks, setWrongMarks] = useState(() => answerKey.wrongMarks ?? 0);
  const [keyTypeRanges, setKeyTypeRanges] = useState<KeyTypeRange[]>(() =>
    normalizeKeyTypeRanges(answerKey.keyTypeRanges, {
      correctMarks: initialCorrectMarks(answerKey),
      wrongMarks: answerKey.wrongMarks ?? 0,
    }),
  );
  const [configOpen, setConfigOpen] = useState(false);
  const [testId, setTestId] = useState(() => enteredTestId(answerKey.testId));
  const [counts, setCounts] = useState(() =>
    initialRanges.map((range) => ({ subject: range.subject, count: countOf(range) })),
  );
  const ranges = useMemo(() => rangesFromCounts(counts, correctMarks), [counts, correctMarks]);
  const [baseline, setBaseline] = useState(() =>
    snapshot(
      answerKey.answers,
      answerKey.explanations,
      initialRanges,
      normalizeKeyTypeRanges(answerKey.keyTypeRanges, {
        correctMarks: initialCorrectMarks(answerKey),
        wrongMarks: answerKey.wrongMarks ?? 0,
      }),
      enteredTestId(answerKey.testId),
      initialCorrectMarks(answerKey),
      answerKey.wrongMarks ?? 0,
    ),
  );
  const [printedAnswers, setPrintedAnswers] = useState(() => answerKey.printedAnswers ?? {});
  const [omrLocked, setOmrLocked] = useState(false);
  const [omrLockMessage, setOmrLockMessage] = useState<string | null>(null);
  const locked = readOnly || omrLocked;
  const testIdCheck = useTestIdCheck(locked ? "" : testId, answerKey.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (readOnly) return;
    let live = true;
    const check = async () => {
      const result = await getAnswerKeyOmrStatusAction(answerKey.id);
      if (!live || !result.ok) return;
      setOmrLocked(result.locked);
      setOmrLockMessage(result.message);
    };
    void check();
    const timer = window.setInterval(() => void check(), 3000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [answerKey.id, readOnly]);

  const dirty = useMemo(
    () =>
      snapshot(
        answers,
        explanations,
        ranges,
        keyTypeRanges,
        testId.trim(),
        correctMarks,
        wrongMarks,
      ) !== baseline,
    [answers, explanations, ranges, keyTypeRanges, testId, correctMarks, wrongMarks, baseline],
  );
  // Empty bands still count toward the paper (100 Q) so numbers never collapse.
  const totalQuestions = ranges.reduce(
    (sum, range) => sum + Math.max(0, range.to - range.from + 1),
    0,
  );
  const incomplete = ranges
    .filter((range) => !isEmptyBand(range))
    .flatMap((range) => questionsIn(range).filter((question) => !answers[String(question)]));
  const pending = saving;

  function setSubjectCount(subject: string, count: number) {
    const nextCount = Math.min(
      SUBJECT_BLOCK,
      Math.max(0, Number.isFinite(count) ? count : 0),
    );
    const subjectIndex = counts.findIndex((row) => row.subject === subject);
    const nextCounts = counts.map((row) =>
      row.subject === subject ? { ...row, count: nextCount } : row,
    );
    const nextRanges = rangesFromCounts(nextCounts, correctMarks);
    const nextRange = nextRanges[subjectIndex];
    if (subjectIndex >= 0) {
      setAnswers((current) => trimBandAnswers(current, subjectIndex, nextRange));
      setExplanations((current) => trimBandAnswers(current, subjectIndex, nextRange));
    }
    setCounts(nextCounts);
  }

  function goToQuestion(question: number) {
    const el = document.getElementById(`answer-key-q-${question}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("ring-2", "ring-red-400");
    window.setTimeout(() => el?.classList.remove("ring-2", "ring-red-400"), 1600);
  }

  function toggleOption(question: string, option: AnswerOption) {
    if (locked) return;
    // Both Normal and MCQ allow multiple correct options on the key.
    setAnswers((current) => {
      const next = { ...current };
      const picked = new Set(keyOptions(current[question]));
      if (picked.has(option)) picked.delete(option);
      else picked.add(option);
      const joined = joinKeyOptions(picked);
      if (!joined) delete next[question];
      else next[question] = joined;
      return next;
    });
  }

  function applyKeyTypeRanges(nextRanges: KeyTypeRange[]) {
    setKeyTypeRanges(nextRanges);
  }

  async function downloadTemplate() {
    setTemplateBusy(true);
    try {
      await downloadAnswerKeyTemplate({
        questionCount: Math.max(totalQuestions, 1),
        fileName: `answer-key-${enteredTestId(testId) || answerKey.id.slice(0, 8)}.xlsx`,
      });
    } catch {
      toast.error("Could not create the template. Try again.");
    } finally {
      setTemplateBusy(false);
    }
  }

  function applyImportedAnswers(
    imported: Array<{ question: number; answer: KeyAnswer }>,
    sourceName: string,
  ) {
    const allowed = new Set(
      ranges
        .filter((range) => !isEmptyBand(range))
        .flatMap((range) => questionsIn(range).map(String)),
    );
    const next: Record<string, KeyAnswer> = { ...answers };
    let applied = 0;
    let skipped = 0;

    for (const row of imported) {
      const key = String(row.question);
      if (!allowed.has(key)) {
        skipped += 1;
        continue;
      }
      next[key] = row.answer;
      applied += 1;
    }

    if (applied === 0) {
      toast.error(
        skipped
          ? `None of the ${imported.length} answers match this key’s question numbers.`
          : "No answers could be imported.",
      );
      return;
    }

    setAnswers(next);
    toast.success(
      `Imported ${applied} answer${applied === 1 ? "" : "s"} from ${sourceName}` +
        (skipped ? ` · ${skipped} outside this paper skipped` : "") +
        ". Review, then Save.",
    );
  }

  async function importFile(file: File) {
    if (locked) return;
    setImporting(true);
    try {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        // PDF is parsed on the server in memory — never stored.
        const formData = new FormData();
        formData.append("pdf", file);
        const result = await parseAnswerKeyPdfAction(formData);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        const imported = Object.entries(result.data.answers).map(([question, answer]) => ({
          question: Number(question),
          answer,
        }));
        if (!imported.length) {
          toast.error(`No answers found in ${file.name}.`);
          return;
        }
        if (result.data.testId && !testId.trim()) {
          setTestId(enteredTestId(result.data.testId));
        }
        applyImportedAnswers(imported, file.name);
        return;
      }

      const imported = await readAnswerKeyExcel(file);
      if (!imported.length) {
        toast.error(`No answers found in ${file.name}. Fill the Answer column and try again.`);
        return;
      }
      applyImportedAnswers(imported, file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this file.");
    } finally {
      setImporting(false);
    }
  }

  function save() {
    if (omrLocked) {
      toast.error(omrLockMessage ?? "OMR evaluation is ongoing. Editing is locked.");
      return;
    }
    const nextTestId = testId.trim();
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
          keyTypeRanges,
          testId: nextTestId,
          correctMarks,
          wrongMarks,
        });
        setAnswers(saved.answers);
        setExplanations(saved.explanations);
        setPrintedAnswers(saved.printedAnswers ?? {});
        const savedCorrect = saved.correctMarks ?? DEFAULT_CORRECT_MARKS;
        const savedWrong = saved.wrongMarks ?? 0;
        const savedTypeRanges = normalizeKeyTypeRanges(saved.keyTypeRanges, {
          correctMarks: savedCorrect,
          wrongMarks: savedWrong,
        });
        setKeyTypeRanges(savedTypeRanges);
        setTestId(enteredTestId(saved.testId));
        setCorrectMarks(savedCorrect);
        setWrongMarks(savedWrong);
        setCounts(
          saved.subjectRanges.map((range) => ({ subject: range.subject, count: countOf(range) })),
        );
        setBaseline(
          snapshot(
            saved.answers,
            saved.explanations,
            saved.subjectRanges,
            savedTypeRanges,
            enteredTestId(saved.testId),
            savedCorrect,
            savedWrong,
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
      {omrLocked && omrLockMessage ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <p className="font-medium">{omrLockMessage}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {heading ? (
          <h1 className="text-base font-bold text-brand-900 sm:text-lg">{heading}</h1>
        ) : null}
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
        <div className="ml-auto flex flex-wrap items-end gap-2">
          {!locked ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setConfigOpen(true)}
              >
                <Settings2 className="size-4" />
                Configuration
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || templateBusy || importing}
                onClick={() => void downloadTemplate()}
              >
                {templateBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || importing || templateBusy}
                onClick={() => fileRef.current?.click()}
              >
                {importing ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                Import
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void importFile(file);
                }}
              />
            </>
          ) : null}
          {Object.keys(answers).length > 0 ? (
            <AnswerKeyPdfActions basePath={ANSWER_KEYS_PATH} id={answerKey.id} />
          ) : null}
          {!locked ? (
            <div className="flex flex-col items-end gap-1">
              {Object.keys(answers).length === 0 ? (
                <span className="text-xs font-medium text-neutral-400">Answers not published yet</span>
              ) : null}
              <Button type="button" onClick={save} disabled={pending}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                Save
              </Button>
            </div>
          ) : Object.keys(answers).length === 0 ? (
            <span className="text-xs font-medium text-neutral-400">Answers not published yet</span>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase">
              <th className="px-4 py-2 font-medium">Test ID</th>
              <th className="px-4 py-2 font-medium">Correct</th>
              <th className="px-4 py-2 font-medium">Wrong</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1.5">
                  <Input
                    value={testId}
                    disabled={pending || locked}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={TEST_ID_LENGTH}
                    placeholder="6 or 7 digits"
                    aria-label="Test ID"
                    aria-invalid={testIdCheck.state === "taken" ? true : undefined}
                    className="h-9 w-full max-w-40 bg-white font-mono text-sm tracking-widest tabular-nums"
                    onChange={(event) => setTestId(testIdDigits(event.currentTarget.value))}
                  />
                  {!locked ? <TestIdStatus check={testIdCheck} length={testId.trim().length} /> : null}
                </div>
              </td>
              <td className="px-4 py-3">
                <MarksStepper
                  value={correctMarks}
                  disabled={pending || locked}
                  ariaLabel="Marks for a correct answer"
                  onChange={setCorrectMarks}
                />
              </td>
              <td className="px-4 py-3">
                <MarksStepper
                  value={wrongMarks}
                  disabled={pending || locked}
                  ariaLabel="Negative marks for a wrong answer"
                  prefix="−"
                  onChange={setWrongMarks}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!locked && counts.length > 0 ? (
        <div className="flex flex-wrap gap-3 rounded-2xl border border-brand-100 bg-white p-4">
          {counts.map((row) => (
            <label key={row.subject} className="flex min-w-40 flex-1 items-center gap-2">
              <span className="text-sm font-semibold text-neutral-800">{subjectLabel(row.subject)}</span>
              <Input
                type="number"
                min={0}
                max={SUBJECT_BLOCK}
                value={row.count}
                disabled={pending}
                aria-label={`${subjectLabel(row.subject)} questions`}
                title="0 keeps this subject’s question numbers empty (—); other subjects stay in place"
                className="h-9 w-20 bg-white tabular-nums"
                onChange={(event) => setSubjectCount(row.subject, Number.parseInt(event.currentTarget.value, 10))}
              />
            </label>
          ))}
        </div>
      ) : null}

      {ranges.length > 0 ? (
        <AnswerKeyOptionsTable
          questions={ranges.flatMap((range) => questionsIn(range))}
          answers={answers}
          correctMarks={correctMarks}
          wrongMarks={wrongMarks}
          keyTypeRanges={keyTypeRanges}
        />
      ) : null}

      {ranges.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          {locked ? "No answers published for this test yet." : "Set questions for each subject, then fill the key."}
        </p>
      ) : (
        ranges.map((range) => (
          <section
            key={`${range.subject}-${range.from}`}
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
          >
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="text-sm font-bold text-neutral-900">
                {subjectLabel(range.subject)} ·{" "}
                {isEmptyBand(range)
                  ? `Q${range.from}–${range.to} empty`
                  : `${countOf(range)} questions`}
              </h2>
            </header>
            <ol className="divide-y divide-neutral-100">
              {questionsIn(range).map((question) => {
                const key = String(question);
                const emptyBand = isEmptyBand(range);
                const missing = !emptyBand && !answers[key];
                const questionMarks = marksForQuestion(keyTypeRanges, question, {
                  correctMarks,
                  wrongMarks,
                });
                const questionType = questionMarks.type;
                const isMcq = questionType === "mcq";
                const isBonus = isBonusKey(answers[key]);
                return (
                  <li
                    id={`answer-key-q-${question}`}
                    key={question}
                    className={cn(
                      "grid gap-3 px-4 py-3 scroll-mt-24 md:grid-cols-[4.5rem_auto_minmax(0,1fr)] md:items-start",
                      missing && "bg-red-50",
                      emptyBand && "bg-neutral-50/80",
                    )}
                  >
                    <div>
                      <p className="text-sm font-bold text-neutral-700 tabular-nums">Q{question}</p>
                      {emptyBand ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">—</p>
                      ) : isBonus ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-sky-700">
                          ADD +{questionMarks.correctMarks}
                        </p>
                      ) : isMcq ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-brand-700">MCQ</p>
                      ) : null}
                      {missing ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-red-700">Incomplete</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {emptyBand ? (
                        <span className="text-sm font-bold text-neutral-400">—</span>
                      ) : null}
                      {!emptyBand
                        ? OPTIONS.map((option) => {
                            const selected = keyOptions(answers[key]).includes(option);
                            return (
                              <button
                                key={option}
                                type="button"
                                disabled={pending || locked}
                                onClick={() => toggleOption(key, option)}
                                className={cn(
                                  "size-8 rounded-md text-xs font-bold",
                                  selected
                                    ? "bg-brand-900 text-white"
                                    : "border border-neutral-200 bg-white text-neutral-700",
                                  !locked && !selected && "hover:bg-neutral-50",
                                  locked && "cursor-default",
                                )}
                              >
                                {option}
                              </button>
                            );
                          })
                        : null}
                      {!emptyBand ? (
                        <button
                          type="button"
                          disabled={pending || locked}
                          onClick={() => {
                            if (locked) return;
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
                          title={`ADD: +${questionMarks.correctMarks} whether attempted or not (config marks win when set)`}
                          className={cn(
                            "h-8 rounded-md px-2 text-[11px] font-bold",
                            isBonus
                              ? "bg-sky-700 text-white"
                              : "border border-neutral-200 bg-white text-neutral-700",
                            !locked && !isBonus && "hover:bg-neutral-50",
                            locked && "cursor-default",
                          )}
                        >
                          ADD
                          {isBonus ? (
                            <span className="ml-1 tabular-nums">+{questionMarks.correctMarks}</span>
                          ) : null}
                        </button>
                      ) : null}
                      {!emptyBand && keyOptions(answers[key]).length > 1 ? (
                        <span className="ml-1 text-[11px] font-semibold text-brand-800">
                          {answers[key]}
                        </span>
                      ) : null}
                    </div>
                    {emptyBand ? (
                      <p className="w-full min-w-0 text-sm text-neutral-400">—</p>
                    ) : locked ? (
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

      {!locked ? (
        <AnswerKeyConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          maxQuestion={Math.max(totalQuestions, 1)}
          value={keyTypeRanges}
          defaultCorrectMarks={correctMarks}
          defaultWrongMarks={wrongMarks}
          onSave={applyKeyTypeRanges}
        />
      ) : null}
    </div>
  );
}
