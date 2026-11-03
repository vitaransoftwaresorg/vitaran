"use client";

import { usePathname } from "next/navigation";
import { useInPageBackHandler } from "@/components/layout/in-page-back";
import { PortalBackButton } from "./portal-back-button";

/** On-page back — never in the header. */
export function PortalPageBack({
  getParentHref,
  homeHref,
  homeHrefs,
}: {
  getParentHref: (pathname: string, search?: string) => string | null;
  homeHref: string;
  homeHrefs?: string[];
}) {
  const pathname = usePathname();
  const inPageBack = useInPageBackHandler();
  const roots = new Set([homeHref, ...(homeHrefs ?? [])]);
  // Nav roots hide Back unless an in-page stack (e.g. classes → roster) is active.
  if (roots.has(pathname) && !inPageBack) return null;

  return (
    <div className="mb-2 md:mb-3">
      <PortalBackButton
        getParentHref={getParentHref}
        homeHref={homeHref}
        homeHrefs={homeHrefs}
      />
    </div>
  );
}
