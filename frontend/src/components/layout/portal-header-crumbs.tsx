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
    <Breadcrumb className={cn("min-w-0 flex-1", className)}>
      <BreadcrumbList className="flex-wrap gap-2 text-base sm:text-[1.05rem]">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.href}-${crumb.label}-${index}`}>
              {index > 0 ? (
                <BreadcrumbSeparator className="[&>svg]:size-4 text-neutral-400" />
              ) : null}
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage className="font-medium text-brand-950">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={<Link href={crumb.href} />}
                    className="font-medium text-brand-800 hover:text-brand-950"
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
