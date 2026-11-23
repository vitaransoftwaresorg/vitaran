"use client";

import { useEffect } from "react";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
import { DriveBrowser, type DriveItem } from "@/features/documents/drive-browser";
import { TYPE_LABELS } from "@/features/schools/constants";
import { setAdminTeacherStatusAction } from "@/features/teachers/actions";
import { TeachersTable } from "@/features/teachers/teachers-table";
import type { Pagination, SchoolOption } from "@/types/school";
import type { Teacher } from "@/types/teacher";
import { ListPagination } from "@/components/shared/list-pagination";

export const TEACHERS_PATH = "/admin/teachers";

type TeachersDriveProps = {
  schools: SchoolOption[];
  schoolId?: string;
  teachers?: Teacher[];
  pagination?: Pagination;
  listParams?: Record<string, string | number | undefined | null>;
};

function schoolHref(schoolId: string) {
  return `${TEACHERS_PATH}?${new URLSearchParams({ school: schoolId })}`;
}

export function TeachersDrive({
  schools,
  schoolId,
  teachers = [],
  pagination,
  listParams,
}: TeachersDriveProps) {
  const school = schools.find((item) => item.id === schoolId);
  const setDrivePath = useSetDrivePathCrumbs();
  const totalTeachers = pagination?.total ?? teachers.length;

  useEffect(() => {
    if (!setDrivePath) return;
    if (schoolId && school) {
      const n = totalTeachers;
      setDrivePath([
        { label: school.name, href: schoolHref(school.id) },
        {
          label: `${n} Teacher${n === 1 ? "" : "s"}`,
          href: schoolHref(school.id),
        },
      ]);
      return () => setDrivePath([]);
    }
    setDrivePath([]);
  }, [school, schoolId, totalTeachers, setDrivePath]);

  if (schoolId && school) {
    return (
      <TeachersTable
        teachers={teachers}
        showSchool={false}
        editHrefBase={TEACHERS_PATH}
        onToggleStatus={setAdminTeacherStatusAction}
        pagination={
          pagination ? (
            <ListPagination
              pagination={pagination}
              basePath={TEACHERS_PATH}
              searchParams={{ school: school.id, ...listParams }}
              noun="teachers"
              pageSizeOptions={[10, 20, 50, 100]}
            />
          ) : undefined
        }
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
      imageSrc: item.hasLogo ? `/admin/schools/${item.id}/logo` : undefined,
      nameLogo: true,
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
