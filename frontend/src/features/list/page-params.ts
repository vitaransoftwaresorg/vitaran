/** Shared URL helpers for list page / pageSize. */

export const DEFAULT_TEACHERS_PAGE_SIZE = 20;
export const DEFAULT_STUDENTS_PAGE_SIZE = 50;

export function parseListPage(raw: string | string[] | undefined, fallback = 1) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : fallback;
}

export function parseListPageSize(
  raw: string | string[] | undefined,
  fallback: number,
  max = 100,
) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const size = Number(value);
  return Number.isInteger(size) && size >= 1 && size <= max ? size : fallback;
}
