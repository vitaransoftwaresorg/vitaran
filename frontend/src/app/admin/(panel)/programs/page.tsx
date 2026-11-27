import Link from "next/link";
import { PageHeader } from "@/features/admin/page-header";
import { ProgramsTable } from "@/features/programs/programs-table";
import { buttonVariants } from "@/components/ui/button";
import { listAdminPrograms } from "@/services/programs";
import { cn } from "@/lib/utils";

export default async function AdminProgramsPage() {
  const programs = await listAdminPrograms();

  return (
    <>
      <PageHeader
        description="Regular catalog programs. Customized schools enrol in these — they do not get their own program row."
        actions={
          <Link href="/admin/programs/new" className={cn(buttonVariants())}>
            Add program
          </Link>
        }
      />
      <ProgramsTable programs={programs} />
    </>
  );
}
