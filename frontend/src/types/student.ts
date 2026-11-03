export type StudentStatus = "ACTIVE" | "INACTIVE";

export type Student = {
  id: string;
  schoolId: string;
  schoolName: string;
  name: string;
  rollNo: string;
  email: string | null;
  programId: string;
  programCode: string;
  programName: string;
  classLevel: number;
  sectionId: string | null;
  sectionName: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
};

export type StudentDetail = Student & {
  password: string;
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
  programId: string;
  classLevel: number;
  sectionId?: string | null;
  status?: StudentStatus;
  password?: string;
};

export type UpdateStudentInput = Partial<CreateStudentInput> & {
  status?: StudentStatus;
};
