import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, School } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CredentialMailBar } from "@/features/auth/credential-mail-bar";
import { verifyHeadOfficeSession } from "@/features/head-office-auth/session";
import { EnterSchoolButton } from "@/features/head-office-portal/enter-school-button";
import { BOARD_LABELS } from "@/features/schools/constants";
import { SchoolStatusBadge } from "@/features/schools/school-status-badge";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import { cn } from "@/lib/utils";
import { getHeadOfficeSchool } from "@/services/head-office-portal";
import { formatDateTime, formatNumber } from "@/utils/format";

export const metadata: Metadata = { title: "School Profile" };

const EMPTY = "—";

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
      <h2 className="flex items-center gap-2.5 border-b border-brand-100 bg-brand-50/60 px-4 py-2 text-sm font-semibold text-brand-950">
        <span className="flex size-6 items-center justify-center rounded-md border border-brand-200 bg-white text-brand-700 [&_svg]:size-3.5">
          {icon}
        </span>
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3 sm:grid-cols-3">{children}</dl>
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

export default async function HeadOfficeSchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyHeadOfficeSession();
  const { id } = await params;
  let school: Awaited<ReturnType<typeof getHeadOfficeSchool>>;
  try {
    school = await getHeadOfficeSchool(id);
  } catch {
    notFound();
  }

  const canManage = school.status === "ACTIVE";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/head-office/schools"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
        >
          <ArrowLeft className="size-3.5" />
          Back to schools
        </Link>
        {canManage ? (
          <EnterSchoolButton schoolId={school.id} label="Open school" />
        ) : (
          <p className="text-xs text-neutral-500">Inactive schools cannot be opened.</p>
        )}
      </div>

      <header className="rounded-xl border border-brand-700 bg-linear-to-r from-brand-800 to-brand-950 px-5 py-4 text-white shadow-[0_10px_30px_-12px_rgb(25_28_95/0.55)]">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
          School profile
        </p>
        <h1 className="mt-0.5 truncate text-xl font-bold sm:text-2xl">{school.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {school.addressLine}, {school.city}, {school.state}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 font-mono text-sm font-bold">
            {school.code}
          </span>
          <SchoolTypeBadge type={school.type} />
          <SchoolStatusBadge status={school.status} />
        </div>
      </header>

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <Panel title="School details" icon={<School />}>
          <Field label="School Name">{school.name}</Field>
          <Field label="School Code">
            <span className="font-mono">{school.code}</span>
          </Field>
          <Field label="Board">{BOARD_LABELS[school.board]}</Field>
          <Field label="Type">{school.type === "CUSTOMIZED" ? "Customized" : "Regular"}</Field>
          <Field label="Principal">{school.principalName}</Field>
          <Field label="Seat Limit">
            {school.studentStrength ? formatNumber(school.studentStrength) : null}
          </Field>
          <Field label="Contact Name">{school.contactName}</Field>
          <Field label="Contact Phone">{school.contactPhone}</Field>
          <Field label="Contact Email" span={2}>
            {school.contactEmail}
          </Field>
        </Panel>

        <Panel title="Address" icon={<MapPin />}>
          <Field label="Address" span={3}>
            {school.addressLine}
          </Field>
          <Field label="City">{school.city}</Field>
          <Field label="State">{school.state}</Field>
          <Field label="Pincode">{school.pincode}</Field>
          <Field label="Created">{formatDateTime(school.createdAt)}</Field>
          <Field label="Updated">{formatDateTime(school.updatedAt)}</Field>
        </Panel>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-950">School admin login</h2>
        <CredentialMailBar
          loginEmail={school.accountEmail ?? ""}
          loginPhone={school.accountPhone}
          password={school.password}
          recipientLabel="school admin"
          target={{ kind: "head-office-school", id: school.id }}
        />
      </div>
    </div>
  );
}
