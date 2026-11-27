import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { SchoolForm } from "@/features/schools/school-form";
import { listHeadOffices } from "@/services/head-offices";
import { listPrograms } from "@/services/programs";
import { listCustomizedSchoolOptions } from "@/services/schools";

export const metadata: Metadata = { title: "Register School" };

export default async function RegisterSchoolPage() {
  const [catalog, headOffices, resourceSourceSchools] = await Promise.all([
    listPrograms(),
    listHeadOffices(),
    listCustomizedSchoolOptions().catch(() => []),
  ]);

  return (
    <div>
      <PageHeader title="Register school" />
      <SchoolForm
        catalog={catalog}
        headOffices={headOffices}
        resourceSourceSchools={resourceSourceSchools}
      />
    </div>
  );
}
