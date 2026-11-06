import { notFound, redirect } from "next/navigation";
import { findStudentIdByRoll } from "@/services/students";

/** Result sheets know a student only by registration number; `?school=` keeps it to that school. */
export default async function AdminStudentByRollPage({
  params,
  searchParams,
}: {
  params: Promise<{ roll: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ roll }, query] = await Promise.all([params, searchParams]);
  const school = typeof query.school === "string" ? query.school : undefined;
  const id = await findStudentIdByRoll("admin", decodeURIComponent(roll), school);
  if (!id) notFound();
  redirect(`/admin/schools/students/${id}`);
}
