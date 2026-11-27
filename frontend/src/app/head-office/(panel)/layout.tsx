import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HeadOfficeHeader } from "@/components/layout/head-office-header";
import { HeadOfficeSidebar } from "@/components/layout/head-office-sidebar";
import { InPageBackProvider } from "@/components/layout/in-page-back";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { verifyHeadOfficeSession } from "@/features/head-office-auth/session";
import { headOfficeNavGroups } from "@/features/head-office-portal/navigation";
import { getSelectedHeadOfficeSchoolId } from "@/features/head-office-portal/selected-school";
import { PortalNavMemory } from "@/features/portal-nav/portal-nav-memory";
import { UNDER_MAINTENANCE_PATH } from "@/features/settings/maintenance-redirect";
import { PortalMaintenanceGate } from "@/features/settings/portal-maintenance-gate";
import { listHeadOfficeSchools } from "@/services/head-office-portal";
import { getPublicSettings } from "@/services/settings";

const NAV_ROOTS = headOfficeNavGroups.flatMap((group) => group.items.map((item) => item.href));
const SIDEBAR_STATE_COOKIE = "head_office_sidebar_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HeadOfficePanelLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, settings] = await Promise.all([cookies(), getPublicSettings()]);
  // listHeadOfficeSchools is blocked during maintenance — redirect before calling it.
  if (settings.maintenanceMode) redirect(UNDER_MAINTENANCE_PATH);

  const [office, schools, selectedSchoolId] = await Promise.all([
    verifyHeadOfficeSession(),
    listHeadOfficeSchools(),
    getSelectedHeadOfficeSchoolId(),
  ]);
  const defaultOpen = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value !== "false";
  const schoolOptions = schools.map((school) => ({
    id: school.id,
    code: school.code,
    name: school.name,
    status: school.status,
  }));
  const selectedStillLinked =
    selectedSchoolId && schoolOptions.some((school) => school.id === selectedSchoolId)
      ? selectedSchoolId
      : null;

  return (
    <TooltipProvider>
      <InPageBackProvider>
        <SidebarProvider
          defaultOpen={defaultOpen}
          className="h-dvh overflow-hidden"
          style={
            {
              "--sidebar-width": "10.8rem",
              "--sidebar-width-mobile": "min(50vw, 12rem)",
            } as React.CSSProperties
          }
        >
          <HeadOfficeSidebar office={office} selectedSchoolId={selectedStillLinked} />
          <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden bg-neutral-50">
            <HeadOfficeHeader schools={schoolOptions} selectedSchoolId={selectedStillLinked} />
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden p-3 sm:p-5 lg:px-6 lg:py-6">
              <PortalMaintenanceGate initialMaintenance={settings.maintenanceMode}>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <Suspense fallback={null}>
                    <PortalNavMemory roots={NAV_ROOTS} />
                  </Suspense>
                  <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                    <Suspense fallback={null}>{children}</Suspense>
                  </div>
                </div>
              </PortalMaintenanceGate>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </InPageBackProvider>
      <Toaster theme="light" position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
