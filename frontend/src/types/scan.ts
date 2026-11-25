export type ScanSubjectScore = {
  subject: string;
  from: number;
  to: number;
  correct: number;
  /** Partial-credit MCQ (some but not all key options). */
  partial?: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
};

/** Drop float residue from partial-credit marks (286.66700000000003 → 286.667). */
export function roundMarks(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(3));
}

export function formatMarks(value: number) {
  return String(roundMarks(value));
}

/** Answer key(s) behind an entered test ID. */
export type TestIdCheck = {
  testId: string;
  keys: Array<{
    testNumber: number;
    classLevel: number;
    programCode: string;
    programName: string;
    /** Platform or school name that owns this key. */
    owner?: string;
    sectionName?: string | null;
  }>;
};

/** A saved OMR in a class, for the results table's OMR column. */
export type ClassScan = {
  id: string;
  rollNo: string;
  studentName: string;
  /** Test ID this sheet was evaluated against. */
  testId: string;
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
  partial?: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal: number;
  confidence: number;
  fileName: string;
  sheetImage?: string;
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  keyAnswers?: Record<string, string>;
  /** Normal vs MCQ ranges from the answer key (partial credit only for MCQ). */
  keyTypeRanges?: Array<{
    from: number;
    to: number;
    type: "normal" | "mcq";
    correctMarks: number;
    wrongMarks: number;
  }>;
  createdAt: string;
};

export type ScanPreview = {
  previewId: string;
  scan: OmScan;
  /** PDF page this sheet came from (1-based); omitted for camera / single uploads. */
  pdfPage?: number;
};

/** A PDF being read on the server, one student sheet per page. */
export type PdfBatchSummary = {
  batchId: string;
  fileName: string;
  testId: string;
  examPattern?: string;
  pageCount: number;
  done: number;
  finished: boolean;
};

export type PdfBatchStatusItem = {
  page: number;
  error?: string;
  duplicateOf?: number;
  rollNo?: string;
  demoted?: boolean;
  hasImage?: boolean;
  preview?: ScanPreview;
};

export type PdfBatchStatus = PdfBatchSummary & {
  items: PdfBatchStatusItem[];
  /** Earlier pages pulled as previews, then demoted when a later page shared their reg. */
  demotions?: PdfBatchStatusItem[];
};
