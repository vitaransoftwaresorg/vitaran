import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { SchoolForm } from "@/features/schools/school-form";
import { listHeadOffices } from "@/services/head-offices";
import { listPrograms } from "@/services/programs";
import {
  getAdminSchoolSectionStrength,
  listAdminSchoolSections,
} from "@/services/sections";
import { getSchool } from "@/services/schools";
import { getAdminSchoolStudentCounts } from "@/services/students";
import { listAdminClassTeacherSlots } from "@/services/teachers";
import { formatNumber } from "@/utils/format";

export const metadata: Metadata = { title: "Edit School" };

export default async function EditSchoolPage({ params }: PageProps<"/admin/schools/[id]/edit">) {
  const { id } = await params;
  const [school, catalog, headOffices] = await Promise.all([
    getSchool(id),
    listPrograms(),
    listHeadOffices(),
  ]);
  if (!school) notFound();

  const [organization, strength, classTeacherSlots, rosterCounts] = await Promise.all([
    listAdminSchoolSections(school.id),
    getAdminSchoolSectionStrength(school.id),
    listAdminClassTeacherSlots(school.id),
    getAdminSchoolStudentCounts(school.id),
  ]);
  const seatsUsedLabel =
    strength.studentStrength == null
      ? `${formatNumber(strength.used)} seats assigned`
      : `${formatNumber(strength.used)} / ${formatNumber(strength.studentStrength)} seats`;

  return (
    <div>
      <PageHeader description={`School code ${school.code}`} />
      <SchoolForm
        school={school}
        catalog={catalog}
        headOffices={headOffices}
        classesPanel={{
          organization,
          classTeacherSlots,
          seatsUsedLabel,
          teachersHref: `/admin/teachers?school=${school.id}&from=school`,
          strength: {
            studentStrength: strength.studentStrength,
            used: strength.used,
          },
          rosterCounts,
        }}
      />
    </div>
  );
}
