import {
  asAnswers,
  asKeyTypeRanges,
  asSubjectRanges,
  isBonusKey,
  keyOptions,
  markedList,
  marksForQuestion,
  type AnswerOption,
  type KeyAnswer,
  type SubjectRange,
} from "../utils/answer-key-parse.js";

export type SubjectScore = {
  subject: string;
  from: number;
  to: number;
  correct: number;
  /** Multi-correct MCQ with only some key options marked (or mixed). */
  partial: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
};

export type SheetScore = {
  subjectScores: SubjectScore[];
  unattempted: number[];
  correct: number;
  partial: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
};

export type QuestionResult = "correct" | "wrong" | "partial" | "blank" | "unkeyed";

export type QuestionScore = {
  result: QuestionResult;
  /** Marks awarded for this question (may be negative when wrongMarks apply). */
  marks: number;
};

/** Drop float residue (e.g. 286.66700000000003 → 286.667). */
export function roundMarks(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(3));
}

export type QuestionScoreOptions = {
  /** normal = any correct option earns full marks; mcq = partial per option. */
  mode?: "normal" | "mcq";
  wrongMarks?: number;
};

/**
 * Score one question.
 * Normal: any marked option that is in the key → full correctMarks.
 * MCQ: equal share of correctMarks per key option marked; any extra (wrong) option → 0.
 */
export function questionScore(
  marked: AnswerOption | AnswerOption[] | string | undefined,
  expected: KeyAnswer | undefined,
  correctMarks: number,
  options: QuestionScoreOptions = {},
): QuestionScore {
  const mode = options.mode ?? "normal";
  const wrongMarks = options.wrongMarks ?? 0;
  // ADD: always award correct marks whether attempted or not.
  if (isBonusKey(expected)) return { result: "correct", marks: correctMarks };
  const filled = markedList(marked);
  if (filled.length === 0) return { result: "blank", marks: 0 };
  if (!expected) return { result: "unkeyed", marks: 0 };

  const wanted = keyOptions(expected);
  if (wanted.length === 0) return { result: "unkeyed", marks: 0 };

  const wrongPenalty = wrongMarks > 0 ? -wrongMarks : 0;

  if (mode === "normal") {
    const hit = filled.some((option) => wanted.includes(option));
    if (hit) return { result: "correct", marks: correctMarks };
    return { result: "wrong", marks: wrongPenalty };
  }

  // MCQ: any option not in the key zeros the question (e.g. key A/B/C, marked A/B/D → 0).
  const hasExtra = filled.some((option) => !wanted.includes(option));
  if (hasExtra) return { result: "wrong", marks: 0 };

  // Only correct options marked → partial credit per option, full if all key options marked.
  const perOption = correctMarks / wanted.length;
  const earned = roundMarks(Math.min(filled.length * perOption, correctMarks));
  const allWantedMarked = wanted.every((option) => filled.includes(option));
  if (earned <= 0) return { result: "wrong", marks: wrongPenalty };
  if (allWantedMarked) return { result: "correct", marks: correctMarks };
  return { result: "partial", marks: earned };
}

/** Display / overlay classification (same rules as scoring). */
export function questionResult(
  marked: AnswerOption | AnswerOption[] | string | undefined,
  expected: KeyAnswer | undefined,
  mode: "normal" | "mcq" = "normal",
): QuestionResult {
  // correctMarks only scales marks; result kind is independent of the absolute value.
  return questionScore(marked, expected, 1, { mode }).result;
}

/** A 75-question test ignores bubbles 76–100 on the 100-question sheet. */
export function onPaper(score: Pick<SheetScore, "subjectScores">, question: number) {
  return score.subjectScores.some((range) => question >= range.from && question <= range.to);
}

/** Un-attempted questions plus the reader's own flags, limited to questions on this test's paper. */
export function sheetFlags(score: SheetScore, readFlags: Array<{ question: number; reason: string }>) {
  return [
    ...score.unattempted
      .filter((question) => !readFlags.some((flag) => flag.question === question))
      .map((question) => ({ question, reason: "Un-attempted" })),
    ...readFlags.filter((flag) => onPaper(score, flag.question)),
  ].sort((a, b) => a.question - b.question);
}

export function scoreSheet(
  marked: Record<string, AnswerOption | AnswerOption[] | string>,
  keyAnswers: unknown,
  rangesInput: unknown,
  marks: { correctMarks: number; wrongMarks: number },
  keyTypeRangesInput: unknown = [],
): SheetScore {
  const key = asAnswers(keyAnswers);
  const ranges = asSubjectRanges(rangesInput);
  const keyTypeRanges = asKeyTypeRanges(keyTypeRangesInput);
  const keyedLast = Math.max(0, ...Object.keys(key).map(Number).filter(Number.isFinite));
  const fallbackTo = keyedLast || 100;
  const bands: SubjectRange[] =
    ranges.length > 0 ? ranges : [{ subject: "TOTAL", from: 1, to: fallbackTo, maxMarks: fallbackTo * marks.correctMarks }];
  const subjectScores = bands.map((range) => {
    let correct = 0;
    let partial = 0;
    let wrong = 0;
    let blank = 0;
    let total = 0;
    let maxTotal = 0;
    for (let question = range.from; question <= range.to; question += 1) {
      const qMarks = marksForQuestion(keyTypeRanges, question, marks);
      const { result, marks: earned } = questionScore(
        marked[String(question)],
        key[String(question)],
        qMarks.correctMarks,
        { mode: qMarks.type, wrongMarks: qMarks.wrongMarks },
      );
      total += earned;
      maxTotal += qMarks.correctMarks;
      if (result === "blank") blank += 1;
      else if (result === "correct") correct += 1;
      else if (result === "partial") partial += 1;
      else if (result === "wrong") wrong += 1;
    }
    return {
      subject: range.subject,
      from: range.from,
      to: range.to,
      correct,
      partial,
      wrong,
      blank,
      total: roundMarks(total),
      maxTotal: range.maxMarks || maxTotal,
    };
  });

  const first = Math.min(...bands.map((range) => range.from));
  const last = Math.max(...bands.map((range) => range.to));
  const unattempted: number[] = [];
  for (let question = first; question <= last; question += 1) {
    // ADD questions always score; never flag as un-attempted.
    if (isBonusKey(key[String(question)])) continue;
    if (markedList(marked[String(question)]).length === 0) unattempted.push(question);
  }

  return {
    subjectScores,
    unattempted,
    correct: subjectScores.reduce((sum, row) => sum + row.correct, 0),
    partial: subjectScores.reduce((sum, row) => sum + row.partial, 0),
    wrong: subjectScores.reduce((sum, row) => sum + row.wrong, 0),
    blank: subjectScores.reduce((sum, row) => sum + row.blank, 0),
    total: roundMarks(subjectScores.reduce((sum, row) => sum + row.total, 0)),
    maxTotal: subjectScores.reduce((sum, row) => sum + row.maxTotal, 0),
  };
}
