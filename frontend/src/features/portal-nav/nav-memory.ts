/**
 * Remember the last URL inside each sidebar section so leaving and returning
 * (Schools → Answer Keys → Schools, etc.) restores that place for every section.
 */

const STORAGE_PREFIX = "vitaran:nav-last:";

function storageKey(rootHref: string) {
  return `${STORAGE_PREFIX}${rootHref}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

/** Longest matching sidebar root for this path (Students wins over Schools). */
export function navRootForPath(pathname: string, roots: string[]): string | null {
  const sorted = [...roots].sort((a, b) => b.length - a.length);
  for (const root of sorted) {
    // Dashboard / portal home — only when exactly on that page.
    if (root === "/admin" || root === "/school" || root === "/teacher") {
      if (pathname === root) return root;
      continue;
    }
    if (pathname === root || pathname.startsWith(`${root}/`)) return root;
  }
  return null;
}

function isSafeRememberedHref(rootHref: string, href: string) {
  if (!href || href.includes("://") || href.includes("..")) return false;
  const pathOnly = href.split("?")[0] ?? "";
  return pathOnly === rootHref || pathOnly.startsWith(`${rootHref}/`);
}

/**
 * Ephemeral detail pages (key editors, result sheets) — remember the folder (?from=)
 * so sidebar return after admin delete does not reopen a missing URL.
 */
function folderHrefFromEditor(pathname: string, search: string): string | null {
  const isKeyEditor = /\/(answer-keys|school-keys)\/[^/]+\/(answers|edit)$/.test(pathname);
  const isResultDetail = /\/results\/[^/]+$/.test(pathname);
  if (!isKeyEditor && !isResultDetail) return null;

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const from = params.get("from");
  if (from && !from.includes("://") && !from.includes("..")) {
    if (isKeyEditor) return from;
    const pathOnly = from.split("?")[0] ?? "";
    if (
      pathOnly === "/admin/results" ||
      pathOnly === "/school/results" ||
      pathOnly === "/teacher/results" ||
      pathOnly === "/results"
    ) {
      return from;
    }
  }

  // Result detail without a usable ?from= — remember the portal results root, not the sheet id.
  if (isResultDetail) {
    if (pathname.startsWith("/school/results/")) return "/school/results";
    if (pathname.startsWith("/teacher/results/")) return "/teacher/results";
    if (pathname.startsWith("/admin/results/")) return "/admin/results";
  }
  return null;
}

export function rememberPortalNavPath(
  pathname: string,
  search: string,
  roots: string[],
) {
  const store = storage();
  if (!store) return;
  const root = navRootForPath(pathname, roots);
  if (!root) return;
  const query = search.startsWith("?") ? search : search ? `?${search}` : "";
  const fromFolder = folderHrefFromEditor(pathname, query);
  const href = fromFolder ?? `${pathname}${query}`;
  if (!isSafeRememberedHref(root, href)) return;
  try {
    store.setItem(storageKey(root), href);
  } catch {
    // Private mode / quota — degrade to default sidebar links.
  }
}

export function readPortalNavPath(rootHref: string): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const stored = store.getItem(storageKey(rootHref));
    if (!stored || !isSafeRememberedHref(rootHref, stored)) return null;
    return stored;
  } catch {
    return null;
  }
}
