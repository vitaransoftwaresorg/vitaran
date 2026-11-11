import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function LegacyAdminStudentNewRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/schools/${id}/students/new`);
}
