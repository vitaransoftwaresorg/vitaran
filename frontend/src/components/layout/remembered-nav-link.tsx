"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { useRememberedNavHref } from "@/features/portal-nav/portal-nav-memory";

/** Next.js Link that restores the last URL visited under this sidebar section. */
export function RememberedNavLink({
  rootHref,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { rootHref: string }) {
  const href = useRememberedNavHref(rootHref);
  return <Link href={href} {...props} />;
}
