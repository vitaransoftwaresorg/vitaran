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

export function scoreSheet(
  marked: Record<string, AnswerOption | AnswerOption[] | string>,
  keyAnswers: unknown,
  rangesInput: unknown,
  marks: { correctMarks: number; wrongMarks: number },
): SheetScore {
  const key = asAnswers(keyAnswers);
  const ranges = asSubjectRanges(rangesInput);
  const bands: SubjectRange[] = ranges.length > 0 ? ranges : [{ subject: "TOTAL", from: 1, to: 100, maxMarks: 100 }];
  const correctMarks = marks.correctMarks;
  const wrongMarks = marks.wrongMarks;
  const subjectScores = bands.map((range) => {
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    let total = 0;
    for (let question = range.from; question <= range.to; question += 1) {
      const expected = key[String(question)];
      const filled = markedList(marked[String(question)]);
      if (filled.length === 0) {
        blank += 1;
        continue;
      }
      if (!expected) continue;
      if (filled.length > 1 && !isMultiKey(expected) && !isBonusKey(expected)) {
        wrong += 1;
        total -= wrongMarks;
        continue;
      }
      if (isBonusKey(expected) || markedMatchesKey(filled, expected)) {
        correct += 1;
        total += correctMarks;
      } else {
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
