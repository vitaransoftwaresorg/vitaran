import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { SchoolForm } from "@/features/schools/school-form";
import { listHeadOffices } from "@/services/head-offices";
import { listPrograms } from "@/services/programs";

export const metadata: Metadata = { title: "Register School" };

export default async function RegisterSchoolPage() {
  const [catalog, headOffices] = await Promise.all([listPrograms(), listHeadOffices()]);

  return (
    <div>
      <PageHeader title="Register school" />
      <SchoolForm catalog={catalog} headOffices={headOffices} />
    </div>
  );
}
