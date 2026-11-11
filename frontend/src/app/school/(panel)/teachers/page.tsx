import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { setSchoolTeacherStatusAction } from "@/features/teachers/actions";
import { TeachersTable } from "@/features/teachers/teachers-table";
import { listSchoolTeachers } from "@/services/teachers";
import { cn } from "@/lib/utils";

export default async function SchoolTeachersPage() {
  const { items, pagination } = await listSchoolTeachers({ pageSize: 50 });

  return (
    <>
      <PageHeader
        title="Teachers"
        count={pagination.total}
        description="Create teachers and assign the classes and subjects they can access."
        actions={
          <Link href="/school/teachers/new" className={cn(buttonVariants())}>
            <Plus />
            Add teacher
          </Link>
        }
      />
      <TeachersTable
        teachers={items}
        editHrefBase="/school/teachers"
        onToggleStatus={setSchoolTeacherStatusAction}
      />
    </>
  );
}
