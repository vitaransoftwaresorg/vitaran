"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useInPageBackHandler } from "@/components/layout/in-page-back";
import { guardedLeave } from "@/lib/leave-guard";

type PortalBackButtonProps = {
  getParentHref: (pathname: string, search?: string) => string | null;
  homeHref: string;
  homeHrefs?: string[];
};

/** Plain ← Back — no tooltip, no button background. Same everywhere. */
export function PortalBackButton({
  getParentHref,
  homeHref,
  homeHrefs,
}: PortalBackButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const inPageBack = useInPageBackHandler();
  const roots = new Set([homeHref, ...(homeHrefs ?? [])]);

  // Nested in-page views (e.g. classes roster) still show Back even on a nav root URL.
  if (roots.has(pathname) && !inPageBack) return null;

  const goBack = () => {
    if (inPageBack) {
      inPageBack();
      return;
    }
    const search = typeof window === "undefined" ? "" : window.location.search;
    const href = getParentHref(pathname, search) ?? homeHref;
    router.push(href);
    // Same path, different Drive query — push alone can leave the folder stale.
    if (href.split("?")[0] === pathname) router.refresh();
  };

  return (
    <button
      type="button"
      onClick={() => guardedLeave(goBack)}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-900 hover:opacity-70 active:opacity-60"
    >
      <ArrowLeft className="size-4" strokeWidth={2.25} />
      Back
    </button>
  );
}
