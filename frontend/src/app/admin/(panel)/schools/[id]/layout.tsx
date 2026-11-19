import { notFound } from "next/navigation";
import { SchoolNavTrail } from "@/features/schools/school-nav-trail";
import { getSchool } from "@/services/schools";

/** Keeps the school name in the top nav for every nested school page. */
export default async function AdminSchoolLayout({
  children,
  params,
}: LayoutProps<"/admin/schools/[id]">) {
  const { id } = await params;
  const school = await getSchool(id);
  if (!school) notFound();

  return (
    <>
      <SchoolNavTrail id={school.id} name={school.name} />
      {children}
    </>
  );
}
