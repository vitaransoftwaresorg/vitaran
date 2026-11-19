"use client";

import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ResultClass } from "@/types/result";
import { resultSetHref } from "./constants";

type ResultClassTabsProps = {
  classes: ResultClass[];
  activeClassLevel: number;
  basePath: string;
  resultSetId: string;
  /** When true, unpublished class tabs toast instead of navigating. */
  blockUnpublished?: boolean;
  schoolCode?: string;
};

const BLOCKED =
  "Not Published. This class result will open here once the admin publishes it.";

/** Class switcher on a result detail page. */
export function ResultClassTabs({
  classes,
  activeClassLevel,
  basePath,
  resultSetId,
  blockUnpublished = false,
  schoolCode,
}: ResultClassTabsProps) {
  if (classes.length <= 1) return null;

  return (
    <nav aria-label="Class" className="flex gap-1.5 overflow-x-auto border-b border-brand-100">
      {classes.map((item) => {
        const active = item.classLevel === activeClassLevel;
        const href = resultSetHref(basePath, resultSetId, item.classLevel, schoolCode);
        const blocked = blockUnpublished && !item.published;

        if (blocked) {
          return (
            <button
              key={item.classLevel}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => toast.message(BLOCKED)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-brand-900 text-brand-900"
                  : "border-transparent text-neutral-400 hover:border-amber-200 hover:text-amber-900",
              )}
            >
              Class {item.classLevel}
            </button>
          );
        }

        return (
          <Link
            key={item.classLevel}
            href={href}
            aria-current={active ? "page" : undefined}
            scroll={false}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "border-brand-900 text-brand-900"
                : "border-transparent text-neutral-500 hover:border-brand-200 hover:text-brand-800",
            )}
          >
            Class {item.classLevel}
          </Link>
        );
      })}
    </nav>
  );
}
