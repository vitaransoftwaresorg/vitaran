"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { rememberPortalNavPath, readPortalNavPath } from "./nav-memory";

const NAV_MEMORY_EVENT = "vitaran:nav-memory";

function emitNavMemoryChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAV_MEMORY_EVENT));
}

function subscribeNavMemory(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NAV_MEMORY_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(NAV_MEMORY_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/** Writes the current URL under its sidebar section (every page in that section). */
export function PortalNavMemory({ roots }: { roots: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rootKey = useMemo(() => roots.slice().sort().join("|"), [roots]);

  useEffect(() => {
    const search = searchParams.toString();
    rememberPortalNavPath(pathname, search ? `?${search}` : "", roots);
    emitNavMemoryChange();
    // roots identity is stable via rootKey; list itself is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, rootKey]);

  return null;
}

/** Sidebar / crumb target: last place in this section, or the section home. */
export function useRememberedNavHref(rootHref: string) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const version = useSyncExternalStore(
    subscribeNavMemory,
    () => readPortalNavPath(rootHref) ?? rootHref,
    () => rootHref,
  );
  return useMemo(() => {
    void pathname;
    void searchParams;
    return version;
  }, [version, pathname, searchParams]);
}
