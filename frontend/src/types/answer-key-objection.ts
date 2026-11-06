import type { AnswerOption, KeyAnswer } from "@/types/answer-key";

export type AnswerKeyObjectionStatus = "OPEN" | "RESOLVED" | "REJECTED";
export type AnswerKeyObjectionRaisedBy = "SCHOOL" | "TEACHER";

/** Claimed correct answer: letters, ADD bonus, or NONE (no right answer). */
export type ProposedObjectionAnswer =
  | AnswerOption
  | `${AnswerOption}/${AnswerOption}`
  | "ADD"
  | "NONE"
  | KeyAnswer;

export type AnswerKeyObjection = {
  id: string;
  answerKeyId: string;
  schoolId: string;
  school: { id: string; name: string; code: string };
  raisedBy: AnswerKeyObjectionRaisedBy;
  teacherId: string | null;
  teacher: { id: string; name: string; email: string } | null;
  questionNumber: number | null;
  proposedAnswer: ProposedObjectionAnswer | null;
  message: string;
  /** A photo was attached; load it from the portal's objection image route. */
  hasImage: boolean;
  status: AnswerKeyObjectionStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  answerKey: {
    id: string;
    programCode: string;
    testId: string;
    testNumber: number;
    classLevel: number;
    type: string;
  };
};

export type RaiseAnswerKeyObjectionInput = {
  message: string;
  questionNumber?: number | null;
  proposedAnswer?: ProposedObjectionAnswer | null;
};

export type ResolveAnswerKeyObjectionInput = {
  status: "RESOLVED" | "REJECTED";
  resolutionNote: string;
};

export type ResolveAnswerKeyObjectionResult = AnswerKeyObjection & {
  /** True when admin accept applied the proposed option/ADD to the live key. */
  keyUpdated?: boolean;
};

export type AnswerKeyObjectionList = {
  items: AnswerKeyObjection[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
