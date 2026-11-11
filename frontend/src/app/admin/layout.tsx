import type { Metadata } from "next";
import { AdminSessionGuard } from "@/features/admin-auth/admin-session-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · Vitaran Admin",
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <AdminSessionGuard />
      {children}
    </>
  );
}
