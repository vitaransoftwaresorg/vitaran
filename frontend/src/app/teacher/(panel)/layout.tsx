import { cookies } from "next/headers";
import { Suspense } from "react";
import { InPageBackProvider } from "@/components/layout/in-page-back";
import { TeacherHeader } from "@/components/layout/teacher-header";
import { TeacherPageBack } from "@/components/layout/teacher-page-back";
import { TeacherSidebar } from "@/components/layout/teacher-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PanelFallback } from "@/features/admin/dashboard-parts";
import { LiveRefresh } from "@/features/live/live-refresh";
import { MaintenanceBanner } from "@/features/settings/maintenance-banner";
import { verifyTeacherSession } from "@/features/teacher-auth/session";

const SIDEBAR_STATE_COOKIE = "teacher_sidebar_state";

export default async function TeacherPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [teacher, cookieStore] = await Promise.all([verifyTeacherSession(), cookies()]);
  const defaultOpen = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value !== "false";

  return (
    <TooltipProvider>
      <InPageBackProvider>
        <SidebarProvider
          defaultOpen={defaultOpen}
          style={
            {
              // Narrow drawer on mobile; desktop matches school icon rail.
              "--sidebar-width": "10.5rem",
            } as React.CSSProperties
          }
        >
          <TeacherSidebar teacher={teacher} />
          <SidebarInset className="min-w-0 bg-neutral-50">
            <MaintenanceBanner />
            <TeacherHeader />
            <div className="w-full flex-1 p-4 sm:p-5 lg:px-6 lg:py-6">
              <TeacherPageBack />
              <Suspense fallback={<PanelFallback />}>{children}</Suspense>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </InPageBackProvider>
      <LiveRefresh />
      <Toaster theme="light" position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
