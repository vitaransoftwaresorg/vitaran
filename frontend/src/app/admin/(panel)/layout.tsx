import { cookies } from "next/headers";
import { Suspense } from "react";
import { AdminHeader } from "@/components/layout/admin-header";
import { AdminPageBack } from "@/components/layout/admin-page-back";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { DrivePathProvider } from "@/components/layout/drive-path-context";
import { InPageBackProvider } from "@/components/layout/in-page-back";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { verifyAdminSession } from "@/features/admin-auth/session";
import { adminNavGroups } from "@/features/admin/navigation";
import { LiveRefresh } from "@/features/live/live-refresh";
import { PortalNavMemory } from "@/features/portal-nav/portal-nav-memory";

const ADMIN_NAV_ROOTS = adminNavGroups.flatMap((group) => group.items.map((item) => item.href));

const SIDEBAR_STATE_COOKIE = "sidebar_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPanelLayout({
  children,
}: LayoutProps<"/admin">) {
  const [admin, cookieStore] = await Promise.all([
    verifyAdminSession(),
    cookies(),
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
                "--sidebar-width-mobile": "min(50vw, 12rem)",
              } as React.CSSProperties
            }
          >
            <AdminSidebar admin={admin} />
            <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-neutral-50">
              <AdminHeader />
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-3 sm:p-5 lg:px-6 lg:py-6">
                <AdminPageBack />
                <Suspense fallback={null}>
                  <PortalNavMemory roots={ADMIN_NAV_ROOTS} />
                </Suspense>
                {/* null fallback: keep the current table visible during soft refresh (toggles/publish). */}
                <Suspense fallback={null}>{children}</Suspense>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </DrivePathProvider>
      </InPageBackProvider>
      <LiveRefresh path="/admin/live" />
      <Toaster theme="light" position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
