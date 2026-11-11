import { redirect } from "next/navigation";

type Props = { params: Promise<{ studentId: string }> };

/** Legacy school-scoped detail → flat student URL. */
export default async function LegacyAdminStudentDetailRedirect({ params }: Props) {
  const { studentId } = await params;
  redirect(`/admin/schools/students/${studentId}`);
}
