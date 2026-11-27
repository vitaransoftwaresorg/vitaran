"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { PortalHeaderCrumbs } from "@/components/layout/portal-header-crumbs";
import { usePortalNavCrumbs } from "@/components/layout/use-portal-nav-crumbs";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { SchoolSwitcher } from "@/features/head-office-portal/school-switcher";
import { getSchoolBreadcrumbs } from "@/features/school-portal/navigation";
import type { HeadOfficeSchoolOption } from "@/types/head-office-portal";

export function SchoolHeader({
  headOfficeSchools,
  currentSchoolId,
}: {
  headOfficeSchools?: HeadOfficeSchoolOption[];
  currentSchoolId?: string;
}) {
  const crumbs = usePortalNavCrumbs(getSchoolBreadcrumbs(usePathname()));
  const { isMobile } = useSidebar();
  const dashboardOnly = crumbs.length <= 1;
  const fromHeadOffice = Boolean(headOfficeSchools?.length);

  if (!isMobile && dashboardOnly && !fromHeadOffice) return null;

  return (
    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 flex-col justify-center gap-1.5 border-b border-brand-100 bg-white/95 px-3 py-3 backdrop-blur sm:min-h-16 sm:px-5 sm:py-3.5">
      {isMobile ? (
        <div className="flex items-center gap-2">
          <Logo compact />
          <SidebarTrigger
            className="ml-auto size-12 shrink-0 text-black hover:bg-transparent hover:text-black"
            aria-label="Open menu"
          >
            <Menu className="size-8" strokeWidth={2.25} />
          </SidebarTrigger>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!dashboardOnly ? (
          <PortalHeaderCrumbs crumbs={crumbs} />
        ) : fromHeadOffice ? (
          <p className="text-sm text-neutral-500">Managing this school</p>
        ) : (
          <div className="hidden sm:block" />
        )}
        {fromHeadOffice ? (
          <SchoolSwitcher
            schools={headOfficeSchools!}
            currentSchoolId={currentSchoolId}
            inWorkspace
            className="sm:ml-auto"
          />
        ) : null}
      </div>
    </header>
  );
}
