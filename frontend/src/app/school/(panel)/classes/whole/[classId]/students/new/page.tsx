import { redirect } from "next/navigation";
import { listSchoolClassOrganization } from "@/services/sections";

/** Legacy URL → one shared Add students page. */
export default async function LegacyWholeStudentNewRedirect({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const organization = await listSchoolClassOrganization();
  const whole = organization.wholeClasses.find((row) => row.id === classId);
  if (!whole) redirect("/school/students/new");
  redirect(`/school/students/new?class=${whole.classLevel}`);
}
