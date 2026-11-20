import { redirect } from "next/navigation";

/** Legacy URL → one shared Add students page. */
export default async function LegacyNewStudentRedirect({
  params,
}: {
  params: Promise<{ classLevel: string }>;
}) {
  const { classLevel } = await params;
  const level = Number(classLevel);
  if (Number.isInteger(level) && level >= 1 && level <= 12) {
    redirect(`/school/students/new?class=${level}`);
  }
  redirect("/school/students/new");
}
