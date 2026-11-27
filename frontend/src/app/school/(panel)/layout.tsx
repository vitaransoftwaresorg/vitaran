import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DrivePathProvider } from "@/components/layout/drive-path-context";
import { HeadOfficeHeader } from "@/components/layout/head-office-header";
import { HeadOfficeSidebar } from "@/components/layout/head-office-sidebar";
import { InPageBackProvider } from "@/components/layout/in-page-back";
import { SchoolHeader } from "@/components/layout/school-header";
import { SchoolPageBack } from "@/components/layout/school-page-back";
import { SchoolSidebar } from "@/components/layout/school-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HEAD_OFFICE_SESSION_COOKIE } from "@/constants/auth";
import { verifyHeadOfficeSession } from "@/features/head-office-auth/session";
import { headOfficeNavGroups } from "@/features/head-office-portal/navigation";
import { LiveRefresh } from "@/features/live/live-refresh";
import { PortalNavMemory } from "@/features/portal-nav/portal-nav-memory";
import { verifySchoolSession } from "@/features/school-auth/session";
import { schoolNavGroups } from "@/features/school-portal/navigation";
import { UNDER_MAINTENANCE_PATH } from "@/features/settings/maintenance-redirect";
import { PortalMaintenanceGate } from "@/features/settings/portal-maintenance-gate";
import { listHeadOfficeSchools } from "@/services/head-office-portal";
import { getPublicSettings } from "@/services/settings";

const SCHOOL_NAV_ROOTS = schoolNavGroups.flatMap((group) => group.items.map((item) => item.href));
const HO_NAV_ROOTS = headOfficeNavGroups.flatMap((group) => group.items.map((item) => item.href));

const SIDEBAR_STATE_COOKIE = "school_sidebar_state";
const HO_SIDEBAR_STATE_COOKIE = "head_office_sidebar_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SchoolPanelLayout({
  children,
}: LayoutProps<"/school">) {
  const cookieStore = await cookies();
  const settings = await getPublicSettings();
  // Avoid rendering portal pages that call blocked APIs (refresh → 503 / not-found).
  if (settings.maintenanceMode) redirect(UNDER_MAINTENANCE_PATH);

  const fromHeadOffice = cookieStore.has(HEAD_OFFICE_SESSION_COOKIE);

  if (fromHeadOffice) {
    const [school, office, schools] = await Promise.all([
      verifySchoolSession(),
      verifyHeadOfficeSession(),
      listHeadOfficeSchools(),
    ]);
    const schoolOptions = schools.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status,
    }));
    const defaultOpen = cookieStore.get(HO_SIDEBAR_STATE_COOKIE)?.value !== "false";

    return (
      <TooltipProvider>
        <InPageBackProvider>
          <DrivePathProvider>
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
              <HeadOfficeSidebar office={office} selectedSchoolId={school.id} />
              <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden bg-neutral-50">
                <HeadOfficeHeader schools={schoolOptions} selectedSchoolId={school.id} />
                <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden p-3 sm:p-5 lg:px-6 lg:py-6">
                  <PortalMaintenanceGate initialMaintenance={settings.maintenanceMode}>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <SchoolPageBack />
                      <Suspense fallback={null}>
                        <PortalNavMemory roots={HO_NAV_ROOTS} />
                      </Suspense>
                      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                        <Suspense fallback={null}>{children}</Suspense>
                      </div>
                    </div>
                  </PortalMaintenanceGate>
                </div>
              </SidebarInset>
            </SidebarProvider>
          </DrivePathProvider>
        </InPageBackProvider>
        <LiveRefresh path="/school/live" />
        <Toaster theme="light" position="top-right" richColors closeButton />
      </TooltipProvider>
    );
  }

  const school = await verifySchoolSession();
  const defaultOpen = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value !== "false";

  return (
    <TooltipProvider>
      <InPageBackProvider>
        <DrivePathProvider>
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
            <SchoolSidebar school={school} />
            <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden bg-neutral-50">
              <SchoolHeader />
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden p-3 sm:p-5 lg:px-6 lg:py-6">
                <PortalMaintenanceGate initialMaintenance={settings.maintenanceMode}>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <SchoolPageBack />
                    <Suspense fallback={null}>
                      <PortalNavMemory roots={SCHOOL_NAV_ROOTS} />
                    </Suspense>
                    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                      <Suspense fallback={null}>{children}</Suspense>
                    </div>
                  </div>
                </PortalMaintenanceGate>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </DrivePathProvider>
      </InPageBackProvider>
      <LiveRefresh path="/school/live" />
      <Toaster theme="light" position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
