import { notFound, redirect } from "next/navigation";
import { findStudentIdByRoll } from "@/services/students";

/** Result sheets know a student only by registration number. */
export default async function SchoolStudentByRollPage({ params }: { params: Promise<{ roll: string }> }) {
  const id = await findStudentIdByRoll("school", decodeURIComponent((await params).roll));
  if (!id) notFound();
  redirect(`/school/students/${id}`);
}
