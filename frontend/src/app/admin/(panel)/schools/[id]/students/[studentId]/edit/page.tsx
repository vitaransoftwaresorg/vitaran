import { redirect } from "next/navigation";

type Props = { params: Promise<{ studentId: string }> };

export default async function LegacyAdminStudentEditRedirect({ params }: Props) {
  const { studentId } = await params;
  redirect(`/admin/schools/students/${studentId}/edit`);
}
