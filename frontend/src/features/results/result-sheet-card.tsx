"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { Download, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProfileLink } from "@/components/shared/profile-link";
import { cn } from "@/lib/utils";
import type { ResultCell, ResultSheet } from "@/types/result";
import { studentCount } from "./constants";
import type { ClassScan } from "@/types/scan";
import { ClassOmrDownload, OmrCell } from "./omr-files";
import { ClassRankCardsDownload, ClassResultPdfDownload, RankCardCell } from "./rank-card-files";
import { columnRole, foldRoll, maxFromLabel, numberCell, type ColumnRole } from "./result-columns";

function formatCell(value: ResultCell) {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Columns with the same value for every student (e.g. "CLASS: 8-OLY") are shown once as tags. */
function splitColumns({ columns, rows }: Pick<ResultSheet, "columns" | "rows">) {
  const constant = (index: number) => {
    const first = rows[0]?.[index] ?? null;
    return rows.length > 1 && first !== null && rows.every((row) => row[index] === first);
  };
  const shown = columns.map((_, index) => index).filter((index) => !constant(index));
  const tags = columns
    .map((label, index) => ({ label, value: rows[0]?.[index] ?? null, index }))
    .filter(({ index }) => !shown.includes(index));
  const numeric = new Set(
    shown.filter((index) => {
      const filled = rows.map((row) => row[index]).filter((value) => value !== null);
      return filled.length > 0 && filled.every((value) => typeof value === "number");
    }),
  );
  return { shown, tags, numeric };
}

const SHORT_HEADINGS: Partial<Record<NonNullable<ColumnRole>, string>> = {
  roll: "Reg No",
  name: "Student",
  classRank: "Rank",
  sectionRank: "Sec Rank",
  percentage: "%",
};

/** Phone headings: short names, with a subject's max marks on its own line. */
function MobileHeading({ label, role }: { label: string; role: ColumnRole }) {
  const max = maxFromLabel(label);
  const text = (role && SHORT_HEADINGS[role]) || label.replace(/\s*\(\s*\d+(?:\.\d+)?\s*m?\s*\)\s*/i, " ").trim();
  return (
    <span className="inline-flex flex-col items-center sm:hidden">
      <span>{text}</span>
      {max != null && role !== "percentage" ? (
        <span className="font-medium text-brand-700/70">{max}</span>
      ) : null}
    </span>
  );
}

type ResultSheetCardProps = {
  sheet: ResultSheet;
  downloadHref: string;
  showDownload?: boolean;
  emptyMessage?: string;
  /** Roll and name cells link to `${base}/${roll}${query}`. */
  studentLink?: { base: string; query?: string };
  /** Rank card and OMR columns, served from the portal's results section. */
  files?: {
    basePath: string;
    resultSetId: string;
    scans: ClassScan[];
    path: { schoolId: string; testNumber: number; classLevel: number; program?: string };
  };
};

/** A class's results: title, search and download in one header, then the students. */
export function ResultSheetCard({
  sheet,
  downloadHref,
  showDownload = true,
  emptyMessage = "No students from your classes in this result.",
  studentLink,
  files,
}: ResultSheetCardProps) {
  const roles = sheet.columns.map(columnRole);
  const rollCol = roles.indexOf("roll");
  const nameCol = roles.indexOf("name");
  const markCols = roles.flatMap((role, index) => (role === "subject" || role === "total" ? [index] : []));
  const cardTarget = files
    ? { resultSetId: files.resultSetId, classLevel: sheet.classLevel, basePath: files.basePath }
    : null;
  const scanByRoll = new Map((files?.scans ?? []).map((scan) => [foldRoll(scan.rollNo), scan]));
  const rollOf = (row: ResultCell[]) => (rollCol >= 0 ? String(row[rollCol] ?? "").trim() : "");
  const hasMarks = (row: ResultCell[]) => markCols.some((index) => numberCell(row[index]) != null);
  const studentHref = (row: ResultCell[]) => {
    const roll = rollCol >= 0 ? row[rollCol] : null;
    if (!studentLink || roll == null || String(roll).trim() === "") return null;
    return `${studentLink.base}/${encodeURIComponent(String(roll).trim())}${studentLink.query ?? ""}`;
  };
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const { shown, tags, numeric } = splitColumns(sheet);
  // The sheet's last title line is the specific one, e.g. "TEST-3 9-SEP-2026 (Max. Marks: 300)".
  const detail = sheet.caption.at(-1);

  // Rows come sorted by rank, so an uploaded serial number would read out of order.
  const serialCol = roles.indexOf("serial");
  const rows =
    serialCol < 0 ? sheet.rows : sheet.rows.map((row, position) => row.map((cell, index) => (index === serialCol ? position + 1 : cell)));
  const visible = deferredQuery
    ? rows.filter((row) =>
        row.some((value) => value !== null && String(value).toLowerCase().includes(deferredQuery)),
      )
    : rows;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-neutral-950">
            {sheet.classLabel || sheet.label || `Class ${sheet.classLevel}`}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-800">{studentCount(sheet.rowCount)}</span>
            {detail && (
              <>
                <span aria-hidden className="text-neutral-300">·</span>
                <span>{detail}</span>
              </>
            )}
            {tags.map(({ label, value }) => (
              <span
                key={label}
                className="rounded-md border border-brand-100 bg-brand-50 px-1.5 py-px text-[11px] font-medium text-brand-800"
              >
                {label}: {formatCell(value)}
              </span>
            ))}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <InputGroup className="h-10 w-full bg-white sm:w-64">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search students"
              aria-label="Search students"
            />
          </InputGroup>
          {files ? (
            <>
              <ClassResultPdfDownload target={cardTarget} />
              <ClassRankCardsDownload target={cardTarget} />
              <ClassOmrDownload path={files.path} count={files.scans.length} basePath={files.basePath} />
            </>
          ) : null}
          {showDownload && (
            <Button
              nativeButton={false}
              className="h-10 shrink-0 rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-800"
              render={
                <Link
                  href={downloadHref}
                  download={sheet.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  prefetch={false}
                  title="Download Excel"
                />
              }
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          )}
        </div>
      </header>

      {visible.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="border-brand-100 bg-brand-50 hover:bg-brand-50">
              {shown.map((index) => (
                <TableHead
                  key={index}
                  className={cn(
                    "h-auto px-2.5 py-3 text-left align-top text-[11px] sm:align-bottom leading-tight font-semibold tracking-wide whitespace-nowrap text-brand-900 uppercase first:pl-4 last:pr-4 sm:whitespace-normal sm:wrap-anywhere sm:first:pl-5 sm:last:pr-5",
                    numeric.has(index) && "text-right",
                  )}
                >
                  <MobileHeading label={sheet.columns[index]!} role={roles[index] ?? null} />
                  <span className="hidden sm:inline">{sheet.columns[index]}</span>
                </TableHead>
              ))}
              {files ? (
                <>
                  <TableHead className="h-auto px-2.5 py-3 text-center align-top text-[11px] font-semibold tracking-wide whitespace-nowrap sm:align-bottom text-brand-900 uppercase">
                    Rank card
                  </TableHead>
                  <TableHead className="h-auto px-2.5 py-3 pr-4 text-center align-top text-[11px] font-semibold tracking-wide whitespace-nowrap sm:align-bottom text-brand-900 uppercase sm:pr-5">
                    OMR
                  </TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-brand-50/50">
                {shown.map((index) => {
                  const href = roles[index] === "roll" || roles[index] === "name" ? studentHref(row) : null;
                  return (
                    <TableCell
                      key={index}
                      className={cn(
                        "px-2.5 py-2.5 whitespace-nowrap text-neutral-700 first:pl-4 last:pr-4 sm:whitespace-normal sm:wrap-anywhere sm:first:pl-5 sm:last:pr-5",
                        numeric.has(index) && "text-right text-neutral-950 tabular-nums",
                        row[index] === null && "text-neutral-300",
                      )}
                    >
                      {href && row[index] != null ? (
                        <ProfileLink href={href}>{formatCell(row[index])}</ProfileLink>
                      ) : (
                        formatCell(row[index] ?? null)
                      )}
                    </TableCell>
                  );
                })}
                {files ? (
                  <>
                    <TableCell className="px-1.5 py-1 text-center">
                      <RankCardCell
                        target={hasMarks(row) ? cardTarget : null}
                        roll={rollOf(row)}
                        name={nameCol >= 0 ? formatCell(row[nameCol] ?? null) : rollOf(row)}
                      />
                    </TableCell>
                    <TableCell className="px-1.5 py-1 pr-3 text-center sm:pr-4">
                      <OmrCell scan={scanByRoll.get(foldRoll(rollOf(row)))} basePath={files.basePath} />
                    </TableCell>
                  </>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <SearchX className="size-6 text-brand-300" />
          <p className="text-sm font-semibold text-neutral-900">
            {query ? `No students match “${query}”` : emptyMessage}
          </p>
          {query ? (
            <Button type="button" variant="link" onClick={() => setQuery("")} className="h-auto text-xs text-brand-700">
              Clear search
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
