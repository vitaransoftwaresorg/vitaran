import type { SchoolType } from "@/types/school";

/** Admin list filters shared by answer keys and results. */
export type ListFilters = {
  testNumber?: number;
  /** Catalog program code (answer keys). */
  program?: string;
  type?: SchoolType;
  schoolId?: string;
  limit?: number;
};

export function listFiltersQuery({ testNumber, program, type, schoolId, limit }: ListFilters = {}) {
  const query = new URLSearchParams();
  if (testNumber) query.set("testNumber", String(testNumber));
  if (program) query.set("program", program);
  if (type) query.set("type", type);
  if (schoolId) query.set("schoolId", schoolId);
  if (limit) query.set("limit", String(limit));
  return query.size > 0 ? `?${query}` : "";
}
