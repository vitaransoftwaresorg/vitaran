"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type InPageBackContextValue = {
  /** When set, layout ← Back runs this instead of route navigation. */
  handler: (() => void) | null;
  setHandler: (handler: (() => void) | null) => void;
};

const InPageBackContext = createContext<InPageBackContextValue | null>(null);

export function InPageBackProvider({ children }: { children: ReactNode }) {
  const [handler, setHandlerState] = useState<(() => void) | null>(null);
  const setHandler = useCallback((next: (() => void) | null) => {
    setHandlerState(() => next);
  }, []);
  const value = useMemo(() => ({ handler, setHandler }), [handler, setHandler]);
  return <InPageBackContext.Provider value={value}>{children}</InPageBackContext.Provider>;
}

function useInPageBackContext() {
  return useContext(InPageBackContext);
}

/** Layout Back reads this — nested client views register a handler. */
export function useInPageBackHandler() {
  return useInPageBackContext()?.handler ?? null;
}

/**
 * Register an in-page back step (e.g. roster → board). Clears on unmount.
 * Pass `null` when at the top level so layout Back uses normal routing.
 */
export function useRegisterInPageBack(handler: (() => void) | null) {
  const ctx = useInPageBackContext();
  useEffect(() => {
    if (!ctx) return;
    ctx.setHandler(handler);
    return () => ctx.setHandler(null);
  }, [ctx, handler]);
}
