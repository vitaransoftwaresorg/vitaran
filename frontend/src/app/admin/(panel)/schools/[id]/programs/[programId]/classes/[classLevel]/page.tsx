import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Legacy deep URL → flat school students roster. */
export default async function LegacyAdminClassRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/schools/${id}/students`);
}
