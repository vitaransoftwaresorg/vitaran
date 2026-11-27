import type { PdfDocument, Publishable, SchoolRef } from "@/types/document";
import type { Program, SchoolType, Subject } from "@/types/school";

export type AnswerOption = "A" | "B" | "C" | "D";
/** One or more options ("A", "B/C", "A/B/C/D"), or a bonus ("ADD"). */
export type KeyAnswer =
  | AnswerOption
  | `${AnswerOption}/${AnswerOption}`
  | `${AnswerOption}/${AnswerOption}/${AnswerOption}`
  | `${AnswerOption}/${AnswerOption}/${AnswerOption}/${AnswerOption}`
  | "ADD";

export function keyOptions(answer: KeyAnswer | undefined): AnswerOption[] {
  if (!answer || answer === "ADD") return [];
  return answer.split("/").filter((part): part is AnswerOption => part === "A" || part === "B" || part === "C" || part === "D");
}

export function isBonusKey(answer: KeyAnswer | undefined) {
  return answer === "ADD";
}

export function isMultiKey(answer: KeyAnswer | undefined) {
  return keyOptions(answer).length > 1;
}

/** Join selected options in A–D order for storage. */
export function joinKeyOptions(options: Iterable<AnswerOption>): KeyAnswer | undefined {
  const picked = new Set(options);
  const ordered = (["A", "B", "C", "D"] as const).filter((option) => picked.has(option));
  if (ordered.length === 0) return undefined;
  return ordered.join("/") as KeyAnswer;
}

/** Parse a cell like "A", "B/C", "BC", "B, C", "ADD", "bonus". */
export function parseKeyAnswer(value: unknown): KeyAnswer | null {
  if (value == null) return null;
  const token = String(value).trim().toUpperCase();
  if (!token) return null;
  if (token === "ADD" || token === "BONUS" || token === "FREE") return "ADD";
  // Keep only A–D letters so "B/C", "BC", "B, C", "B & C" all work.
  const letters = token.replace(/[^A-Z]/g, "");
  if (letters === "ADD" || letters === "BONUS" || letters === "FREE") return "ADD";
  if (!letters || /[^ABCD]/.test(letters)) return null;
  const parts = [...letters].filter(
    (part): part is AnswerOption => part === "A" || part === "B" || part === "C" || part === "D",
  );
  return joinKeyOptions(parts) ?? null;
}

export type SubjectRange = {
  subject: Subject;
  from: number;
  to: number;
  maxMarks: number;
};

/** How options behave for a question range. Unlisted questions are normal. */
export type AnswerKeyQuestionType = "normal" | "mcq";

export type KeyTypeRange = {
  from: number;
  to: number;
  type: AnswerKeyQuestionType;
  /** Overrides key-level correct marks for questions in this range. */
  correctMarks: number;
  /** Overrides key-level wrong marks for questions in this range. */
  wrongMarks: number;
};

/** Fill marks on legacy ranges that only had from/to/type. */
export function normalizeKeyTypeRanges(
  ranges: Array<Partial<KeyTypeRange> & Pick<KeyTypeRange, "from" | "to" | "type">> | null | undefined,
  defaults: { correctMarks: number; wrongMarks: number } = { correctMarks: 4, wrongMarks: 0 },
): KeyTypeRange[] {
  if (!ranges?.length) return [];
  return ranges.map((range) => ({
    from: range.from,
    to: range.to,
    type: range.type,
    correctMarks:
      typeof range.correctMarks === "number" && Number.isInteger(range.correctMarks)
        ? range.correctMarks
        : defaults.correctMarks,
    wrongMarks:
      typeof range.wrongMarks === "number" && Number.isInteger(range.wrongMarks)
        ? range.wrongMarks
        : defaults.wrongMarks,
  }));
}

export const ANSWER_KEY_QUESTION_TYPES: Array<{
  value: AnswerKeyQuestionType;
  label: string;
  hint: string;
}> = [
  {
    value: "normal",
    label: "Normal",
    hint: "Any subset of correct options = full; any wrong option = 0",
  },
  {
    value: "mcq",
    label: "MCQ",
    hint: "Partial per correct option; any wrong option = 0",
  },
];

/** Later overlapping ranges win. */
export function keyTypeRangeForQuestion(
  ranges: KeyTypeRange[],
  question: number,
): KeyTypeRange | undefined {
  let match: KeyTypeRange | undefined;
  for (const range of ranges) {
    if (question >= range.from && question <= range.to) match = range;
  }
  return match;
}

/** Later overlapping ranges win. Unlisted questions stay normal. */
export function keyTypeForQuestion(ranges: KeyTypeRange[], question: number): AnswerKeyQuestionType {
  return keyTypeRangeForQuestion(ranges, question)?.type ?? "normal";
}

/** Range marks take priority; unlisted questions use the key-level defaults. */
export function marksForQuestion(
  ranges: KeyTypeRange[],
  question: number,
  defaults: { correctMarks: number; wrongMarks: number },
): { correctMarks: number; wrongMarks: number; type: AnswerKeyQuestionType } {
  const match = keyTypeRangeForQuestion(ranges, question);
  if (!match) return { ...defaults, type: "normal" };
  return {
    type: match.type,
    correctMarks: match.correctMarks,
    wrongMarks: match.wrongMarks,
  };
}

export type AnswerCorrection = {
  question: number;
  from: KeyAnswer | null;
  to: KeyAnswer | null;
  explanation: string;
};

export type AnswerKey = PdfDocument & Publishable & {
  type: SchoolType;
  /** Catalog display name for `program` when available. */
  programName?: string | null;
  /** Freeform test ID shared with results. */
  testId: string;
  /** Set only for customized / school override keys. */
  school: SchoolRef | null;
  /** Set for section school keys (School Keys admin). */
  sectionId?: string | null;
  section?: { id: string; name: string; classLevel: number } | null;
  answers?: Record<string, KeyAnswer>;
  explanations?: Record<string, string>;
  printedAnswers?: Record<string, KeyAnswer>;
  printedExplanations?: Record<string, string>;
  corrections?: AnswerCorrection[];
  subjectRanges?: SubjectRange[];
  /** Per-range question types; omitted questions are normal. */
  keyTypeRanges?: KeyTypeRange[];
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
  keyTypeRanges: KeyTypeRange[];
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

/** One Class / Section row under a Test folder, with its resolved Test ID. */
export type SchoolClassTestRow = {
  testId: string;
  sectionId: string | null;
  /** Null when every section shares the same Test ID (or the class has no sections). */
  sectionName: string | null;
  /** Section’s own program when sections differ; otherwise the class/slot program. */
  programCode?: string | null;
};

export type SchoolClassTestSlot = {
  testNumber: number;
  classLevel: number;
  programCode: string | null;
  rows: SchoolClassTestRow[];
};

export type SchoolTestsForResults = {
  tests: SchoolTestOption[];
  classSlots: SchoolClassTestSlot[];
};

/** Whether answer-key edits are locked because OMR is scoring this test ID. */
export type AnswerKeyOmrStatus = {
  locked: boolean;
  scanning: boolean;
  regrading: boolean;
  testId: string | null;
  message: string | null;
};

/** Parsed from a PDF for Import — answers only; the PDF is not stored. */
export type ParsedAnswerKeyImport = {
  testId: string | null;
  answers: Record<string, KeyAnswer>;
  explanations: Record<string, string>;
  subjectRanges: SubjectRange[];
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
