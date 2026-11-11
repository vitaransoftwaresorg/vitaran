import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { AdminRowActions } from "@/features/students/admin-row-actions";
import { getSchool } from "@/services/schools";
import { getAdminSchoolStudentCounts } from "@/services/students";

type Props = { params: Promise<{ id: string }> };

export default async function AdminSchoolProgramsPage({ params }: Props) {
  const { id } = await params;
  const [school, counts] = await Promise.all([
    getSchool(id),
    getAdminSchoolStudentCounts(id),
  ]);
  if (!school) notFound();
  const countByProgram = counts.byProgram;

  return (
    <>
      <PageHeader
        title="Programs"
        description={`${school.name} · open a program to see classes and students`}
        count={school.schoolPrograms.length}
      />

      {school.schoolPrograms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          No programs on this school.{" "}
          <Link href={`/admin/schools/${id}/edit`} className="font-medium text-brand-800 underline">
            Edit school
          </Link>{" "}
          to enable programs.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)] divide-y divide-brand-50">
          {school.schoolPrograms.map((program) => (
            <li
              key={program.programId}
              className="flex items-center gap-3 px-4 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-950">
                  {program.programName}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {program.classes.length} class
                  {program.classes.length === 1 ? "" : "es"} ·{" "}
                  {countByProgram[program.programId] ?? 0} students · year {program.year}
                </p>
              </div>
              <AdminRowActions
                viewHref={`/admin/schools/${id}/programs/${program.programId}`}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
