import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string; studentId: string }>;
};

export default async function LegacyAdminStudentEditRedirect({ params }: Props) {
  const { id, studentId } = await params;
  redirect(`/admin/schools/${id}/students/${studentId}/edit`);
}
