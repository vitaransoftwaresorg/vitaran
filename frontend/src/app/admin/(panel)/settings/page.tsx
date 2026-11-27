import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { verifyAdminSession } from "@/features/admin-auth/session";
import { AdminSettingsForm } from "@/features/settings/admin-settings-form";
import { listAdminOperators } from "@/services/admin-operators";
import { getAdminSettings } from "@/services/settings";

export const metadata: Metadata = { title: "Admin settings" };

export default async function AdminSettingsPage() {
  const admin = await verifyAdminSession();
  if (!admin.isRoot) redirect("/admin");

  const [settings, operators] = await Promise.all([getAdminSettings(), listAdminOperators()]);

  return (
    <div className="w-full">
      <PageHeader
        title="Admin settings"
        description="Maintenance mode, employee admin logins, and objection email routing."
      />
      <AdminSettingsForm initial={settings} operators={operators} />
    </div>
  );
}
