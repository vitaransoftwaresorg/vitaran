import {
  asAnswers,
  asSubjectRanges,
  isBonusKey,
  isMultiKey,
  markedList,
  markedMatchesKey,
  type AnswerOption,
  type SubjectRange,
} from "../utils/answer-key-parse.js";

export type SubjectScore = {
  subject: string;
  from: number;
  to: number;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
};

export type SheetScore = {
  subjectScores: SubjectScore[];
  unattempted: number[];
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
};

export type QuestionResult = "correct" | "wrong" | "blank" | "unkeyed";

/** More than one filled bubble is wrong unless the key itself has two options or is ADD. */
export function questionResult(
  marked: AnswerOption | AnswerOption[] | string | undefined,
  expected: Parameters<typeof markedMatchesKey>[1] | undefined,
): QuestionResult {
  const filled = markedList(marked);
  if (filled.length === 0) return "blank";
  if (!expected) return "unkeyed";
  if (isBonusKey(expected)) return "correct";
  if (filled.length > 1 && !isMultiKey(expected)) return "wrong";
  return markedMatchesKey(filled, expected) ? "correct" : "wrong";
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
): SheetScore {
  const key = asAnswers(keyAnswers);
  const ranges = asSubjectRanges(rangesInput);
  const keyedLast = Math.max(0, ...Object.keys(key).map(Number).filter(Number.isFinite));
  const fallbackTo = keyedLast || 100;
  const bands: SubjectRange[] =
    ranges.length > 0 ? ranges : [{ subject: "TOTAL", from: 1, to: fallbackTo, maxMarks: fallbackTo * marks.correctMarks }];
  const correctMarks = marks.correctMarks;
  const wrongMarks = marks.wrongMarks;
  const subjectScores = bands.map((range) => {
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    let total = 0;
    for (let question = range.from; question <= range.to; question += 1) {
      const result = questionResult(marked[String(question)], key[String(question)]);
      if (result === "blank") blank += 1;
      else if (result === "correct") {
        correct += 1;
        total += correctMarks;
      } else if (result === "wrong") {
        wrong += 1;
        total -= wrongMarks;
      }
    }
    const questions = range.to - range.from + 1;
    return {
      subject: range.subject,
      from: range.from,
      to: range.to,
      correct,
      wrong,
      blank,
      total,
      maxTotal: range.maxMarks || questions * correctMarks,
    };
  });

  const first = Math.min(...bands.map((range) => range.from));
  const last = Math.max(...bands.map((range) => range.to));
  const unattempted: number[] = [];
  for (let question = first; question <= last; question += 1) {
    if (markedList(marked[String(question)]).length === 0) unattempted.push(question);
  }

  return {
    subjectScores,
    unattempted,
    correct: subjectScores.reduce((sum, row) => sum + row.correct, 0),
    wrong: subjectScores.reduce((sum, row) => sum + row.wrong, 0),
    blank: subjectScores.reduce((sum, row) => sum + row.blank, 0),
    total: subjectScores.reduce((sum, row) => sum + row.total, 0),
    maxTotal: subjectScores.reduce((sum, row) => sum + row.maxTotal, 0),
  };
}
