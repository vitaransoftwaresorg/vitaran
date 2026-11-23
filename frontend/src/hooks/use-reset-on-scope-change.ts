"use client";

import { useEffect, useRef } from "react";

/**
 * Soft navigation often reuses the same client component instance across folders /
 * schools / classes. Any local UI state (search, dialog drafts) must reset when the
 * scope changes — otherwise users see "No matches" until a hard refresh.
 */
export function useResetOnScopeChange(scopeKey: string, reset: () => void) {
  const resetRef = useRef(reset);
  resetRef.current = reset;
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (prev.current === null) {
      prev.current = scopeKey;
      return;
    }
    if (prev.current === scopeKey) return;
    prev.current = scopeKey;
    resetRef.current();
  }, [scopeKey]);
}
