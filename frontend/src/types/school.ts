import type { SchoolProgramOffering } from "./program";

export const SCHOOL_BOARDS = [
  "CBSE",
  "ICSE",
  "STATE",
  "IB",
  "IGCSE",
  "OTHER",
] as const;

export const SCHOOL_TYPES = ["REGULAR", "CUSTOMIZED"] as const;

export const SCHOOL_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type SchoolBoard = (typeof SCHOOL_BOARDS)[number];
export type SchoolType = (typeof SCHOOL_TYPES)[number];
export type SchoolStatus = (typeof SCHOOL_STATUSES)[number];
/** Catalog subject code on a program (e.g. MATHEMATICS, ENGLISH). */
export type Subject = string;

export function toSubjectCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}
/** Catalog program code from LearningProgram.code (dynamic). */
export type Program = string;

/** List / dashboard row — identity and contact, no programs or credentials. */
export type SchoolSummary = {
  id: string;
  code: string;
  name: string;
  board: SchoolBoard;
  type: SchoolType;
  status: SchoolStatus;
  contactName: string;
  contactEmail: string;
  city: string;
  state: string;
  createdAt: string;
  hasLogo?: boolean;
};

/** Dropdown / filter picker — enrolled program codes and class levels only. */
export type SchoolOption = {
  id: string;
  name: string;
  code: string;
  type: SchoolType;
  programs: string[];
  programLabels: Record<string, string>;
  offerings: { code: string; name: string; classLevels: number[] }[];
};

export type School = SchoolSummary & {
  schoolPrograms: SchoolProgramOffering[];
  programCodes: string[];
  principalName: string | null;
  contactPhone: string;
  addressLine: string;
  pincode: string;
  studentStrength: number | null;
  notes: string | null;
  accountEmail: string | null;
  accountPhone: string | null;
  hasLogo: boolean;
  updatedAt: string;
};

export type SchoolAccount = Omit<School, "notes">;

export type SchoolDetail = School & { password: string | null };

export type SchoolProgramInput = {
  programId: string;
  classes: { classLevel: number; subjects: Subject[] }[];
};

export type CustomProgramInput = {
  name: string;
  classes: { classLevel: number; subjects: Subject[] }[];
};

export type SchoolInput = Omit<
  School,
  | "id"
  | "accountEmail"
  | "accountPhone"
  | "createdAt"
  | "updatedAt"
  | "schoolPrograms"
  | "programCodes"
  | "hasLogo"
> & {
  /** School ID shown as VLS-XXXX (e.g. VLS-0018). */
  code: string;
  accountEmail: string;
  accountPhone: string;
  programs: SchoolProgramInput[];
  /** Customized schools: create/update this catalog program instead of picking one. */
  customProgram?: CustomProgramInput;
  password?: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SchoolList = {
  items: SchoolSummary[];
  pagination: Pagination;
};

export type SchoolStats = {
  total: number;
  active: number;
  inactive: number;
  regular: number;
  customized: number;
  byBoard: { board: SchoolBoard; count: number }[];
  byProgram: { program: string; programName: string; count: number }[];
  recent: SchoolSummary[];
};

export type AdminDashboard = {
  schools: SchoolStats;
  answerKeys: { total: number; published: number };
  results: { total: number; published: number };
};
