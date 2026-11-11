import { redirect } from "next/navigation";

type Props = {
  params: Promise<{
    id: string;
    classLevel: string;
    programId: string;
    studentId: string;
  }>;
};

/** Legacy class-first URL → canonical programs → classes → student. */
export default async function LegacyAdminStudentRedirect({ params }: Props) {
  const { id, classLevel, programId, studentId } = await params;
  redirect(
    `/admin/schools/${id}/programs/${programId}/classes/${classLevel}/students/${studentId}`,
  );
}
