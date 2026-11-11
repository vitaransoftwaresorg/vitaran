"use client";

import { useEffect, useRef } from "react";

type Guard = (proceed: () => void) => void;

let guard: Guard | null = null;

/** Run a navigation, unless a page with unsaved work wants to ask first (it calls `proceed` when the user agrees). */
export function guardedLeave(proceed: () => void) {
  if (guard) guard(proceed);
  else proceed();
}

function internalHref(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return null;
  if (link.target && link.target !== "_self") return null;
  if (link.hasAttribute("download")) return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url.pathname + url.search + url.hash;
}

/**
 * While `active`, leaving through a link or the portal Back button calls `onLeave(proceed)` instead.
 * Refresh / closing the tab gets the browser's own "Leave site?" prompt.
 */
export function useLeaveGuard(active: boolean, onLeave: Guard, navigate: (href: string) => void) {
  const onLeaveRef = useRef(onLeave);
  const navigateRef = useRef(navigate);
  useEffect(() => {
    onLeaveRef.current = onLeave;
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (!active) return;
    const mine: Guard = (proceed) => onLeaveRef.current(proceed);
    guard = mine;

    // Capture on document runs before Next <Link> sees the click.
    const onClick = (event: MouseEvent) => {
      const href = internalHref(event);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      onLeaveRef.current(() => navigateRef.current(href));
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      if (guard === mine) guard = null;
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active]);
}
