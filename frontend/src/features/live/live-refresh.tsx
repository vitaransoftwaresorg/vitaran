"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useLiveContent } from "./use-live-content";

export type LiveContentKind = "answer-keys" | "results";

/**
 * Re-renders the page when the admin publishes, hides, edits or deletes this kind of content,
 * so schools and teachers see changes without reloading.
 */
export function LiveRefresh({ kind }: { kind: LiveContentKind }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useLiveContent(kind, refresh);
  return null;
}
