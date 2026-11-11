import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { TeachersDrive } from "@/features/teachers/teachers-drive";
import { cn } from "@/lib/utils";
import { listSchoolOptions } from "@/services/schools";
import { listAdminTeachers } from "@/services/teachers";

export const metadata: Metadata = { title: "Teachers" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminTeachersPage({
  searchParams,
}: PageProps<"/admin/teachers">) {
  const query = await searchParams;
  // Prefer `school`; keep `schoolId` for older links (e.g. school profile).
  const schoolIdRaw = first(query.school) ?? first(query.schoolId);
  const schoolId = schoolIdRaw && UUID.test(schoolIdRaw) ? schoolIdRaw : undefined;

  const schools = await listSchoolOptions();
  const school = schoolId ? schools.find((item) => item.id === schoolId) : undefined;

  const teachers = school
    ? (await listAdminTeachers({ schoolId: school.id, pageSize: 200 })).items
    : [];

  return (
    <>
      <PageHeader
        title={school ? school.name : "Teachers"}
        description={
          school
            ? "Teachers at this school"
            : "Open a school to view and manage its teachers"
        }
        count={school ? teachers.length : schools.length}
        actions={
          school ? (
            <Link
              href={`/admin/schools/${school.id}/teachers/new`}
              className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 rounded-lg")}
            >
              <Plus className="size-4" />
              Add teacher
            </Link>
          ) : null
        }
      />
      <TeachersDrive schools={schools} schoolId={school?.id} teachers={teachers} />
    </>
  );
}
