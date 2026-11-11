"use client";

import { getTeacherParentHref } from "@/features/teacher-portal/navigation";
import { PortalPageBack } from "./portal-page-back";

export function TeacherPageBack() {
  return (
    <PortalPageBack getParentHref={getTeacherParentHref} homeHref="/teacher" />
  );
}
