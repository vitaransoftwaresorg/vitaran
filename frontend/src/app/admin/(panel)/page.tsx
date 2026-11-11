import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, KeyRound, Plus, School, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProfileLink, schoolProfileHref } from "@/components/shared/profile-link";
import { cn } from "@/lib/utils";
import {
  DashboardSkeleton,
  Meter,
  Panel,
  STAT_GRID,
  StatCard,
  SummaryTile,
} from "@/features/admin/dashboard-parts";
import { PageHeader } from "@/features/admin/page-header";
import { RESULTS_PATH } from "@/features/results/constants";
import { BOARD_LABELS, programLabel } from "@/features/schools/constants";
import { SchoolStatusBadge } from "@/features/schools/school-status-badge";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import { getAdminDashboard } from "@/services/schools";
import { formatDate } from "@/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

const HEAD = "h-10 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase";

/** One colour per program, in the brand's blues. */
const PROGRAM_COLORS = ["bg-brand-900", "bg-blue-600", "bg-sky-400", "bg-indigo-500", "bg-brand-400"];

const VIEW_ALL =
  "inline-flex h-8 items-center rounded-lg border border-brand-200 px-3 text-xs font-semibold text-brand-900 transition-colors hover:bg-brand-50";

const hiddenCount = ({ total, published }: { total: number; published: number }) => total - published;

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of schools and the content shared with them."
        actions={
          <>
            <Link
              href={RESULTS_PATH}
              className={buttonVariants({
                variant: "outline",
                className:
                  "h-10 flex-1 rounded-lg border-brand-200 px-4 text-brand-900 hover:bg-brand-50 sm:flex-none",
              })}
            >
              <Trophy />
              Enter results
            </Link>
            <Link
              href="/admin/schools/new"
              className={buttonVariants({
                className: "h-10 flex-1 rounded-lg bg-brand-900 px-4 text-white hover:bg-brand-800 sm:flex-none",
              })}
            >
              <Plus />
              Register school
            </Link>
          </>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  const { schools: stats, answerKeys, results } = await getAdminDashboard();
  const activeShare = stats.total === 0 ? 0 : Math.round((stats.active / stats.total) * 100);

  return (
    <>
      <div className={cn(STAT_GRID, "xl:grid-cols-4")}>
        <StatCard
          label="Total schools"
          value={stats.total}
          hint={`${stats.active} active · ${stats.inactive} inactive`}
          icon={School}
          href="/admin/schools"
        />
        <StatCard
          label="Active schools"
          value={stats.active}
          hint={`${activeShare}% of all schools`}
          icon={CheckCircle2}
          href="/admin/schools?status=ACTIVE"
        />
        <StatCard
          label="Answer keys"
          value={answerKeys.total}
          hint={`${answerKeys.published} published · ${hiddenCount(answerKeys)} hidden`}
          icon={KeyRound}
          href="/admin/answer-keys"
        />
        <StatCard
          label="Results"
          value={results.total}
          hint={`${results.published} published · ${hiddenCount(results)} hidden`}
          icon={Trophy}
          href="/admin/results"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel compact title="School overview" description="Status and type of every registered school.">
          <div className="mb-3 space-y-2.5">
            <Meter label="Active" value={stats.active} max={stats.total} color="bg-brand-900" />
            <Meter label="Inactive" value={stats.inactive} max={stats.total} color="bg-neutral-400" />
            <Meter label="Regular" value={stats.regular} max={stats.total} color="bg-blue-600" />
            <Meter label="Customized" value={stats.customized} max={stats.total} color="bg-sky-400" />
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-neutral-200 pt-3">
            <SummaryTile label="Published answer keys" value={answerKeys.published} />
            <SummaryTile label="Published results" value={results.published} />
          </div>
        </Panel>

        <Panel
          compact
          title="Program enrolment"
          description="Schools enrolled in each program."
          action={
            <span className="rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
              {stats.byProgram.length} programs
            </span>
          }
        >
          <div className="flex flex-1 flex-col justify-between gap-2.5">
            {stats.byProgram.map((row, index) => (
              <Meter
                key={row.program}
                label={programLabel(row.program, row.programName)}
                value={row.count}
                max={stats.total}
                color={PROGRAM_COLORS[index % PROGRAM_COLORS.length]}
              />
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          compact
          title="Recently registered"
          description="The latest schools added to the platform."
          action={
            <Link href="/admin/schools" className={VIEW_ALL}>
              View all
            </Link>
          }
        >
          {stats.recent.length > 0 ? (
            <div className="-mx-4 -mb-4">
              <Table>
                <TableHeader className="bg-neutral-50/80">
                  <TableRow className="border-brand-100 hover:bg-transparent">
                    <TableHead className={cn(HEAD, "h-8 pl-4")}>School</TableHead>
                    <TableHead className={cn(HEAD, "hidden h-8 2xl:table-cell")}>Board</TableHead>
                    <TableHead className={cn(HEAD, "hidden h-8 md:table-cell")}>Type</TableHead>
                    <TableHead className={cn(HEAD, "h-8")}>Status</TableHead>
                    <TableHead className={cn(HEAD, "hidden h-8 pr-4 md:table-cell")}>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent.map((school) => (
                    <TableRow key={school.id} className="border-brand-100/70 hover:bg-brand-50/30">
                      <TableCell className="max-w-56 py-2 pl-4">
                        <ProfileLink
                          href={schoolProfileHref(school.id)}
                          className="block truncate text-xs font-semibold"
                        >
                          {school.name}
                        </ProfileLink>
                        <span className="text-xs text-neutral-500">
                          {school.city}, {school.state}
                        </span>
                      </TableCell>
                      <TableCell className="hidden py-2 text-xs text-neutral-700 2xl:table-cell">
                        {BOARD_LABELS[school.board]}
                      </TableCell>
                      <TableCell className="hidden py-2 md:table-cell">
                        <SchoolTypeBadge type={school.type} size="sm" />
                      </TableCell>
                      <TableCell className="py-2">
                        <SchoolStatusBadge status={school.status} />
                      </TableCell>
                      <TableCell className="hidden py-2 pr-4 text-xs text-neutral-600 md:table-cell">
                        {formatDate(school.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <School />
                </EmptyMedia>
                <EmptyTitle>No schools yet</EmptyTitle>
                <EmptyDescription>Registered schools will appear here.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href="/admin/schools/new" className={buttonVariants({ size: "sm" })}>
                  <Plus />
                  Register school
                </Link>
              </EmptyContent>
            </Empty>
          )}
        </Panel>

        <Panel compact title="Schools by board" description="Distribution across curricula.">
          {stats.byBoard.length > 0 ? (
            <div className="flex flex-1 flex-col justify-between gap-2.5">
              {stats.byBoard.map((row) => (
                <Meter key={row.board} label={BOARD_LABELS[row.board]} value={row.count} max={stats.total} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No schools yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
