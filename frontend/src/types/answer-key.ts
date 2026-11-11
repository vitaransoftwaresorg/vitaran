import type { PdfDocument, Publishable, SchoolRef } from "@/types/document";
import type { Program, SchoolType, Subject } from "@/types/school";

export type AnswerOption = "A" | "B" | "C" | "D";
/** One option, two options ("B/C"), or a bonus ("ADD"). */
export type KeyAnswer = AnswerOption | `${AnswerOption}/${AnswerOption}` | "ADD";

export function keyOptions(answer: KeyAnswer | undefined): AnswerOption[] {
  if (!answer || answer === "ADD") return [];
  return answer.split("/").filter((part): part is AnswerOption => part === "A" || part === "B" || part === "C" || part === "D");
}

export function isBonusKey(answer: KeyAnswer | undefined) {
  return answer === "ADD";
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
  /** Marks for a matching option. */
  correctMarks?: number;
  /** Marks deducted for a wrong option. */
  wrongMarks?: number;
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
  correctMarks: number;
  wrongMarks: number;
  answerCount: number;
  correctionCount: number;
};

export type AnswerKeyInput = {
  program: Program;
  type: SchoolType;
  schoolId?: string;
  testId?: string;
  testNumber: number;
  classLevel: number;
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

/** Whether a 6-digit test ID is free for a new or edited answer key. */
export type TestIdAvailability = {
  testId: string;
  available: boolean;
  usedBy: {
    id: string;
    program: string;
    type: "REGULAR" | "CUSTOMIZED";
    classLevel: number;
    testNumber: number;
    school: string | null;
  } | null;
};
