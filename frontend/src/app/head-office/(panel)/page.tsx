import Link from "next/link";
import { Building2, CheckCircle2, School, School2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { Meter, Panel, STAT_GRID, StatCard } from "@/features/admin/dashboard-parts";
import { verifyHeadOfficeSession } from "@/features/head-office-auth/session";
import { SchoolStatusBadge } from "@/features/schools/school-status-badge";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import { ProfileLink } from "@/components/shared/profile-link";
import { cn } from "@/lib/utils";
import { getHeadOfficeDashboard } from "@/services/head-office-portal";
import { formatDate } from "@/utils/format";

export default async function HeadOfficeDashboardPage() {
  await verifyHeadOfficeSession();
  const stats = await getHeadOfficeDashboard();
  const activeShare = stats.total === 0 ? 0 : Math.round((stats.active / stats.total) * 100);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${stats.officeName} · ${stats.officeCode}`}
        actions={
          <Link
            href="/head-office/schools"
            className={cn(buttonVariants(), "h-10 w-full sm:w-auto")}
          >
            All Schools
          </Link>
        }
      />

      <div className={cn(STAT_GRID, "sm:grid-cols-2 xl:grid-cols-4")}>
        <StatCard
          label="Total schools"
          value={stats.total}
          hint={`${stats.active} active · ${stats.inactive} inactive`}
          icon={School}
          href="/head-office/schools"
        />
        <StatCard
          label="Active schools"
          value={stats.active}
          hint={`${activeShare}% of your schools`}
          icon={CheckCircle2}
          href="/head-office/schools"
        />
        <StatCard
          label="Regular"
          value={stats.regular}
          hint="Regular program schools"
          icon={School2}
          href="/head-office/schools"
        />
        <StatCard
          label="Customized"
          value={stats.customized}
          hint="Customized program schools"
          icon={Building2}
          href="/head-office/schools"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel compact title="School overview" description="Status and type across your schools.">
          <div className="space-y-2.5">
            <Meter label="Active" value={stats.active} max={stats.total} color="bg-brand-900" />
            <Meter label="Inactive" value={stats.inactive} max={stats.total} color="bg-neutral-400" />
            <Meter label="Regular" value={stats.regular} max={stats.total} color="bg-blue-600" />
            <Meter label="Customized" value={stats.customized} max={stats.total} color="bg-sky-400" />
          </div>
        </Panel>

        <Panel
          compact
          title="Recently added"
          description="Latest schools linked to this office."
          action={
            <Link
              href="/head-office/schools"
              className="inline-flex h-8 items-center rounded-lg border border-brand-200 px-3 text-xs font-semibold text-brand-900 transition-colors hover:bg-brand-50"
            >
              View all
            </Link>
          }
        >
          {stats.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              No schools linked yet. Ask an admin to attach schools to this office.
            </p>
          ) : (
            <ul className="divide-y divide-brand-100">
              {stats.recent.map((school) => (
                <li key={school.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <ProfileLink
                      href={`/head-office/schools/${school.id}`}
                      className="block truncate text-sm font-semibold"
                    >
                      {school.name}
                    </ProfileLink>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {school.code} · {school.city}, {school.state}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SchoolTypeBadge type={school.type} size="sm" />
                    <SchoolStatusBadge status={school.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {stats.recent.length > 0 ? (
        <p className="mt-3 text-xs text-neutral-500">
          Newest school registered {formatDate(stats.recent[0]!.createdAt)}.
        </p>
      ) : null}
    </>
  );
}
