"use client";

import { getSchoolParentHref } from "@/features/school-portal/navigation";
import { PortalPageBack } from "./portal-page-back";

export function SchoolPageBack() {
  return (
    <PortalPageBack getParentHref={getSchoolParentHref} homeHref="/school" />
  );
}
