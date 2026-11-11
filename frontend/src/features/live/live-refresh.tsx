"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
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
  /** Admin cookie is Path=/admin — use `/admin/live` there. */
  path?: string;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useLiveContent(kind, refresh, path);
  return null;
}
