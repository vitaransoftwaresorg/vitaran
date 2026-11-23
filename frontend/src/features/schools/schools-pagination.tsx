import { ListPagination } from "@/components/shared/list-pagination";
import type { Pagination as PaginationMeta } from "@/types/school";

type SchoolsPaginationProps = {
  pagination: PaginationMeta;
  searchParams: Record<string, string | undefined>;
};

export function SchoolsPagination({ pagination, searchParams }: SchoolsPaginationProps) {
  return (
    <ListPagination
      pagination={pagination}
      basePath="/admin/schools"
      searchParams={searchParams}
      noun="schools"
      pageSizeOptions={[10, 20, 50, 100]}
    />
  );
}
