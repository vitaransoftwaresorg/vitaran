"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setLivePaused } from "@/features/live/silence";
import { usePublicSettings } from "@/features/settings/use-public-settings";
import { MaintenancePanel } from "@/features/settings/maintenance-panel";

type PortalMaintenanceGateProps = {
  /** Server-rendered flag so the first paint matches before live settings load. */
  initialMaintenance: boolean;
  children: ReactNode;
};

/**
 * Shows the maintenance panel instantly when admin toggles it (via /public-live),
 * and refreshes portal content when maintenance turns off — no manual reload.
 */
export function PortalMaintenanceGate({
  initialMaintenance,
  children,
}: PortalMaintenanceGateProps) {
  const router = useRouter();
  const { settings, ready } = usePublicSettings();
  const underMaintenance = ready ? settings.maintenanceMode : initialMaintenance;
  const wasMaintenance = useRef(underMaintenance);

  useEffect(() => {
    setLivePaused(underMaintenance);
    return () => setLivePaused(false);
  }, [underMaintenance]);

  useEffect(() => {
    if (wasMaintenance.current && !underMaintenance) {
      router.refresh();
    }
    wasMaintenance.current = underMaintenance;
  }, [underMaintenance, router]);

  if (underMaintenance) return <MaintenancePanel />;
  return children;
}
