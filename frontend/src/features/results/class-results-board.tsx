"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FocusEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileSpreadsheet, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DriveCrumb } from "@/features/documents/drive-browser";
import { programLabel } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import type { LearningProgram } from "@/types/program";
import type { ResultCell, ResultSet, ResultSheet } from "@/types/result";
import type { ClassScan } from "@/types/scan";
import type { Student } from "@/types/student";
import { saveManualResultAction } from "./actions";
import { ClassOmrDownload, OmrCell } from "./omr-files";
import { ClassRankCardsDownload, RankCardCell } from "./rank-card-files";
import { ResultUploadSheet } from "./result-upload-sheet";
import type { DrivePath, DriveSchool } from "./drive-path";
import { resultProgramFields } from "./school-program";
import {
  columnRole,
  computeRows,
  foldRoll,
  identityCell,
  maxFromLabel,
  numberCell,
  type ColumnRole,
} from "./result-columns";

type BoardRow = { key: string; cells: ResultCell[] };

function cellText(value: ResultCell | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

const foldLabel = (label: string) =>
  label.replaceAll("\n", " ").replace(/\s+/g, " ").trim().toLowerCase();

/** Index in the saved sheet that feeds each table column (same label, same role, or same subject). */
function sourceColumns(columns: string[], saved: string[]) {
  const savedRoles = saved.map(columnRole);
  return columns.map((label) => {
    const exact = saved.findIndex(
      (other) => foldLabel(other) === foldLabel(label),
    );
    if (exact >= 0) return exact;
    const role = columnRole(label);
    if (role === "subject") {
      const prefix = foldLabel(label).slice(0, 4);
      return saved.findIndex(
        (other, index) =>
          savedRoles[index] === "subject" &&
          foldLabel(other).startsWith(prefix),
      );
    }
    return role ? savedRoles.indexOf(role) : -1;
  });
}

function buildRows(
  columns: string[],
  students: Student[],
  sheet: ResultSheet | null,
  classLevel: number,
): BoardRow[] {
  const roles = columns.map(columnRole);
  const saved = sheet?.columns ?? [];
  const sources = sourceColumns(columns, saved);
  const savedRoll = saved.map(columnRole).indexOf("roll");
  const savedRows = new Map<string, ResultCell[]>();
  for (const row of sheet?.rows ?? []) {
    const roll = savedRoll >= 0 ? foldRoll(row[savedRoll]) : "";
    if (roll) savedRows.set(roll, row);
  }
  const fromSaved = (row: ResultCell[] | undefined) =>
    sources.map((source) =>
      row && source >= 0 ? (row[source] ?? null) : null,
    );

  const roster = students.map((student) => {
    const cells = fromSaved(savedRows.get(foldRoll(student.rollNo)));
    roles.forEach((role, index) => {
      const value = identityCell(role, { ...student, classLevel });
      if (value !== undefined) cells[index] = value;
    });
    savedRows.delete(foldRoll(student.rollNo));
    return { key: student.id, cells };
  });
  const extra = [...savedRows.entries()].map(([roll, row]) => ({
    key: `saved:${roll}`,
    cells: fromSaved(row),
  }));
  return byRank(columns, [...roster, ...extra], classLevel);
}

/** Highest total first (class rank order); students without marks go last. */
function byRank(columns: string[], rows: BoardRow[], classLevel: number) {
  const totalCol = columns.map(columnRole).indexOf("total");
  if (totalCol < 0) return rows;
  const computed = computeRows(
    columns,
    rows.map((row) => row.cells.map(toCell)),
    classLevel,
  );
  const totals = new Map(
    rows.map((row, index) => [
      row.key,
      numberCell(computed[index]?.[totalCol]),
    ]),
  );
  return [...rows].sort(
    (a, b) =>
      (totals.get(b.key) ?? -Infinity) - (totals.get(a.key) ?? -Infinity),
  );
}

/** Total is always the sum of subject marks; it's typed only on sheets without subject columns. */
function isEditable(role: ColumnRole, hasSubjects: boolean) {
  if (role === "total") return !hasSubjects;
  return role === "subject" || role === null;
}

function toCell(value: ResultCell) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isNaN(number) ? text : number;
}

type ClassResultsBoardProps = {
  students: Student[];
  columns: string[];
  sheet: ResultSheet | null;
  resultSet: ResultSet | null;
  school: DriveSchool;
  programs: LearningProgram[];
  path: DrivePath & {
    schoolId: string;
    testNumber: number;
    classLevel: number;
  };
  backHref: string;
  breadcrumbs: DriveCrumb[];
  scans: ClassScan[];
};

export function ClassResultsBoard({
  students,
  columns,
  sheet,
  resultSet,
  school,
  programs,
  path,
  backHref,
  breadcrumbs,
  scans,
}: ClassResultsBoardProps) {
  const scanByRoll = useMemo(
    () => new Map(scans.map((scan) => [foldRoll(scan.rollNo), scan])),
    [scans],
  );
  const cardTarget =
    resultSet && sheet ? { resultSetId: resultSet.id, classLevel: path.classLevel } : null;
  /** Rank cards come from saved results, so only students with saved marks get one. */
  const savedRolls = useMemo(() => {
    const savedRoles = (sheet?.columns ?? []).map(columnRole);
    const rollCol = savedRoles.indexOf("roll");
    if (rollCol < 0) return new Set<string>();
    const markCols = savedRoles.flatMap((role, index) =>
      role === "subject" || role === "total" ? [index] : [],
    );
    return new Set(
      (sheet?.rows ?? [])
        .filter((row) => markCols.some((index) => numberCell(row[index]) != null))
        .map((row) => foldRoll(row[rollCol])),
    );
  }, [sheet]);
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    buildRows(columns, students, sheet, path.classLevel),
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const roles = useMemo(() => columns.map(columnRole), [columns]);
  const hasSubjects = roles.includes("subject");
  const computed = useMemo(
    () =>
      computeRows(
        columns,
        rows.map((row) => row.cells.map(toCell)),
        path.classLevel,
      ),
    [columns, rows, path.classLevel],
  );

  const programTitle = useMemo(() => {
    if (!path.program) return "";
    const label = programLabel(
      path.program,
      programs.find((program) => program.code === path.program)?.name,
    );
    return label === school.name ? "" : label;
  }, [path.program, programs, school.name]);

  const refocus = useRef<HTMLElement | null>(null);

  /** Re-rank once focus leaves a row, so the row being typed in never jumps. */
  function onRowBlur(event: FocusEvent<HTMLTableRowElement>) {
    const next = event.relatedTarget as HTMLElement | null;
    if (next && event.currentTarget.contains(next)) return;
    refocus.current = next;
    setRows((current) => byRank(columns, current, path.classLevel));
  }

  useLayoutEffect(() => {
    const target = refocus.current;
    refocus.current = null;
    if (target?.isConnected && document.activeElement !== target)
      target.focus();
  }, [rows]);

  function setCell(rowKey: string, column: number, value: string) {
    const role = roles[column];
    if (
      (role === "subject" || role === "total") &&
      !/^-?\d*\.?\d*$/.test(value.trim())
    ) {
      toast.error("Enter marks in numbers only", { id: "marks-numbers" });
      return;
    }
    const max =
      role === "subject" || role === "total"
        ? maxFromLabel(columns[column]!)
        : null;
    const mark = numberCell(value);
    if (max != null && mark != null && mark > max) {
      toast.error(
        `${columns[column]!.replace(/\s*\(.*\)\s*$/, "")} can't be more than ${max}`,
        {
          id: "max-marks",
        },
      );
      return;
    }
    setRows((current) =>
      current.map((row) =>
        row.key === rowKey
          ? {
              ...row,
              cells: row.cells.map((cell, index) =>
                index === column ? value : cell,
              ),
            }
          : row,
      ),
    );
  }

  function save() {
    if (rows.length === 0) {
      toast.error("No students in this class");
      return;
    }
    startTransition(async () => {
      const programFields = resultProgramFields(school, programs, path.program);
      const result = await saveManualResultAction({
        schoolId: path.schoolId,
        ...programFields,
        testId: resultSet?.testId ?? `T-${path.testNumber}`,
        testNumber: path.testNumber,
        classLevel: path.classLevel,
        resultSetId: resultSet?.id,
        columns,
        rows: rows.map((row) => row.cells.map(toCell)),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Results saved");
      router.push(backHref);
      router.refresh();
    });
  }

  return (
    <>
      <ResultUploadSheet
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) router.refresh();
        }}
        path={path}
        schools={[school]}
        programs={programs}
        resultSet={resultSet ?? undefined}
      />

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-3 py-2.5 sm:px-4">
          <nav aria-label="Folder path" className="min-w-0 flex-1">
            <ol className="flex flex-wrap items-center gap-0.5 text-sm">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;
                return (
                  <li
                    key={`${crumb.label}:${index}`}
                    className="flex min-w-0 items-center gap-0.5"
                  >
                    {index > 0 ? (
                      <ChevronRight className="size-3.5 shrink-0 text-neutral-400" />
                    ) : null}
                    {last ? (
                      <span className="truncate font-medium text-neutral-950">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="truncate rounded-md px-1.5 py-0.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                );
              })}
              {programTitle ? (
                <li className="ml-2 truncate text-xs text-neutral-500">
                  {programTitle}
                </li>
              ) : null}
            </ol>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <ClassRankCardsDownload target={savedRolls.size ? cardTarget : null} />
            <ClassOmrDownload path={path} count={scans.length} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg"
              onClick={() => setUploadOpen(true)}
            >
              <FileSpreadsheet />
              Import Excel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-lg"
              disabled={pending || rows.length === 0}
              onClick={save}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
          </div>
        </header>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-500 sm:px-6">
            No students in this class yet. Add students to the school roster, or
            import Excel.
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white">
                <TableRow className="hover:bg-transparent">
                  {columns.map((label, index) => (
                    <TableHead
                      key={`${label}:${index}`}
                      className={cn(
                        "whitespace-pre-line text-xs font-bold uppercase",
                        roles[index] !== "name" && "text-center",
                      )}
                    >
                      {label.replace(/\s*\((\d+M?)\)/i, "\n($1)")}
                    </TableHead>
                  ))}
                  <TableHead className="text-center text-xs font-bold uppercase">
                    Rank card
                  </TableHead>
                  <TableHead className="text-center text-xs font-bold uppercase">
                    OMR
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rowIndex) => (
                  <TableRow key={row.key} onBlur={onRowBlur}>
                    {columns.map((label, index) => {
                      const role = roles[index] ?? null;
                      const editable = isEditable(role, hasSubjects);
                      const value = editable
                        ? row.cells[index]
                        : computed[rowIndex]?.[index];
                      if (editable) {
                        return (
                          <TableCell
                            key={`${label}:${index}`}
                            className="px-1.5 py-1 text-center"
                          >
                            <Input
                              type="text"
                              inputMode={role === null ? "text" : "decimal"}
                              value={cellText(value)}
                              placeholder={role === "total" ? "—" : undefined}
                              onChange={(event) =>
                                setCell(
                                  row.key,
                                  index,
                                  event.currentTarget.value,
                                )
                              }
                              className={cn(
                                "mx-auto h-8 w-16 text-center tabular-nums",
                                role === "total" &&
                                  "w-20 font-bold text-brand-900",
                              )}
                              aria-label={`${label} for ${cellText(row.cells[roles.indexOf("name")])}`}
                            />
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell
                          key={`${label}:${index}`}
                          className={cn(
                            "tabular-nums",
                            role === "name"
                              ? "font-medium text-neutral-950"
                              : "text-center text-neutral-700",
                            role === "total" && "font-bold text-brand-900",
                          )}
                        >
                          {(role === "name" || role === "roll") &&
                          cellText(value) &&
                          !row.key.startsWith("saved:") ? (
                            <Link
                              href={`/admin/schools/students/${row.key}`}
                              className="font-medium text-brand-900 hover:underline"
                            >
                              {cellText(value)}
                            </Link>
                          ) : (
                            cellText(value) || <span className="text-neutral-300">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="px-1.5 py-1 text-center">
                      <RankCardCell
                        target={
                          savedRolls.has(foldRoll(row.cells[roles.indexOf("roll")]))
                            ? cardTarget
                            : null
                        }
                        roll={cellText(row.cells[roles.indexOf("roll")])}
                        name={cellText(row.cells[roles.indexOf("name")])}
                      />
                    </TableCell>
                    <TableCell className="px-1.5 py-1 text-center">
                      <OmrCell
                        scan={scanByRoll.get(
                          foldRoll(row.cells[roles.indexOf("roll")]),
                        )}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
