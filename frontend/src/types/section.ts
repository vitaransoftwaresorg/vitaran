import type { TeacherStatus } from "./teacher";

export type SectionClassTeacher = {
  id: string;
  teacherId: string;
  name: string;
  email: string;
  status: TeacherStatus;
};

export type ExamPattern = "MPCB" | "PCB" | "MPC";

export type SchoolSection = {
  id: string;
  schoolId: string;
  classLevel: number;
  name: string;
  programId: string;
  programCode: string;
  programName: string;
  year: number;
  studentCount: number;
  examPattern: ExamPattern | string;
  classTeacher: SectionClassTeacher | null;
  createdAt: string;
  updatedAt: string;
};

export type WholeClass = {
  id: string;
  schoolId: string;
  classLevel: number;
  programId: string;
  programCode: string;
  programName: string;
  year: number;
  studentCount: number;
  examPattern: ExamPattern | string;
  createdAt: string;
  updatedAt: string;
};

export type ClassOrganization = {
  wholeClasses: WholeClass[];
  sections: SchoolSection[];
};

export type SectionStrength = {
  studentStrength: number | null;
  used: number;
  remaining: number | null;
};

export type SectionInput = {
  classLevel: number;
  /** Blank / omit = Section A. */
  name?: string | null;
  programId: string;
  /** Legacy — unused; school seat limit is the only enrollment cap. */
  studentCount?: number;
  /** OMR subject pattern for this class/section — required when creating. */
  examPattern: ExamPattern;
  classTeacherId?: string | null;
  applyTeacherToClass?: boolean;
};

export type CreateClassOrgResult =
  | { kind: "class"; class: WholeClass }
  | { kind: "section"; section: SchoolSection };
