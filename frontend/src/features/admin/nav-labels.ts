"use client";

/** Client cache so top-nav can show school/program names without waiting on Suspense. */

import { useSyncExternalStore } from "react";

let version = 0;
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function key(kind: string, id: string) {
  return `${kind}:${id}`;
}

function storageKey(kind: string, id: string) {
  return `admin-nav:${key(kind, id)}`;
}

export function getAdminNavLabelsVersion() {
  return version;
}

export function subscribeAdminNavLabels(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function rememberAdminNavLabel(
  kind: "school" | "program" | "office",
  id: string,
  label: string,
) {
  const next = label.trim();
  if (!id || !next) return;
  const k = key(kind, id);
  if (memory.get(k) === next) return;
  memory.set(k, next);
  try {
    sessionStorage.setItem(storageKey(kind, id), next);
  } catch {
    // Private mode / quota — memory still works for this tab session.
  }
  version += 1;
  for (const listener of [...listeners]) listener();
}

export function readAdminNavLabel(
  kind: "school" | "program" | "office",
  id: string,
): string | null {
  const k = key(kind, id);
  const hit = memory.get(k);
  if (hit) return hit;
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(storageKey(kind, id));
    if (stored) {
      memory.set(k, stored);
      return stored;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Hydration-safe: server + first client paint return null, then session/memory after mount.
 * Do not call `readAdminNavLabel` during render — it can disagree with SSR HTML.
 */
export function useAdminNavLabel(
  kind: "school" | "program" | "office",
  id: string | null,
): string | null {
  return useSyncExternalStore(
    subscribeAdminNavLabels,
    () => (id ? readAdminNavLabel(kind, id) : null),
    () => null,
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `/admin/schools/:uuid/...` → school id */
export function schoolIdFromAdminPath(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/schools\/([^/]+)/);
  if (!match || match[1] === "new" || match[1] === "students") return null;
  return UUID.test(match[1]!) ? match[1]! : null;
}

/** `/admin/head-offices/:uuid/...` → office id */
export function officeIdFromAdminPath(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/head-offices\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return UUID.test(match[1]!) ? match[1]! : null;
}
