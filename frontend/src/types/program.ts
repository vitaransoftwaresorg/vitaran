import type { SchoolType, Subject } from "./school";

export type LearningProgram = {
  id: string;
  code: string;
  name: string;
  type: SchoolType;
  year: number;
  classFrom: number;
  classTo: number;
  subjects: Subject[];
  createdAt: string;
  updatedAt: string;
};

export type LearningProgramInput = {
  name: string;
  type: SchoolType;
  year: number;
  classFrom: number;
  classTo: number;
  subjects: Subject[];
  code: string;
};

export type SchoolProgramClass = {
  classLevel: number;
  subjects: Subject[];
};

export type SchoolProgramOffering = {
  programId: string;
  programCode: string;
  programName: string;
  type?: SchoolType;
  year: number;
  classFrom: number;
  classTo: number;
  catalogSubjects: Subject[];
  classes: SchoolProgramClass[];
};
