import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { getSchool } from "@/services/schools";
import { getAdminSchoolStudentCounts } from "@/services/students";

type Props = { params: Promise<{ id: string; classLevel: string }> };

export default async function AdminSchoolClassLevelPage({ params }: Props) {
  const { id, classLevel: raw } = await params;
  const classLevel = Number(raw);
  if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 12) notFound();

  const school = await getSchool(id);
  if (!school) notFound();

  const programs = school.schoolPrograms.filter((p) =>
    p.classes.some((c) => c.classLevel === classLevel),
  );
  if (programs.length === 0) notFound();

  const counts = await getAdminSchoolStudentCounts(id);
  const countByProgram = Object.fromEntries(
    counts.byClass
      .filter((row) => row.classLevel === classLevel)
      .map((row) => [row.programId, row.count]),
  );

  return (
    <>
      <PageHeader
        title={`${school.name} · Class ${classLevel}`}
        description="Select a program to view students."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {programs.map((program) => (
          <li key={program.programId}>
            <Link
              href={`/admin/schools/${id}/classes/${classLevel}/programs/${program.programId}`}
              className="block rounded-2xl border border-brand-200 bg-white p-4 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)] transition hover:border-brand-400"
            >
              <h2 className="text-lg font-bold text-brand-950">{program.programName}</h2>
              <p className="mt-2 text-sm text-neutral-600">
                {countByProgram[program.programId] ?? 0} students
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
