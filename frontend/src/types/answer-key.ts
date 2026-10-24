import type { PdfDocument, Publishable, SchoolRef } from "@/types/document";
import type { Program, SchoolType, Subject } from "@/types/school";

export type AnswerOption = "A" | "B" | "C" | "D";
export type KeyPattern = "MAINS" | "ADVANCED";
/** ADD | single A–D | mains OR ("B/C") | advanced AND ("A,C,D"). */
export type KeyAnswer = string;

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

export function keyOptions(answer: KeyAnswer | undefined): AnswerOption[] {
  if (!answer || answer === "ADD") return [];
  return OPTIONS.filter((option) => answer.split(/[,/]/).includes(option));
}

export function isBonusKey(answer: KeyAnswer | undefined) {
  return answer === "ADD";
}

export function formatKeyAnswer(options: AnswerOption[], pattern: KeyPattern): KeyAnswer {
  const unique = OPTIONS.filter((option) => options.includes(option));
  if (unique.length <= 1) return unique[0] ?? "";
  return pattern === "ADVANCED" ? unique.join(",") : unique.join("/");
}

export function rewriteKeyAnswers(answers: Record<string, KeyAnswer>, pattern: KeyPattern) {
  return Object.fromEntries(
    Object.entries(answers).map(([question, value]) => {
      if (value === "ADD") return [question, value];
      const options = keyOptions(value);
      return [question, options.length ? formatKeyAnswer(options, pattern) : value];
    }),
  );
}

export type SubjectRange = {
  subject: Subject;
  from: number;
  to: number;
  maxMarks: number;
};

export type AnswerCorrection = {
  question: number;
  from: KeyAnswer | null;
  to: KeyAnswer | null;
  explanation: string;
};

export type AnswerKey = PdfDocument & Publishable & {
  type: SchoolType;
  pattern?: KeyPattern;
  /** Freeform test ID shared with results. */
  testId: string;
  /** Set only for customized answer keys. */
  school: SchoolRef | null;
  answers?: Record<string, KeyAnswer>;
  explanations?: Record<string, string>;
  printedAnswers?: Record<string, KeyAnswer>;
  printedExplanations?: Record<string, string>;
  corrections?: AnswerCorrection[];
  subjectRanges?: SubjectRange[];
  answerCount?: number;
  correctionCount?: number;
};

export type AnswerKeyDetail = AnswerKey & {
  answers: Record<string, KeyAnswer>;
  explanations: Record<string, string>;
  printedAnswers: Record<string, KeyAnswer>;
  printedExplanations: Record<string, string>;
  corrections: AnswerCorrection[];
  subjectRanges: SubjectRange[];
  answerCount: number;
  correctionCount: number;
};

export type AnswerKeyInput = {
  program: Program;
  type: SchoolType;
  schoolId?: string;
  testId: string;
  testNumber: number;
  classLevel: number;
  /** Required on upload; on update, only sent to replace the PDF. */
  file?: File;
};

/** Distinct tests for a school, derived from its answer keys (admin results upload). */
export type SchoolTestOption = {
  testId: string;
  testNumber: number;
  programs: Array<{
    code: Program;
    name: string;
    classLevels: number[];
  }>;
};
