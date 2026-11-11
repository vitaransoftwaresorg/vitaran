import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string; studentId: string }>;
};

export default async function LegacyAdminStudentRedirect({ params }: Props) {
  const { id, studentId } = await params;
  redirect(`/admin/schools/${id}/students/${studentId}`);
}
