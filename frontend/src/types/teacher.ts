import type { SchoolType, Subject } from "./school";
import type { SchoolProgramOffering } from "./program";

export const TEACHER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type TeacherStatus = (typeof TEACHER_STATUSES)[number];

export type TeacherAssignment = {
  programId: string;
  programCode: string;
  programName: string;
  classLevel: number;
  subject: Subject;
};

export type TeacherSchoolRef = {
  id: string;
  name: string;
  code: string;
  type: SchoolType;
};

export type Teacher = {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  phone: string;
  status: TeacherStatus;
  assignments: TeacherAssignment[];
  school: TeacherSchoolRef;
  createdAt: string;
  updatedAt: string;
};

export type TeacherDetail = Teacher & { password: string };

export type ClassTeacherSection = {
  kind: "class" | "section";
  sectionId?: string;
  sectionName?: string;
  classLevel: number;
  programId: string;
  programCode: string;
  programName: string;
};

export type TeacherAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: TeacherStatus;
  schoolId: string;
  assignments: TeacherAssignment[];
  classTeacherSections: ClassTeacherSection[];
  school: {
    id: string;
    name: string;
    code: string;
    type: SchoolType;
    schoolPrograms: SchoolProgramOffering[];
    programCodes: string[];
  };
};

export type TeacherAssignmentInput = {
  programId: string;
  classLevel: number;
  subject: Subject;
};

export type ClassTeacherSlotInput =
  | { kind: "class"; programId: string; classLevel: number }
  | { kind: "section"; sectionId: string };

export type TeacherInput = {
  name: string;
  email: string;
  phone: string;
  status: TeacherStatus;
  assignments: TeacherAssignmentInput[];
  classTeacherFor?: ClassTeacherSlotInput[];
  password?: string;
};

export type ClassTeacherSlot =
  | {
      kind: "class";
      programId: string;
      programCode: string;
      programName: string;
      classLevel: number;
      teacherId: string;
      teacherName: string;
    }
  | {
      kind: "section";
      sectionId: string;
      programId: string;
      programCode: string;
      programName: string;
      classLevel: number;
      sectionName: string;
      teacherId: string;
      teacherName: string;
    };

export type TeacherList = {
  items: Teacher[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type SchoolDashboardStats = {
  schoolName: string;
  schoolCode: string;
  teachers: { total: number; active: number };
  answerKeys: number;
  results: number;
  programs: number;
  subjects: number;
  classes: number;
  programLabels: { code: string; name: string }[];
  subjectIds: string[];
};

export type TeacherDashboardStats = {
  name: string;
  schoolName: string;
  schoolCode: string;
  students: number;
  answerKeys: number;
  results: number;
  classLevels: number[];
  subjects: string[];
  classTeacherLabels: string[];
};

export type ClassTeacherRow = {
  id: string;
  teacherId: string;
  name: string;
  email: string;
  status: TeacherStatus;
};
