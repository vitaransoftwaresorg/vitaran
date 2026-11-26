import { cookies } from "next/headers";
import { Suspense } from "react";
import { DrivePathProvider } from "@/components/layout/drive-path-context";
import { InPageBackProvider } from "@/components/layout/in-page-back";
import { SchoolHeader } from "@/components/layout/school-header";
import { SchoolPageBack } from "@/components/layout/school-page-back";
import { SchoolSidebar } from "@/components/layout/school-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LiveRefresh } from "@/features/live/live-refresh";
import { PortalNavMemory } from "@/features/portal-nav/portal-nav-memory";
import { verifySchoolSession } from "@/features/school-auth/session";
import { schoolNavGroups } from "@/features/school-portal/navigation";
import { PortalMaintenanceGate } from "@/features/settings/portal-maintenance-gate";
import { getPublicSettings } from "@/services/settings";

const SCHOOL_NAV_ROOTS = schoolNavGroups.flatMap((group) => group.items.map((item) => item.href));

const SIDEBAR_STATE_COOKIE = "school_sidebar_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SchoolPanelLayout({
  children,
}: LayoutProps<"/school">) {
  const [school, cookieStore, settings] = await Promise.all([
    verifySchoolSession(),
    cookies(),
    getPublicSettings(),
  ]);
  const defaultOpen = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value !== "false";

  return (
    <TooltipProvider>
      <InPageBackProvider>
        <DrivePathProvider>
          <SidebarProvider
            defaultOpen={defaultOpen}
            style={
              {
                "--sidebar-width": "10.8rem",
                // Mobile drawer: half of the default sheet width (was ~75vw / sm:max-w-sm).
                "--sidebar-width-mobile": "min(50vw, 12rem)",
              } as React.CSSProperties
            }
          >
            <SchoolSidebar school={school} />
            <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-neutral-50">
              <SchoolHeader />
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-3 sm:p-5 lg:px-6 lg:py-6">
                <PortalMaintenanceGate initialMaintenance={settings.maintenanceMode}>
                  <SchoolPageBack />
                  <Suspense fallback={null}>
                    <PortalNavMemory roots={SCHOOL_NAV_ROOTS} />
                  </Suspense>
                  {/* null fallback: keep the current table visible during soft refresh (toggles/publish). */}
                  <Suspense fallback={null}>{children}</Suspense>
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
