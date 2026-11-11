import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { AdminSettingsForm } from "@/features/settings/admin-settings-form";
import { getAdminSettings } from "@/services/settings";

export const metadata: Metadata = { title: "Admin settings" };

export default async function AdminSettingsPage() {
  const settings = await getAdminSettings();

  return (
    <div className="w-full">
      <PageHeader
        title="Admin settings"
        description="Maintenance mode and objection email routing."
      />
      <AdminSettingsForm initial={settings} />
    </div>
  );
}
