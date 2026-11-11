import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { SchoolForm } from "@/features/schools/school-form";
import { listPrograms } from "@/services/programs";

export const metadata: Metadata = { title: "Register School" };

export default async function RegisterSchoolPage() {
  const catalog = await listPrograms();

  return (
    <div>
      <PageHeader title="Register school" />
      <SchoolForm catalog={catalog} />
    </div>
  );
}
