"use client";

import { DriveBrowser, type DriveItem } from "@/features/documents/drive-browser";
import { TYPE_LABELS } from "@/features/schools/constants";
import { setAdminTeacherStatusAction } from "@/features/teachers/actions";
import { TeachersTable } from "@/features/teachers/teachers-table";
import type { SchoolOption } from "@/types/school";
import type { Teacher } from "@/types/teacher";

export const TEACHERS_PATH = "/admin/teachers";

type TeachersDriveProps = {
  schools: SchoolOption[];
  schoolId?: string;
  teachers?: Teacher[];
};

function schoolHref(schoolId: string) {
  return `${TEACHERS_PATH}?${new URLSearchParams({ school: schoolId })}`;
}

export function TeachersDrive({ schools, schoolId, teachers = [] }: TeachersDriveProps) {
  const school = schools.find((item) => item.id === schoolId);

  if (schoolId && school) {
    return (
      <TeachersTable
        teachers={teachers}
        showSchool={false}
        editHrefBase={TEACHERS_PATH}
        onToggleStatus={setAdminTeacherStatusAction}
      />
    );
  }

  const items: DriveItem[] = [...schools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      id: item.id,
      name: item.name,
      kind: "folder" as const,
      href: schoolHref(item.id),
      detail: TYPE_LABELS[item.type],
    }));

  return (
    <DriveBrowser
      breadcrumbs={[{ label: "Teachers", href: TEACHERS_PATH }]}
      items={items}
      emptyText="No schools yet"
      searchPlaceholder="Search schools"
    />
  );
}
