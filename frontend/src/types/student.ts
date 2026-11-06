export type StudentStatus = "ACTIVE" | "INACTIVE";

export type Student = {
  id: string;
  schoolId: string;
  schoolName: string;
  name: string;
  rollNo: string;
  email: string | null;
  parentName: string | null;
  parentPhone: string | null;
  programId: string;
  programCode: string;
  programName: string;
  classLevel: number;
  sectionId: string | null;
  /** Whole class (no section row) is returned as "A". */
  sectionName: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
};

export type StudentDetail = Student & {
  school: { id: string; name: string; code: string };
};

export type StudentListResult = {
  items: Student[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type CreateStudentInput = {
  name: string;
  rollNo: string;
  email?: string | null;
  parentName: string;
  parentPhone: string;
  programId: string;
  classLevel: number;
  sectionId?: string | null;
  status?: StudentStatus;
};

export type BulkStudentRowInput = {
  name: string;
  rollNo: string;
  email?: string | null;
  parentName: string;
  parentPhone: string;
};

export type CreateStudentsBulkInput = {
  programId: string;
  classLevel: number;
  sectionId?: string | null;
  students: BulkStudentRowInput[];
};

export type CreateStudentsBulkResult = {
  items: StudentDetail[];
  count: number;
};

export type UpdateStudentInput = Partial<CreateStudentInput> & {
  status?: StudentStatus;
};

/** One saved test for a student, matched by registration number. */
export type StudentTestResult = {
  resultSetId: string;
  testNumber: number;
  testId: string | null;
  programName: string;
  classLevel: number;
  published: boolean;
  date: string;
  subjects: Array<{ label: string; marks: number | null; max: number | null; percentage: number | null }>;
  total: number | null;
  totalMax: number | null;
  percentage: number | null;
  classRank: number | null;
  sectionRank: number | null;
};
