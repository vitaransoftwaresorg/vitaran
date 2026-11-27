import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ChevronRight, Mail, MapPin, Phone, School, User } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HeadOfficeDetailActions } from "@/features/head-offices/head-office-detail-actions";
import { SchoolStatusBadge } from "@/features/schools/school-status-badge";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import { cn } from "@/lib/utils";
import { getHeadOffice } from "@/services/head-offices";
import { formatNumber } from "@/utils/format";

export const metadata: Metadata = { title: "Head Office" };

const EMPTY = "—";

function Panel({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]",
        className,
      )}
    >
      <h2 className="flex items-center gap-2.5 border-b border-brand-100 bg-brand-50/60 px-4 py-2 text-sm font-semibold text-brand-950">
        <span className="flex size-6 items-center justify-center rounded-md border border-brand-200 bg-white text-brand-700 [&_svg]:size-3.5">
          {icon}
        </span>
        {title}
      </h2>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function Field({ label, span, children }: { label: string; span?: 2 | 3; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", span === 2 && "sm:col-span-2", span === 3 && "col-span-2 sm:col-span-3")}>
      <dt className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-neutral-950">{children ?? EMPTY}</dd>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-18 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-center">
      <p className="text-[9px] font-semibold tracking-wider text-white/50 uppercase">{label}</p>
      <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export default async function HeadOfficeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const office = await getHeadOffice(id);
  if (!office) notFound();

  const location = [office.city, office.state].filter(Boolean).join(", ");
  const activeSchools = office.schools.filter((school) => school.status === "ACTIVE").length;

  return (
    <div className="space-y-3">
      <header className="rounded-xl border border-brand-700 bg-linear-to-r from-brand-800 to-brand-950 px-5 py-4 text-white shadow-[0_10px_30px_-12px_rgb(25_28_95/0.55)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white">
              <Building2 className="size-7" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
                Head office profile
              </p>
              <h1 className="mt-0.5 truncate text-xl font-bold sm:text-2xl">{office.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">
                  {office.addressLine}
                  {location ? `, ${location}` : ""}
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <HeadOfficeDetailActions office={office} inverted />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="Code" value={<span className="font-mono">{office.code}</span>} />
          <Chip label="Schools" value={formatNumber(office.schools.length)} />
          <Chip label="Active" value={formatNumber(activeSchools)} />
          <Chip label="City" value={office.city || EMPTY} />
          <Chip label="State" value={office.state || EMPTY} />
        </div>
      </header>

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <Panel title="Office details" icon={<Building2 />}>
          <dl className="grid h-full grid-cols-2 content-start gap-x-4 gap-y-2.5 px-4 py-3 sm:grid-cols-3">
            <Field label="Office Name" span={2}>
              {office.name}
            </Field>
            <Field label="Office Code">
              <span className="font-mono">{office.code}</span>
            </Field>
            <Field label="Contact Name">
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3.5 text-neutral-400" />
                {office.contactName}
              </span>
            </Field>
            <Field label="Contact Phone">
              <a
                href={`tel:${office.contactPhone}`}
                className="inline-flex items-center gap-1.5 text-brand-900 hover:underline"
              >
                <Phone className="size-3.5 text-neutral-400" />
                {office.contactPhone}
              </a>
            </Field>
            <Field label="Contact Email" span={2}>
              <a
                href={`mailto:${office.contactEmail}`}
                className="inline-flex items-center gap-1.5 break-all text-brand-900 hover:underline"
              >
                <Mail className="size-3.5 shrink-0 text-neutral-400" />
                {office.contactEmail}
              </a>
            </Field>
          </dl>
        </Panel>

        <Panel title="Address" icon={<MapPin />}>
          <dl className="grid h-full grid-cols-2 content-start gap-x-4 gap-y-2.5 px-4 py-3 sm:grid-cols-3">
            <Field label="Address" span={3}>
              {office.addressLine}
            </Field>
            <Field label="City">{office.city}</Field>
            <Field label="State">{office.state}</Field>
            <Field label="Pincode">{office.pincode}</Field>
            {office.notes ? (
              <Field label="Notes" span={3}>
                <span className="whitespace-pre-line font-normal text-neutral-700">{office.notes}</span>
              </Field>
            ) : null}
          </dl>
        </Panel>
      </div>

      <Panel title={`Schools (${office.schools.length})`} icon={<School />}>
        {office.schools.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-neutral-950">No schools attached yet</p>
            <p className="mt-1 text-sm text-neutral-500">
              Attach schools from the school list when you edit this office.
            </p>
            <Link
              href={`/admin/head-offices/${office.id}/edit`}
              className={cn(buttonVariants({ size: "sm" }), "mt-4")}
            >
              Add schools
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-brand-100">
            {office.schools.map((school) => (
              <li key={school.id}>
                <Link
                  href={`/admin/schools/${school.id}?from=head-office&office=${encodeURIComponent(office.id)}`}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-brand-50/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-800">
                    <School className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-950 group-hover:text-brand-900 group-hover:underline">
                        {school.name}
                      </span>
                      <SchoolTypeBadge type={school.type} size="sm" />
                      <SchoolStatusBadge status={school.status} />
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      <span className="font-mono">{school.code}</span>
                      {" · "}
                      {school.city}, {school.state}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-neutral-300 group-hover:text-brand-700" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
