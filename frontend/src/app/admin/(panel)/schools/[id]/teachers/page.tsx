import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** School teachers live on the Teachers drive: /admin/teachers?school=… */
export default async function AdminSchoolTeachersPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/teachers?school=${encodeURIComponent(id)}`);
}
