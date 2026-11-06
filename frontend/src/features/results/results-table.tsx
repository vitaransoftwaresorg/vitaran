import type { ReactNode } from "react";
import Link from "next/link";
import { Eye, FileSpreadsheet, Pencil, Trophy } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { wasEdited } from "@/features/documents/constants";
import { DateTime } from "@/features/documents/date-time-cell";
import { DeleteDocumentButton } from "@/features/documents/delete-document-button";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import type { ResultSet } from "@/types/result";
import { formatNumber } from "@/utils/format";
import { PublishSwitch } from "@/features/documents/publish-switch";
import { deleteResultAction, setResultPublishedAction } from "./actions";
import { RESULTS_PATH, resultEditHref, resultProgramLabel, resultSetHref } from "./constants";

const HEAD = "h-10 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase";

const ROW_ACTION =
  "inline-flex size-8 items-center justify-center text-neutral-500 transition-colors hover:bg-brand-50 hover:text-brand-900 [&_svg]:size-4";

type ResultsTableProps = {
  resultSets: ResultSet[];
  uploadHref: string;
  title?: string;
  /** Hidden on a school's own page, where every row is that school. */
  showSchool?: boolean;
  /** Shown beside the title; the header only renders when `title` is set. */
  headerAction?: ReactNode;
  /** The list is narrowed by filters, so an empty list means "no matches". */
  filtered?: boolean;
};

export function ResultsTable({
  resultSets,
  uploadHref,
  title,
  showSchool = true,
  headerAction,
  filtered = false,
}: ResultsTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_1px_2px_rgb(25_28_95/0.04),0_12px_32px_-16px_rgb(25_28_95/0.18)]">
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-neutral-950">{title}</h2>
            <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 tabular-nums">
              {resultSets.length}
            </span>
          </div>
          {headerAction}
        </header>
      )}

      {resultSets.length > 0 ? (
        <Table>
          <TableHeader className="bg-neutral-50/80">
            <TableRow className="border-brand-100 hover:bg-transparent">
              <TableHead className={cn(HEAD, "pl-6")}>Test</TableHead>
              {showSchool && <TableHead className={HEAD}>School</TableHead>}
              <TableHead className={cn(HEAD, "hidden lg:table-cell")}>Program</TableHead>
              <TableHead className={cn(HEAD, "hidden md:table-cell")}>Classes</TableHead>
              <TableHead className={cn(HEAD, "hidden text-right xl:table-cell")}>Students</TableHead>
              <TableHead className={cn(HEAD, "hidden sm:table-cell")}>Uploaded</TableHead>
              <TableHead className={cn(HEAD, "hidden sm:table-cell")}>Updated</TableHead>
              <TableHead className={HEAD}>Schools</TableHead>
              <TableHead className={cn(HEAD, "pr-6 text-right")}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultSets.map((resultSet) => {
              const program = resultProgramLabel(resultSet);
              const students = resultSet.classes.reduce((sum, item) => sum + item.rowCount, 0);
              const label = `Test ID ${resultSet.testId} · ${program}`;
              return (
                <TableRow key={resultSet.id} className="border-brand-100/70 hover:bg-brand-50/30">
                  <TableCell className="py-3.5 pl-6">
                    <Link href={resultSetHref(RESULTS_PATH, resultSet.id)} className="group flex items-center gap-3">
                      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-900 text-white">
                        <span className="text-[9px] font-semibold tracking-wider text-white/70 uppercase">No</span>
                        <span className="text-base leading-none font-bold tabular-nums">{resultSet.testNumber}</span>
                      </span>
                      <span className="min-w-0 lg:hidden">
                        <span className="block truncate text-sm font-medium text-neutral-950 group-hover:underline">{program}</span>
                        <span className="text-xs text-neutral-500">{resultSet.classes.length} classes</span>
                      </span>
                    </Link>
                  </TableCell>
                  {showSchool && (
                    <TableCell className="max-w-60">
                      <p className="truncate text-sm font-medium text-neutral-950" title={resultSet.school.name}>
                        {resultSet.school.name}
                      </p>
                      <p className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-[11px] text-neutral-500">{resultSet.school.code}</span>
                        <SchoolTypeBadge type={resultSet.school.type} size="sm" />
                      </p>
                    </TableCell>
                  )}
                  <TableCell className="hidden max-w-56 lg:table-cell">
                    <p className="truncate text-sm text-neutral-800" title={program}>{program}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {resultSet.classes.map((item) => (
                        <Link
                          key={item.classLevel}
                          href={resultSetHref(RESULTS_PATH, resultSet.id, item.classLevel)}
                          title={`Class ${item.classLevel} · ${item.rowCount} students`}
                          className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-brand-100 bg-brand-50 px-1.5 text-[11px] font-semibold text-brand-900 tabular-nums transition-colors hover:border-brand-900"
                        >
                          {item.classLevel}
                        </Link>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-right text-sm font-semibold text-neutral-900 tabular-nums xl:table-cell">
                    {formatNumber(students)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <DateTime iso={resultSet.createdAt} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <DateTime iso={wasEdited(resultSet) ? resultSet.updatedAt : null} />
                  </TableCell>
                  <TableCell>
                    <PublishSwitch
                      published={resultSet.published}
                      label={label}
                      onToggle={setResultPublishedAction.bind(null, resultSet.id)}
                    />
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="ml-auto flex w-fit divide-x divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                      <Link href={resultSetHref(RESULTS_PATH, resultSet.id)} title="View" aria-label={`View ${label}`} className={ROW_ACTION}>
                        <Eye />
                      </Link>
                      <Link href={resultEditHref(resultSet.id)} title="Edit" aria-label={`Edit ${label}`} className={ROW_ACTION}>
                        <Pencil />
                      </Link>
                      <DeleteDocumentButton
                        fileName={`${label} (${resultSet.classes.length} classes)`}
                        noun="result"
                        onDelete={deleteResultAction.bind(null, resultSet.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : filtered ? (
        <Empty className="py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trophy />
            </EmptyMedia>
            <EmptyTitle>No matching results</EmptyTitle>
            <EmptyDescription>Try another test, type or school.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Empty className="py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trophy />
            </EmptyMedia>
            <EmptyTitle>No results yet</EmptyTitle>
            <EmptyDescription>Imported Excel results will appear here, one row per test.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href={uploadHref} className={buttonVariants({ size: "sm" })}>
              <FileSpreadsheet />
              Import Excel
            </Link>
          </EmptyContent>
        </Empty>
      )}
    </section>
  );
}
