"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MaintenancePanel } from "@/features/settings/maintenance-panel";
import { usePublicSettings } from "@/features/settings/use-public-settings";

/** Static notice for refresh during maintenance — avoids portal RSC calls that return 503. */
export default function UnderMaintenancePage() {
  const router = useRouter();
  const { settings, ready } = usePublicSettings();

  useEffect(() => {
    if (ready && !settings.maintenanceMode) {
      router.replace("/");
    }
  }, [ready, settings.maintenanceMode, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 p-6">
      <MaintenancePanel />
    </main>
  );
}
