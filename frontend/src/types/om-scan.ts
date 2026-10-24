import type { Subject } from "@/types/school";

export type OmSubjectScore = {
  subject: Subject;
  from: number;
  to: number;
  correct: number;
  wrong: number;
  blank: number;
  partial?: number;
  total: number;
  maxTotal: number;
};

export type OmScan = {
  id: string;
  testId: string;
  testNumber: number;
  rollNo: string;
  /** Class teacher has published this class's results for this test. */
  released: boolean;
  examDate: string | null;
  student: {
    id: string;
    name: string;
    rollNo: string;
    classLevel: number;
    sectionName: string | null;
    programCode: string;
    programName: string;
  };
  answers: Record<string, string>;
  flags: Array<{ question: number; reason: string }>;
  subjectScores: OmSubjectScore[];
  correct: number;
  wrong: number;
  blank: number;
  partial?: number;
  total: number;
  maxTotal: number;
  rank: number | null;
  classSize: number | null;
  view: "class" | "subject";
  fileName: string;
  createdAt: string;
  updatedAt: string;
  review?: OmQuestionReview[];
};

export type OmQuestionReview = {
  question: number;
  marked: string | null;
  key: string | null;
  result: "OK" | "PARTIAL" | "WRONG" | "BLANK" | "INVALID" | "BONUS";
  marks: number;
  explanation: string;
  subject: Subject | null;
};

export type OmScanResult = {
  scan: OmScan;
  read: {
    rollNo: string;
    testId: string;
    studentName: string;
    examDate: string;
    markCount: number;
    flags: Array<{ question: number; reason: string }>;
  };
};

export type OmResultRelease = {
  testId: string;
  testNumber: number;
  programId: string;
  programName: string;
  classLevel: number;
  sectionId: string | null;
  sectionName: string | null;
  scanned: number;
  published: boolean;
  publishedAt: string | null;
};

export type OmScanIdentity = { rollNo: string; testId: string; examDate: string };

export type OmScanTarget = {
  student: {
    name: string;
    rollNo: string;
    classLevel: number;
    sectionName: string | null;
    programCode: string;
    programName: string;
  };
  test: {
    testId: string;
    testNumber: number;
    classLevel: number;
    programCode: string;
    questions: number;
  };
  previous: { total: number; maxTotal: number; scannedAt: string } | null;
};
