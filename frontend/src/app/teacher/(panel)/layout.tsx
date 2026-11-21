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
import { PortalMaintenanceGate } from "@/features/settings/portal-maintenance-gate";
import { verifyTeacherSession } from "@/features/teacher-auth/session";
import { getPublicSettings } from "@/services/settings";

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
            style={
              {
                // Narrow drawer on mobile; desktop matches school icon rail.
                "--sidebar-width": "10.8rem",
              } as React.CSSProperties
            }
          >
            <TeacherSidebar teacher={teacher} />
            <SidebarInset className="min-w-0 bg-neutral-50">
              <TeacherHeader />
              <div className="w-full flex-1 p-4 sm:p-5 lg:px-6 lg:py-6">
                <PortalMaintenanceGate initialMaintenance={settings.maintenanceMode}>
                  <TeacherPageBack />
                  {/* null fallback: keep the current table visible during soft refresh (toggles/publish). */}
                  <Suspense fallback={null}>{children}</Suspense>
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
