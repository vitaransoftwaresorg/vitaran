import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { StudentsTable } from "@/features/students/students-table";
import { getSchool } from "@/services/schools";
import { listAdminSchoolStudents } from "@/services/students";

type Props = {
  params: Promise<{ id: string; classLevel: string; programId: string }>;
};

export default async function AdminSchoolProgramStudentsPage({ params }: Props) {
  const { id, classLevel: raw, programId } = await params;
  const classLevel = Number(raw);
  if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 12) notFound();

  const school = await getSchool(id);
  if (!school) notFound();

  const program = school.schoolPrograms.find((p) => p.programId === programId);
  if (!program?.classes.some((c) => c.classLevel === classLevel)) notFound();

  const students = await listAdminSchoolStudents(id, {
    classLevel,
    programId,
    pageSize: 50,
  });

  return (
    <>
      <PageHeader
        title={`${program.programName} · Class ${classLevel}`}
        description={school.name}
        count={students.pagination.total}
      />
      <StudentsTable
        students={students.items}
        mode="admin"
        emptyMessage="No students enrolled yet."
      />
    </>
  );
}
