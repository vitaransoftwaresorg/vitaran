import type { SchoolRef } from "@/types/document";

/** Customized school picker row — offerings drive the Class dropdown. */
export type AnswerKeySchoolOption = SchoolRef & {
  offerings: Array<{
    code: string;
    name: string;
    classLevels: number[];
  }>;
};
