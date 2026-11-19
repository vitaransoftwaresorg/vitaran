"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { isLiveSilenced } from "./silence";
import { useLiveContent, type LiveContentKind } from "./use-live-content";

export type { LiveContentKind };

/**
 * Re-renders the page when matching content changes on another session
 * (admin / school / teacher), so lists and details update without a manual refresh.
 */
export function LiveRefresh({
  kind = "all",
  path,
}: {
  kind?: LiveContentKind | "all";
  /** Override SSE path (e.g. `/admin/live` on the admin panel). */
  path?: string;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const queued = useRef(false);

  const refresh = useCallback(() => {
    // Local publish/status toggles silence this tab so other switches don't blink.
    if (isLiveSilenced()) return;
    if (busy.current) {
      queued.current = true;
      return;
    }
    busy.current = true;
    queued.current = false;
    router.refresh();
    window.setTimeout(() => {
      busy.current = false;
      if (queued.current && !isLiveSilenced()) refresh();
    }, 120);
  }, [router]);

  useLiveContent(kind, (payload) => {
    // Settings (maintenance / public toggles) are handled by PortalMaintenanceGate
    // and usePublicSettings — refreshing RSC here races into 503s under maintenance.
    if (payload?.kind === "settings") return;
    refresh();
  }, path);

  return null;
}
