"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { PortalHeaderCrumbs } from "@/components/layout/portal-header-crumbs";
import { usePortalNavCrumbs } from "@/components/layout/use-portal-nav-crumbs";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { getTeacherBreadcrumbs } from "@/features/teacher-portal/navigation";

export function TeacherHeader() {
  const crumbs = usePortalNavCrumbs(getTeacherBreadcrumbs(usePathname()));
  const { isMobile } = useSidebar();
  const dashboardOnly = crumbs.length <= 1;

  // Desktop dashboard: no breadcrumb bar (avoids repeating "Dashboard").
  if (!isMobile && dashboardOnly) return null;

  return (
    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 flex-col justify-center gap-1.5 border-b border-brand-100 bg-white/95 px-3 py-3 backdrop-blur sm:min-h-16 sm:px-5 sm:py-3.5">
      {isMobile ? (
        <div className="flex items-center gap-2">
          <Logo compact />
          <div className="flex-1" />
          <SidebarTrigger
            className="size-12 shrink-0 text-black hover:bg-transparent hover:text-black"
            aria-label="Open menu"
          >
            <Menu className="size-8" strokeWidth={2.25} />
          </SidebarTrigger>
        </div>
      ) : null}
      {!dashboardOnly ? <PortalHeaderCrumbs crumbs={crumbs} /> : null}
    </header>
  );
}
