"use client";

/**
 * Soft-nav to a roster/results page, then refresh so new students show without a
 * manual reload. `router.push` + immediate `refresh` can still paint a stale
 * soft-nav cache of the destination; a short follow-up refresh fixes that.
 */
export function navigateFresh(
  router: { push: (href: string) => void; refresh: () => void },
  href: string,
) {
  router.push(href);
  router.refresh();
  window.setTimeout(() => {
    router.refresh();
  }, 120);
}
