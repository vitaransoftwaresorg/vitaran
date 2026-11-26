"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type PortalCrumb = { label: string; href: string };

/** Shared top-navbar breadcrumbs for admin / school / teacher panels. */
export function PortalHeaderCrumbs({
  crumbs,
  className,
}: {
  crumbs: PortalCrumb[];
  className?: string;
}) {
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb className={cn("min-w-0 flex-1 overflow-hidden", className)}>
      <BreadcrumbList className="flex-nowrap gap-1.5 overflow-x-auto text-sm [scrollbar-width:none] sm:gap-2 sm:text-[1.05rem] [&::-webkit-scrollbar]:hidden">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.href}-${crumb.label}-${index}`}>
              {index > 0 ? (
                <BreadcrumbSeparator className="shrink-0 [&>svg]:size-4 text-neutral-400" />
              ) : null}
              <BreadcrumbItem className="min-w-0 shrink-0">
                {last ? (
                  <BreadcrumbPage className="max-w-[50vw] truncate font-medium text-brand-950 sm:max-w-[28rem]">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={<Link href={crumb.href} />}
                    className="max-w-[40vw] truncate font-medium text-brand-800 hover:text-brand-950 sm:max-w-[18rem]"
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
