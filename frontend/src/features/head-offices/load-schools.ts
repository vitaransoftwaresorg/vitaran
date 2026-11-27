import "server-only";
import { listSchools } from "@/services/schools";
import type { SchoolSummary } from "@/types/school";

/** All schools for the head-office picker (paginates past the API pageSize cap). */
export async function listAllSchoolsForOfficePicker(): Promise<SchoolSummary[]> {
  const first = await listSchools({ page: 1, pageSize: 100 });
  const items = [...first.items];
  const totalPages = first.pagination.totalPages;
  for (let page = 2; page <= totalPages; page++) {
    const next = await listSchools({ page, pageSize: 100 });
    items.push(...next.items);
  }
  return items;
}
