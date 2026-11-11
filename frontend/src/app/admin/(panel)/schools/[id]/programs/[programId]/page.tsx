import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { AdminRowActions } from "@/features/students/admin-row-actions";
import { listAdminSchoolSections } from "@/services/sections";
import { getSchool } from "@/services/schools";
import { getAdminSchoolStudentCounts } from "@/services/students";

type Props = { params: Promise<{ id: string; programId: string }> };

export default async function AdminSchoolProgramClassesPage({ params }: Props) {
  const { id, programId } = await params;
  const school = await getSchool(id);
  if (!school) notFound();

  const program = school.schoolPrograms.find((p) => p.programId === programId);
  if (!program) notFound();

  const [organization, counts] = await Promise.all([
    listAdminSchoolSections(id),
    getAdminSchoolStudentCounts(id),
  ]);

  const sections = organization.sections.filter((s) => s.programId === programId);
  const wholes = organization.wholeClasses.filter((c) => c.programId === programId);

  const classLevels = [
    ...new Set([
      ...program.classes.map((c) => c.classLevel),
      ...sections.map((s) => s.classLevel),
      ...wholes.map((w) => w.classLevel),
    ]),
  ].sort((a, b) => a - b);

  const countByLevel = Object.fromEntries(
    counts.byClass
      .filter((row) => row.programId === programId)
      .map((row) => [row.classLevel, row.count]),
  );

  return (
    <>
      <PageHeader
        title={program.programName}
        description={`${school.name} · classes for this program`}
        count={classLevels.length}
      />

      {classLevels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          No classes enabled for this program.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)] divide-y divide-brand-50">
          {classLevels.map((level) => {
            const levelSections = sections.filter((s) => s.classLevel === level);
            const whole = wholes.find((w) => w.classLevel === level);
            const detail =
              levelSections.length > 0
                ? `${levelSections.length} section${levelSections.length === 1 ? "" : "s"}`
                : whole
                  ? `Section A · ${whole.studentCount} seats`
                  : "Offered on school";
            return (
              <li key={level} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-950">Class {level}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {detail} · {countByLevel[level] ?? 0} students
                  </p>
                </div>
                <AdminRowActions
                  viewHref={`/admin/schools/${id}/programs/${programId}/classes/${level}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
