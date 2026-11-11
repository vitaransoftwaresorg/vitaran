"use client";

import { ADMIN_BASE_PATH } from "@/constants/auth";
import { getAdminParentHref } from "@/features/admin/navigation";
import { PortalPageBack } from "./portal-page-back";

export function AdminPageBack() {
  return (
    <PortalPageBack getParentHref={getAdminParentHref} homeHref={ADMIN_BASE_PATH} />
  );
}
