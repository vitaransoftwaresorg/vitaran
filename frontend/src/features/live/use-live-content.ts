"use client";

import { useEffect } from "react";

export type LiveContentKind =
  | "answer-keys"
  | "results"
  | "students"
  | "teachers"
  | "schools"
  | "sections"
  | "objections"
  | "programs";

const DEFAULT_LIVE_PATH = "/live";
const REFRESH_DEBOUNCE_MS = 1_500;
const MAX_RETRY_MS = 30_000;

/**
 * Calls `onChange` when another role publishes/edits matching content,
 * so portal and admin pages update without a manual refresh.
 */
export function useLiveContent(
  kind: LiveContentKind | "all",
  onChange: () => void,
  path: string = DEFAULT_LIVE_PATH,
) {
  useEffect(() => {
    let source: EventSource | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(onChange, REFRESH_DEBOUNCE_MS);
    };

    const connect = () => {
      source = new EventSource(path);

      source.onopen = () => {
        attempts = 0;
      };

      source.addEventListener("change", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent<string>).data) as {
            kind: LiveContentKind;
          };
          if (kind === "all" || data.kind === kind) refresh();
        } catch {
          // Ignore a malformed live event rather than crashing the page.
        }
      });

      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED) return;
        source.close();
        retryTimer = setTimeout(connect, Math.min(MAX_RETRY_MS, 2_000 * 2 ** attempts++));
      };
    };

    connect();
    return () => {
      source?.close();
      clearTimeout(retryTimer);
      clearTimeout(refreshTimer);
    };
  }, [kind, onChange, path]);
}
