"use client";

import { useRouter } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pagination as PaginationMeta } from "@/types/school";

export const LIST_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

type ListPaginationProps = {
  pagination: PaginationMeta;
  /** Path without query, e.g. `/admin/schools` or `/admin/teachers`. */
  basePath: string;
  /** Current query keys to keep (except page / pageSize, which are managed here). */
  searchParams?: Record<string, string | number | undefined | null>;
  /** Noun in “Showing X–Y of Z {noun}”. */
  noun?: string;
  pageSizeOptions?: readonly number[];
};

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  return sorted.flatMap((page, index) =>
    index > 0 && page - (sorted[index - 1] ?? 0) > 1 ? (["ellipsis", page] as const) : [page],
  );
}

function buildHref(
  basePath: string,
  searchParams: ListPaginationProps["searchParams"],
  page: number,
  pageSize: number,
  defaultPageSize: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value == null || value === "" || key === "page" || key === "pageSize") continue;
    params.set(key, String(value));
  }
  if (page > 1) params.set("page", String(page));
  if (pageSize !== defaultPageSize) params.set("pageSize", String(pageSize));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Server-driven page + page-size controls for list tables. */
export function ListPagination({
  pagination,
  basePath,
  searchParams,
  noun = "results",
  pageSizeOptions = LIST_PAGE_SIZE_OPTIONS,
}: ListPaginationProps) {
  const router = useRouter();
  const { page, pageSize, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const defaultPageSize = pageSizeOptions[0] ?? 10;
  const hrefFor = (target: number) =>
    buildHref(basePath, searchParams, target, pageSize, defaultPageSize);

  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{from}</span>–
          <span className="font-medium text-foreground">{to}</span> of{" "}
          <span className="font-medium text-foreground">{total}</span> {noun}
        </p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              const next = Number(value);
              if (!Number.isFinite(next) || next <= 0) return;
              router.push(buildHref(basePath, searchParams, 1, next, defaultPageSize));
            }}
          >
            <SelectTrigger size="sm" className="min-w-18 tabular-nums">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {totalPages > 1 ? (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={hrefFor(Math.max(1, page - 1))}
                scroll={false}
                aria-disabled={page <= 1}
                className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            {getPageNumbers(page, totalPages).map((item, index) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink href={hrefFor(item)} scroll={false} isActive={item === page}>
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href={hrefFor(Math.min(totalPages, page + 1))}
                scroll={false}
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
