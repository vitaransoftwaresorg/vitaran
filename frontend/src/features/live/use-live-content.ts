"use client";

import { useEffect, useRef } from "react";
import type { LiveContentKind } from "./kinds";
import { subscribeLive, type LiveChangePayload } from "./live-bus";
import { isLiveSilenced } from "./silence";

export type { LiveContentKind };
export type { LiveChangePayload };

const DEFAULT_LIVE_PATH = "/live";
/** Coalesce bursty SSE (e.g. multi-page OMR) without feeling laggy. */
const REFRESH_DEBOUNCE_MS = 50;

/**
 * Calls `onChange` when matching content changes on another session
 * (admin / school / teacher), so pages update without a manual refresh.
 * Shares one EventSource per path via the live bus.
 */
export function useLiveContent(
  kind: LiveContentKind | "all",
  onChange: (payload?: LiveChangePayload) => void,
  path: string = DEFAULT_LIVE_PATH,
  debounceMs: number = REFRESH_DEBOUNCE_MS,
  options?: {
    /** Settings must still apply during local silence / maintenance pause. */
    ignoreSilence?: boolean;
  },
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const ignoreSilence = options?.ignoreSilence === true;

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let pending: LiveChangePayload | undefined;

    const flush = () => {
      const payload = pending;
      pending = undefined;
      if (!ignoreSilence && isLiveSilenced()) return;
      onChangeRef.current(payload);
    };

    const schedule = (payload: LiveChangePayload) => {
      if (!ignoreSilence && isLiveSilenced()) return;
      pending = payload;
      if (debounceMs <= 0) {
        flush();
        return;
      }
      // Leading-edge: fire once ASAP, ignore further events until the window ends.
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        flush();
      }, debounceMs);
    };

    const unsubscribe = subscribeLive(path, (payload) => {
      if (kind === "all" || payload.kind === kind) schedule(payload);
    });

    return () => {
      unsubscribe();
      clearTimeout(refreshTimer);
    };
  }, [kind, path, debounceMs, ignoreSilence]);
}
