"use client";

import { useInPageBackHandler } from "@/components/layout/in-page-back";
import { PortalBackButton } from "./portal-back-button";

/**
 * Back only for in-page stacks (roster, OMR review queue).
 * Route parents are handled by the top navbar breadcrumbs — no second nav row.
 */
export function PortalPageBack({
  getParentHref,
  homeHref,
  homeHrefs,
}: {
  getParentHref: (pathname: string, search?: string) => string | null;
  homeHref: string;
  homeHrefs?: string[];
}) {
  const inPageBack = useInPageBackHandler();
  if (!inPageBack) return null;

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
