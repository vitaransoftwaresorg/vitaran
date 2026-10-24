import type { SchoolType, Subject } from "../generated/prisma/enums.js";
import {
  ANSWER_OPTIONS,
  asAnswers,
  asMarkedSelections,
  asSubjectRanges,
  formatMarked,
  isAndKey,
  isBonusKey,
  isOrKey,
  keyOptions,
  type AnswerOption,
  type KeyAnswer,
  type SubjectRange,
} from "./answer-key-parse.js";

export type SubjectScore = {
  subject: Subject;
  from: number;
  to: number;
  correct: number;
  wrong: number;
  blank: number;
  partial: number;
  total: number;
  maxTotal: number;
};

export type OmScore = {
  answers: Record<string, string>;
  subjectScores: SubjectScore[];
  correct: number;
  wrong: number;
  blank: number;
  partial: number;
  total: number;
  maxTotal: number;
};

export type QuestionResult = "OK" | "PARTIAL" | "BONUS" | "WRONG" | "BLANK";

export type QuestionScore = {
  marked: AnswerOption[];
  marks: number;
  result: QuestionResult;
};

const FULL = 4;

export function wrongPenaltyFor(schoolType: SchoolType | string | null | undefined) {
  return schoolType === "CUSTOMIZED" ? -1 : 0;
}

/**
 * Mains: one bubble. ADD = 4 if any bubble else 0. B/C = 4 if the one bubble is B or C.
 * Advanced A,C,D: +1 per correct option with no extras; 4 only when every correct option is filled.
 * Wrong combo: customized −1, regular 0. Blank is always 0.
 */
export function scoreQuestion(
  marked: AnswerOption[],
  expected: KeyAnswer,
  wrongPenalty: number,
): QuestionScore {
  const got = ANSWER_OPTIONS.filter((option) => marked.includes(option));
  if (isBonusKey(expected)) {
    return got.length > 0 ? { marked: got, marks: FULL, result: "BONUS" } : { marked: got, marks: 0, result: "BLANK" };
  }
  const want = keyOptions(expected);
  if (got.length === 0) return { marked: got, marks: 0, result: "BLANK" };

  if (isOrKey(expected)) {
    if (got.length === 1 && want.includes(got[0]!)) {
      return { marked: got, marks: FULL, result: "OK" };
    }
    return { marked: got, marks: wrongPenalty, result: "WRONG" };
  }

  if (isAndKey(expected)) {
    if (got.some((option) => !want.includes(option))) {
      return { marked: got, marks: wrongPenalty, result: "WRONG" };
    }
    if (got.length === want.length) return { marked: got, marks: FULL, result: "OK" };
    return { marked: got, marks: got.length, result: "PARTIAL" };
  }

  if (got.length === 1 && got[0] === want[0]) return { marked: got, marks: FULL, result: "OK" };
  return { marked: got, marks: wrongPenalty, result: "WRONG" };
}

export function scoreOmrAnswers(
  markedInput: unknown,
  keyAnswers: unknown,
  rangesInput: unknown,
  options: { wrongPenalty?: number } = {},
): OmScore {
  const wrongPenalty = options.wrongPenalty ?? 0;
  const marked = asMarkedSelections(markedInput);
  const key = asAnswers(keyAnswers);
  const keyQuestions = Object.keys(key)
    .map(Number)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const last = keyQuestions[keyQuestions.length - 1] ?? 0;
  const ranges: SubjectRange[] =
    asSubjectRanges(rangesInput).length > 0
      ? asSubjectRanges(rangesInput)
      : last > 0
        ? [{ subject: "MATHEMATICS" as Subject, from: 1, to: last, maxMarks: last * FULL }]
        : [];

  const questions =
    ranges.length > 0
      ? ranges.flatMap((range) =>
          Array.from({ length: Math.max(0, range.to - range.from + 1) }, (_, i) => range.from + i),
        )
      : keyQuestions;

  const subjectScores: SubjectScore[] = ranges.map((range) => ({
    subject: range.subject,
    from: range.from,
    to: range.to,
    correct: 0,
    wrong: 0,
    blank: 0,
    partial: 0,
    total: 0,
    maxTotal: range.maxMarks || (range.to - range.from + 1) * FULL,
  }));

  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let partial = 0;
  let total = 0;
  const answers: Record<string, string> = {};

  for (const question of questions) {
    const expected = key[String(question)];
    const got = marked[String(question)] ?? [];
    const band = subjectScores.find((row) => question >= row.from && question <= row.to);
    if (!expected) continue;
    answers[String(question)] = formatMarked(got);
    const scored = scoreQuestion(got, expected, wrongPenalty);
    total += scored.marks;
    if (band) band.total += scored.marks;
    if (scored.result === "OK" || scored.result === "BONUS") {
      correct += 1;
      if (band) band.correct += 1;
      continue;
    }
    if (scored.result === "PARTIAL") {
      partial += 1;
      if (band) band.partial += 1;
      continue;
    }
    if (scored.result === "BLANK") {
      blank += 1;
      if (band) band.blank += 1;
      continue;
    }
    wrong += 1;
    if (band) band.wrong += 1;
  }

  return {
    answers,
    subjectScores,
    correct,
    wrong,
    blank,
    partial,
    total,
    maxTotal: subjectScores.reduce((sum, row) => sum + row.maxTotal, 0) || questions.length * FULL,
  };
}
