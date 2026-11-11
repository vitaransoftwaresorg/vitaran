"use client";

import { useEffect, useState } from "react";
import { getPublicSettingsClient } from "@/services/settings-client";

/** Shown on school/teacher portals when admin turns maintenance on. */
export function MaintenanceBanner() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPublicSettingsClient()
      .then((settings) => {
        if (!cancelled) setOn(settings.maintenanceMode);
      })
      .catch(() => {
        if (!cancelled) setOn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!on) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-950">
      Vitaran Learning is under maintenance. Some features may be unavailable.
    </div>
  );
}
