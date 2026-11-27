import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { updateHeadOfficeAction } from "@/features/head-offices/actions";
import { HeadOfficeForm } from "@/features/head-offices/head-office-form";
import { listAllSchoolsForOfficePicker } from "@/features/head-offices/load-schools";
import { getHeadOffice } from "@/services/head-offices";

export const metadata: Metadata = { title: "Edit Office" };

export default async function EditHeadOfficePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [office, schools] = await Promise.all([
    getHeadOffice(id),
    listAllSchoolsForOfficePicker(),
  ]);
  if (!office) notFound();

  const action = updateHeadOfficeAction.bind(null, office.id);

  return (
    <>
      <PageHeader
        title="Edit Office"
        description={`Update ${office.name} and the schools under it.`}
      />
      <HeadOfficeForm office={office} schools={schools} action={action} />
    </>
  );
}
