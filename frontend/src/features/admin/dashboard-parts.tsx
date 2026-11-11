import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/format";

const SURFACE = "rounded-2xl border border-neutral-200 bg-white shadow-sm";

type StatCardProps = {
  label: string;
  value?: number;
  hint: string;
  icon: LucideIcon;
  href: string;
};

/** Two per row on phones, more on wider screens; the whole card is the link. */
export function StatCard({ label, value, hint, icon: Icon, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        SURFACE,
        "group flex min-w-0 flex-col gap-3 p-4 transition-[border-color,box-shadow] hover:border-brand-200 hover:shadow-md sm:p-5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-900 ring-1 ring-brand-100 transition-colors group-hover:bg-brand-900 group-hover:text-white sm:size-10">
          <Icon className="size-4 sm:size-5" />
        </span>
        <ArrowUpRight className="size-4 text-neutral-300 transition-colors group-hover:text-brand-900" />
      </div>
      <div className="min-w-0">
        {value !== undefined && (
          <p className="text-2xl leading-tight font-bold text-neutral-950 tabular-nums sm:text-3xl">
            {formatNumber(value)}
          </p>
        )}
        <p className="truncate text-sm font-semibold text-neutral-800">{label}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{hint}</p>
      </div>
    </Link>
  );
}

/** Full-width call to action, e.g. OMR Scan, which has no count to show. */
export function ActionBanner({
  href,
  icon: Icon,
  title,
  description,
  cta,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl bg-brand-900 p-4 text-white shadow-sm transition-colors hover:bg-brand-800 sm:gap-4 sm:p-5"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 sm:size-12">
        <Icon className="size-5 sm:size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-white/75 sm:text-sm">{description}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-900 sm:inline-flex">
        {cta}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
      <ArrowRight className="size-5 shrink-0 text-white/80 sm:hidden" />
    </Link>
  );
}

/** Stat-card grid used by every dashboard, so phones and laptops line up the same way. */
export const STAT_GRID = "grid grid-cols-2 gap-3 sm:gap-4";

type PanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
};

export function Panel({ title, description, action, compact, className, children }: PanelProps) {
  return (
    <section className={cn(SURFACE, "flex flex-col", compact ? "p-4" : "p-5 sm:p-6", className)}>
      <header className={cn("flex items-start justify-between gap-3", compact ? "mb-3" : "mb-5")}>
        <div>
          <h2 className={cn("font-bold text-neutral-950", compact ? "text-sm" : "text-base")}>{title}</h2>
          {description && (
            <p className={cn("mt-0.5 text-neutral-500", compact ? "text-xs" : "text-sm")}>{description}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

type MeterProps = {
  label: string;
  value: number;
  /** The bar is full at this value. */
  max: number;
  /** Tailwind background class for the filled part. */
  color?: string;
};

export function Meter({ label, value, max, color = "bg-brand-900" }: MeterProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-neutral-900">{label}</span>
        <span className="font-semibold text-neutral-900 tabular-nums">{formatNumber(value)}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2 overflow-hidden rounded-full bg-neutral-100"
      >
        <div className={cn("h-full rounded-full transition-[width]", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="text-lg font-bold text-neutral-950 tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-200/80", className)} />;
}

export function PanelFallback() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-md bg-neutral-200/80" />
      <div className="h-40 animate-pulse rounded-2xl bg-neutral-200/60" />
      <div className="h-40 animate-pulse rounded-2xl bg-neutral-200/60" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className={cn(STAT_GRID, "xl:grid-cols-4")}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={cn(SURFACE, "flex flex-col gap-3 p-4 sm:p-5")}>
            <Pulse className="size-9 rounded-xl sm:size-10" />
            <Pulse className="h-7 w-14" />
            <Pulse className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className={cn(SURFACE, "space-y-3 p-4")}>
            <Pulse className="h-4 w-40" />
            <Pulse className="h-3 w-56" />
            <Pulse className="h-2 w-full" />
            <Pulse className="h-2 w-full" />
            <Pulse className="h-2 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
