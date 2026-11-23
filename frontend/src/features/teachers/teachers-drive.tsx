"use client";

import { useEffect } from "react";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
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
  /** Opened from a school profile (`?from=school`). */
  fromSchool?: boolean;
};

function schoolHref(schoolId: string, fromSchool?: boolean) {
  const params = new URLSearchParams({ school: schoolId });
  if (fromSchool) params.set("from", "school");
  return `${TEACHERS_PATH}?${params}`;
}

export function TeachersDrive({
  schools,
  schoolId,
  teachers = [],
  pagination,
  listParams,
  fromSchool = false,
}: TeachersDriveProps) {
  const school = schools.find((item) => item.id === schoolId);
  const setDrivePath = useSetDrivePathCrumbs();
  const totalTeachers = pagination?.total ?? teachers.length;

  useEffect(() => {
    if (!setDrivePath) return;
    if (schoolId && school) {
      const teachersHref = schoolHref(school.id, fromSchool);
      const crumbs: DriveCrumb[] = fromSchool
        ? [
            { label: school.name, href: `/admin/schools/${school.id}` },
            {
              label: `${totalTeachers} Teacher${totalTeachers === 1 ? "" : "s"}`,
              href: teachersHref,
            },
          ]
        : [
            {
              label: school.name,
              href: teachersHref,
            },
          ];
      setDrivePath(crumbs);
      return () => setDrivePath([]);
    }
    setDrivePath([]);
  }, [school, schoolId, totalTeachers, fromSchool, setDrivePath]);

  if (schoolId && school) {
    return (
      <TeachersTable
        teachers={teachers}
        showSchool={false}
        editHrefBase={TEACHERS_PATH}
        onToggleStatus={setAdminTeacherStatusAction}
        scopeKey={`admin-teachers:${school.id}:${fromSchool ? "s" : "d"}`}
        pagination={
          pagination ? (
            <ListPagination
              pagination={pagination}
              basePath={TEACHERS_PATH}
              searchParams={{
                school: school.id,
                ...(fromSchool ? { from: "school" } : {}),
                ...listParams,
              }}
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
