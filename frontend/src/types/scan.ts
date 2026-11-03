export type ScanSubjectScore = {
  subject: string;
  from: number;
  to: number;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
};

export type OmScan = {
  id: string;
  previewId?: string;
  testId: string;
  testNumber: number;
  rollNo: string;
  examDate: string | null;
  student: {
    id: string;
    name: string;
    rollNo: string;
    classLevel: number;
    sectionName: string | null;
    programName: string;
    schoolName: string;
  };
  flags: Array<{ question: number; reason: string }>;
  subjectScores: ScanSubjectScore[];
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
  confidence: number;
  fileName: string;
  sheetImage?: string;
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  keyAnswers?: Record<string, string>;
  createdAt: string;
};

export type ScanPreview = { previewId: string; scan: OmScan };
