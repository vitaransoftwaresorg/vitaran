"use client";

import { useDeferredValue, useState } from "react";
import { Search, SearchX } from "lucide-react";
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
import { useResetOnScopeChange } from "@/hooks/use-reset-on-scope-change";
import { cn } from "@/lib/utils";
import type { ResultCell, ResultSheet } from "@/types/result";
import { studentCount } from "./constants";
import { formatMarks, type ClassScan } from "@/types/scan";
import { ClassSheetExports } from "./class-sheet-exports";
import { OmrCell } from "./omr-files";
import { RankCardCell } from "./rank-card-files";
import {
  columnRole,
  ensureSerialColumn,
  foldRoll,
  maxFromLabel,
  numberCell,
  type ColumnRole,
} from "./result-columns";

function formatCell(value: ResultCell, role?: ColumnRole) {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  // Drop float residue (19.999000000000002 → 19.999) for school/teacher tables.
  if (typeof value === "number") {
    const text = formatMarks(value);
    return role === "percentage" ? `${text}%` : text;
  }
  if (role === "percentage" && value !== "") {
    const raw = String(value).trim();
    const numeric = Number(raw.replace(/%$/, "").trim());
    if (Number.isFinite(numeric)) {
      const text = formatMarks(numeric);
      return raw.endsWith("%") ? `${text}%` : `${text}%`;
    }
    return raw.endsWith("%") ? raw : `${raw}%`;
  }
  if (typeof value === "string" && /^-?\d+\.\d+$/.test(value.trim())) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return formatMarks(numeric);
  }
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
};

/** Title + optional (100) / % on the next line — keeps mark columns narrow. */
function StackedHeading({
  label,
  role,
  className,
}: {
  label: string;
  role: ColumnRole;
  className?: string;
}) {
  const max = maxFromLabel(label);
  const text =
    role === "roll"
      ? "Reg No"
      : role === "percentage"
        ? "Percentage"
        : (role && SHORT_HEADINGS[role]) ||
          label.replace(/\s*\(\s*\d+(?:\.\d+)?\s*m?\s*\)\s*/i, " ").trim() ||
          label;
  const sub =
    role === "percentage" ? "%" : max != null ? `(${max})` : null;
  return (
    <span className={cn("inline-flex flex-col items-center leading-tight", className)}>
      <span className="whitespace-nowrap">{text}</span>
      {sub ? <span className="font-medium text-brand-700/70">{sub}</span> : null}
    </span>
  );
}

type ResultSheetCardProps = {
  sheet: ResultSheet;
  downloadHref: string;
  /** Suggested Excel filename (Content-Disposition from the API is preferred). */
  downloadFileName?: string;
  showDownload?: boolean;
  emptyMessage?: string;
  /** Roll and name cells link to `${base}/${roll}${query}`. */
  studentLink?: { base: string; query?: string };
  /** Stay on this page and open the student (school/teacher results). */
  onStudentClick?: (roll: string) => void;
  /** Rank card and OMR columns, served from the portal's results section. */
  files?: {
    basePath: string;
    resultSetId: string;
    scans: ClassScan[];
    path: { schoolId: string; testNumber: number; classLevel: number; program?: string };
    schoolName?: string;
    programLabel?: string;
    testNumber?: number;
    testId?: string;
  };
};

/** A class's results: title, search and download in one header, then the students. */
export function ResultSheetCard({
  sheet,
  downloadHref,
  downloadFileName,
  showDownload = true,
  emptyMessage = "No students from your classes in this result.",
  studentLink,
  onStudentClick,
  files,
}: ResultSheetCardProps) {
  const numbered = ensureSerialColumn(sheet.columns, sheet.rows);
  const roles = numbered.columns.map(columnRole);
  const rollCol = roles.indexOf("roll");
  const nameCol = roles.indexOf("name");
  const markCols = roles.flatMap((role, index) => (role === "subject" || role === "total" ? [index] : []));
  const cardTarget = files
    ? {
        resultSetId: files.resultSetId,
        classLevel: sheet.classLevel,
        basePath: files.basePath,
        schoolName: files.schoolName,
        programLabel: files.programLabel,
        testNumber: files.testNumber,
        testId: files.testId,
      }
    : null;
  const scanByRoll = new Map((files?.scans ?? []).map((scan) => [foldRoll(scan.rollNo), scan]));
  const rollOf = (row: ResultCell[]) => (rollCol >= 0 ? String(row[rollCol] ?? "").trim() : "");
  const hasMarks = (row: ResultCell[]) => markCols.some((index) => numberCell(row[index]) != null);
  const studentRoll = (row: ResultCell[]) => {
    const roll = rollCol >= 0 ? row[rollCol] : null;
    if (roll == null || String(roll).trim() === "") return null;
    return String(roll).trim();
  };
  const studentHref = (row: ResultCell[]) => {
    const roll = studentRoll(row);
    if (!studentLink || !roll || onStudentClick) return null;
    return `${studentLink.base}/${encodeURIComponent(roll)}${studentLink.query ?? ""}`;
  };
  const studentOpen = (row: ResultCell[]) => {
    const roll = studentRoll(row);
    if (!onStudentClick || !roll) return undefined;
    return () => onStudentClick(roll);
  };
  const [query, setQuery] = useState("");
  useResetOnScopeChange(
    `${files?.resultSetId ?? ""}:${sheet.classLevel}:${sheet.rowCount}`,
    () => setQuery(""),
  );
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const displaySheet = { ...sheet, columns: numbered.columns, rows: numbered.rows };
  const { shown, tags, numeric } = splitColumns(displaySheet);
  // The sheet's last title line is the specific one, e.g. "TEST-3 9-SEP-2026 (Max. Marks: 300)".
  const detail = sheet.caption.at(-1);

  // Rows come sorted by rank, so renumber S.No in display order.
  const serialCol = roles.indexOf("serial");
  const rows =
    serialCol < 0
      ? displaySheet.rows
      : displaySheet.rows.map((row, position) =>
          row.map((cell, index) => (index === serialCol ? position + 1 : cell)),
        );
  const visible = deferredQuery
    ? rows.filter((row) =>
        row.some((value) => value !== null && String(value).toLowerCase().includes(deferredQuery)),
      )
    : rows;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]">
      <header className="flex flex-col gap-3 border-b border-brand-100 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-neutral-950 sm:text-lg">
            {sheet.classLabel || sheet.label || `Class ${sheet.classLevel}`}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-800">{studentCount(sheet.rowCount)}</span>
            {detail && (
              <>
                <span aria-hidden className="text-neutral-300">·</span>
                <span className="break-words">{detail}</span>
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

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <InputGroup className="h-9 w-full min-w-0 flex-1 bg-white sm:h-10 sm:w-64 sm:flex-none">
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
          <ClassSheetExports
            target={files ? cardTarget : null}
            omr={files?.path}
            omrCount={files?.scans.length}
            excelHref={showDownload ? downloadHref : undefined}
            showExcel={showDownload}
          />
        </div>
      </header>

      {visible.length > 0 ? (
        <Table className="border-collapse">
          <TableHeader>
            <TableRow className="border-0 bg-brand-50 hover:bg-brand-50">
              {shown.map((index) => {
                const role = roles[index] ?? null;
                const isName = role === "name";
                const isCompact =
                  role === "subject" ||
                  role === "total" ||
                  role === "percentage" ||
                  role === "sectionRank" ||
                  role === "classRank";
                return (
                  <TableHead
                    key={index}
                    className={cn(
                      "h-auto border border-neutral-300 bg-brand-50 py-2 text-center align-middle text-[11px] font-semibold tracking-wide text-brand-900 uppercase",
                      isCompact ? "px-1" : "px-2",
                      isName && "text-left",
                    )}
                  >
                    <StackedHeading
                      label={numbered.columns[index]!}
                      role={role}
                      className={isName ? "items-start" : undefined}
                    />
                  </TableHead>
                );
              })}
              {files ? (
                <>
                  <TableHead className="h-auto border border-neutral-300 bg-brand-50 px-1.5 py-2.5 text-center align-middle text-[11px] font-semibold tracking-wide whitespace-nowrap text-brand-900 uppercase">
                    <span className="md:hidden">Card</span>
                    <span className="hidden md:inline">Report card</span>
                  </TableHead>
                  <TableHead className="h-auto border border-neutral-300 bg-brand-50 px-1.5 py-2.5 text-center align-middle text-[11px] font-semibold tracking-wide whitespace-nowrap text-brand-900 uppercase">
                    OMR
                  </TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-b">
            {visible.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="border-0 hover:bg-brand-50/50">
                {shown.map((index) => {
                  const role = roles[index];
                  const isRoll = role === "roll";
                  const isName = role === "name";
                  const isCompact =
                    role === "subject" ||
                    role === "total" ||
                    role === "percentage" ||
                    role === "sectionRank" ||
                    role === "classRank";
                  const canOpen = isRoll || isName;
                  const href = canOpen ? studentHref(row) : null;
                  const open = canOpen ? studentOpen(row) : undefined;
                  return (
                    <TableCell
                      key={index}
                      className={cn(
                        "border border-neutral-300 py-2 text-neutral-700 whitespace-nowrap",
                        isCompact ? "px-1.5 text-center" : "px-2 text-center",
                        isName &&
                          "max-w-[9rem] truncate text-left font-medium text-neutral-950 sm:max-w-none sm:whitespace-nowrap",
                        numeric.has(index) && "text-neutral-950 tabular-nums",
                        (isRoll || isCompact) && "tabular-nums",
                        row[index] === null && "text-neutral-300",
                      )}
                    >
                      {(href || open) && row[index] != null ? (
                        <ProfileLink
                          href={href}
                          onClick={open}
                          className={isName ? "max-w-full truncate" : "whitespace-nowrap"}
                        >
                          {formatCell(row[index], role)}
                        </ProfileLink>
                      ) : (
                        <span className={isName ? "truncate" : "whitespace-nowrap"}>
                          {formatCell(row[index] ?? null, role)}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
                {files ? (
                  <>
                    <TableCell className="border border-neutral-300 px-1 py-1 text-center">
                      <RankCardCell
                        target={hasMarks(row) ? cardTarget : null}
                        roll={rollOf(row)}
                        name={nameCol >= 0 ? formatCell(row[nameCol] ?? null) : rollOf(row)}
                      />
                    </TableCell>
                    <TableCell className="border border-neutral-300 px-1 py-1 text-center">
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
