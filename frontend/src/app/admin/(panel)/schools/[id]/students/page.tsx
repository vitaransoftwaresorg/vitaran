import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** School roster lives on the Students drive: /admin/schools/students?school=… */
export default async function AdminSchoolStudentsPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/schools/students?school=${encodeURIComponent(id)}`);
}
