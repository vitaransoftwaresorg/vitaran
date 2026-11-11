import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Prefer programs → classes → students. */
export default async function AdminSchoolClassesRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/schools/${id}/programs`);
}
