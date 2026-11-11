import type { ListFilters } from "@/services/list-filters";
import { SCHOOL_TYPES, type SchoolType } from "@/types/school";
import { TEST_NUMBERS } from "./constants";

/** URL search params used by the admin list filters. */
export const FILTER_PARAMS = {
  test: "test",
  program: "program",
  type: "type",
  school: "school",
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the filters from the page's search params, ignoring anything invalid. */
export function parseListFilters(
  params: Record<string, string | string[] | undefined>,
  options?: { programCodes?: string[] },
): ListFilters {
  const test = Number(first(params[FILTER_PARAMS.test]));
  const rawType = first(params[FILTER_PARAMS.type]);
  const type = SCHOOL_TYPES.includes(rawType as SchoolType) ? (rawType as SchoolType) : undefined;
  const school = first(params[FILTER_PARAMS.school]);
  const program = first(params[FILTER_PARAMS.program])?.trim();
  const allowed = options?.programCodes;
  return {
    testNumber: TEST_NUMBERS.includes(test) ? test : undefined,
    program: program && (!allowed || allowed.includes(program)) ? program : undefined,
    type,
    // Results drive nests Regular schools under a program; answer keys only set school for Customized.
    schoolId: school && UUID.test(school) ? school : undefined,
  };
}

export const hasListFilters = ({ testNumber, program, type, schoolId }: ListFilters) =>
  Boolean(testNumber || program || type || schoolId);
