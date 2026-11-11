import type { Metadata } from "next";
import Link from "next/link";
import { Plus, School, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/features/admin/page-header";
import { schoolListParamsSchema } from "@/features/schools/schema";
import { SchoolsFilters } from "@/features/schools/schools-filters";
import { SchoolsPagination } from "@/features/schools/schools-pagination";
import { SchoolsTable } from "@/features/schools/schools-table";
import { listSchools } from "@/services/schools";

export const metadata: Metadata = { title: "Schools" };

export default async function SchoolsPage({ searchParams }: PageProps<"/admin/schools">) {
  const raw = await searchParams;
  const params = schoolListParamsSchema.parse({
    search: raw.search,
    status: raw.status,
    board: raw.board,
    type: raw.type,
    page: raw.page,
    pageSize: raw.pageSize,
  });
  const { items, pagination } = await listSchools(params);
  const filtered = Boolean(params.search || params.status || params.board || params.type);

  const registerButton = (
    <Link href="/admin/schools/new" className={buttonVariants()}>
      <Plus />
      Register school
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Schools"
        description="All partner schools registered with Vitaran Learning."
        count={pagination.total}
        actions={registerButton}
      />

      <div className="mb-4">
        <SchoolsFilters />
      </div>

      <Card className="gap-0 py-0">
        {items.length > 0 ? (
          <>
            <SchoolsTable schools={items} />
            <SchoolsPagination
              pagination={pagination}
              searchParams={{
                search: params.search,
                status: params.status,
                board: params.board,
                type: params.type,
              }}
            />
          </>
        ) : (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {filtered ? <SearchX /> : <School />}
              </EmptyMedia>
              <EmptyTitle>{filtered ? "No matching schools" : "No schools yet"}</EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? "Try a different search term or clear the filters."
                  : "Register your first partner school to get started."}
              </EmptyDescription>
            </EmptyHeader>
            {!filtered && <EmptyContent>{registerButton}</EmptyContent>}
          </Empty>
        )}
      </Card>
    </>
  );
}
