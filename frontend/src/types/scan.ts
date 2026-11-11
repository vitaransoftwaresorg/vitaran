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

/** Answer key(s) behind an entered test ID. */
export type TestIdCheck = {
  testId: string;
  keys: Array<{ testNumber: number; classLevel: number; programCode: string; programName: string }>;
};

/** A saved OMR in a class, for the results table's OMR column. */
export type ClassScan = {
  id: string;
  rollNo: string;
  studentName: string;
  total: number;
  maxTotal: number;
  updatedAt: string;
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

/** A PDF being read on the server, one student sheet per page. */
export type PdfBatchSummary = {
  batchId: string;
  fileName: string;
  testId: string;
  pageCount: number;
  done: number;
  finished: boolean;
};

export type PdfBatchStatus = PdfBatchSummary & {
  items: Array<{ page: number; error?: string; duplicateOf?: number; hasImage?: boolean; preview?: ScanPreview }>;
};
