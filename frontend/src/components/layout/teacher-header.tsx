"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Logo } from "@/components/shared/logo";
import { getTeacherBreadcrumbs } from "@/features/teacher-portal/navigation";

export function TeacherHeader() {
  const crumbs = getTeacherBreadcrumbs(usePathname());
  const { isMobile } = useSidebar();
  const dashboardOnly = crumbs.length <= 1;

  // Desktop dashboard: no breadcrumb bar (avoids repeating "Dashboard").
  if (!isMobile && dashboardOnly) return null;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-brand-100 bg-white/95 px-3 backdrop-blur sm:px-4">
      {isMobile ? (
        <>
          <Logo compact />
          <div className="flex-1" />
          <SidebarTrigger
            className="size-11 shrink-0 text-black hover:bg-transparent hover:text-black"
            aria-label="Open menu"
          >
            <Menu className="size-7" strokeWidth={2.25} />
          </SidebarTrigger>
        </>
      ) : (
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList>
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <Fragment key={crumb.href}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {last ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={crumb.href} />}>
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
    </header>
  );
}
