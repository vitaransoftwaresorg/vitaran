import { notFound, redirect } from "next/navigation";
import { findStudentIdByRoll } from "@/services/students";

/** Result sheets know a student only by registration number. */
export default async function TeacherStudentByRollPage({ params }: { params: Promise<{ roll: string }> }) {
  const id = await findStudentIdByRoll("teacher", decodeURIComponent((await params).roll));
  if (!id) notFound();
  redirect(`/teacher/students/${id}`);
}
