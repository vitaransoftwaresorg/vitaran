import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { SchoolForm } from "@/features/schools/school-form";
import { listPrograms } from "@/services/programs";
import {
  getAdminSchoolSectionStrength,
  listAdminSchoolSections,
} from "@/services/sections";
import { getSchool } from "@/services/schools";
import { listAdminClassTeacherSlots } from "@/services/teachers";
import { formatNumber } from "@/utils/format";

export const metadata: Metadata = { title: "Edit School" };

export default async function EditSchoolPage({ params }: PageProps<"/admin/schools/[id]/edit">) {
  const { id } = await params;
  const [school, catalog] = await Promise.all([getSchool(id), listPrograms()]);
  if (!school) notFound();

  const [organization, strength, classTeacherSlots] = await Promise.all([
    listAdminSchoolSections(school.id),
    getAdminSchoolSectionStrength(school.id),
    listAdminClassTeacherSlots(school.id),
  ]);
  const seatsUsedLabel =
    strength.studentStrength == null
      ? `${formatNumber(strength.used)} seats assigned`
      : `${formatNumber(strength.used)} / ${formatNumber(strength.studentStrength)} seats`;

  return (
    <div>
      <PageHeader
        title={`Edit ${school.name}`}
        description={`School code ${school.code}`}
      />
      <SchoolForm
        school={school}
        catalog={catalog}
        classesPanel={{
          organization,
          classTeacherSlots,
          seatsUsedLabel,
          teachersHref: `/admin/teachers?school=${school.id}`,
        }}
      />
    </div>
  );
}
