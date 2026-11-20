import { redirect } from "next/navigation";
import { listSchoolClassOrganization } from "@/services/sections";

/** Legacy URL → one shared Add students page. */
export default async function LegacySectionStudentNewRedirect({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = await params;
  const organization = await listSchoolClassOrganization();
  const section = organization.sections.find((row) => row.id === sectionId);
  if (!section) redirect("/school/students/new");
  const query = new URLSearchParams({
    class: String(section.classLevel),
    section: section.name,
  });
  redirect(`/school/students/new?${query}`);
}
