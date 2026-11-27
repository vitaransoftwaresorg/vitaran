import { cookies } from "next/headers";
import { Suspense } from "react";
import { DrivePathProvider } from "@/components/layout/drive-path-context";
import { InPageBackProvider } from "@/components/layout/in-page-back";
import { TeacherHeader } from "@/components/layout/teacher-header";
import { TeacherPageBack } from "@/components/layout/teacher-page-back";
import { TeacherSidebar } from "@/components/layout/teacher-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LiveRefresh } from "@/features/live/live-refresh";
import { PortalNavMemory } from "@/features/portal-nav/portal-nav-memory";
import { PortalMaintenanceGate } from "@/features/settings/portal-maintenance-gate";
import { verifyTeacherSession } from "@/features/teacher-auth/session";
import { teacherNavGroups } from "@/features/teacher-portal/navigation";
import { getPublicSettings } from "@/services/settings";

const TEACHER_NAV_ROOTS = teacherNavGroups.flatMap((group) =>
  group.items.map((item) => item.href),
);

const SIDEBAR_STATE_COOKIE = "teacher_sidebar_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeacherPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [teacher, cookieStore, settings] = await Promise.all([
    verifyTeacherSession(),
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
            className="h-dvh overflow-hidden"
            style={
              {
                // Narrow drawer on mobile; desktop matches school icon rail.
                "--sidebar-width": "10.8rem",
                "--sidebar-width-mobile": "min(50vw, 12rem)",
              } as React.CSSProperties
            }
          >
            <TeacherSidebar teacher={teacher} />
            {/* One scroll shell on all viewports — header sticky, tables scroll in the pane below. */}
            <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden bg-neutral-50">
              <TeacherHeader />
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden p-3 sm:p-5 lg:px-6 lg:py-6">
                <PortalMaintenanceGate initialMaintenance={settings.maintenanceMode}>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <TeacherPageBack />
                    <Suspense fallback={null}>
                      <PortalNavMemory roots={TEACHER_NAV_ROOTS} />
                    </Suspense>
                    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                      {/* null fallback: keep the current table visible during soft refresh (toggles/publish). */}
                      <Suspense fallback={null}>{children}</Suspense>
                    </div>
                  </div>
                </PortalMaintenanceGate>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </DrivePathProvider>
      </InPageBackProvider>
      <LiveRefresh path="/teacher/live" />
      <Toaster theme="light" position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
