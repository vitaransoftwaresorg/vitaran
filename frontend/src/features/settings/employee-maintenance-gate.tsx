"use client";

import type { ReactNode } from "react";
import { PortalMaintenanceGate } from "@/features/settings/portal-maintenance-gate";

type EmployeeMaintenanceGateProps = {
  /** Root admin is never blocked — they must be able to turn maintenance off. */
  isRoot: boolean;
  initialMaintenance: boolean;
  children: ReactNode;
};

/** Blocks employee admin UI during maintenance; root admin keeps full access. */
export function EmployeeMaintenanceGate({
  isRoot,
  initialMaintenance,
  children,
}: EmployeeMaintenanceGateProps) {
  if (isRoot) return children;
  return (
    <PortalMaintenanceGate initialMaintenance={initialMaintenance}>
      {children}
    </PortalMaintenanceGate>
  );
}
