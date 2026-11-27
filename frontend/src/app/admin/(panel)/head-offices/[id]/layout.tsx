import { notFound } from "next/navigation";
import { HeadOfficeNavTrail } from "@/features/head-offices/head-office-nav-trail";
import { getHeadOffice } from "@/services/head-offices";

/** Keeps the office name in the top nav for profile and edit pages. */
export default async function AdminHeadOfficeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const office = await getHeadOffice(id);
  if (!office) notFound();

  return (
    <>
      <HeadOfficeNavTrail id={office.id} name={office.name} />
      {children}
    </>
  );
}
