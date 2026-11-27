import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { verifyHeadOfficeSession } from "@/features/head-office-auth/session";
import { HeadOfficeSchoolsTable } from "@/features/head-office-portal/schools-table";
import { listHeadOfficeSchools } from "@/services/head-office-portal";

export const metadata: Metadata = { title: "Schools" };

export default async function HeadOfficeSchoolsPage() {
  await verifyHeadOfficeSession();
  const schools = await listHeadOfficeSchools();

  return (
    <>
      <PageHeader title="Schools" count={schools.length} countNoun="schools" />
      <HeadOfficeSchoolsTable schools={schools} />
    </>
  );
}
