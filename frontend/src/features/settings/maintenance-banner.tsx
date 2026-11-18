"use client";

import { usePublicSettings } from "@/features/settings/use-public-settings";

/** Shown on school/teacher portals when admin turns maintenance on. */
export function MaintenanceBanner() {
  const { settings, ready } = usePublicSettings();
  if (!ready || !settings.maintenanceMode) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-950">
      Vitaran Learning is under maintenance. Some features may be unavailable.
    </div>
  );
}
