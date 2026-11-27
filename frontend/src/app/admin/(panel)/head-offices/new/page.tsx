import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { createHeadOfficeAction } from "@/features/head-offices/actions";
import { HeadOfficeForm } from "@/features/head-offices/head-office-form";
import { listAllSchoolsForOfficePicker } from "@/features/head-offices/load-schools";
import { getNextHeadOfficeCode } from "@/services/head-offices";

export const metadata: Metadata = { title: "Register Office" };

export default async function NewHeadOfficePage() {
  const [schools, nextCode] = await Promise.all([
    listAllSchoolsForOfficePicker(),
    getNextHeadOfficeCode().catch(() => "100001"),
  ]);

  return (
    <div>
      <PageHeader title="Register office" />
      <HeadOfficeForm schools={schools} nextCode={nextCode} action={createHeadOfficeAction} />
    </div>
  );
}
