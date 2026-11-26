"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FocusEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
import { useRegisterInPageBack } from "@/components/layout/in-page-back";
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
import { matchesSearch, TableSearch } from "@/components/shared/table-search";
import type { DriveCrumb } from "@/features/documents/drive-browser";
import { ProfileLink } from "@/components/shared/profile-link";
import { useResetOnScopeChange } from "@/hooks/use-reset-on-scope-change";
import { cn } from "@/lib/utils";
import type { LearningProgram } from "@/types/program";
import type { ResultCell, ResultSet, ResultSheet } from "@/types/result";
import type { SchoolClassTestRow } from "@/types/answer-key";
import { formatMarks, type ClassScan } from "@/types/scan";
import type { Student, StudentDetail } from "@/types/student";
import { StudentDetailView } from "@/features/students/student-detail-view";
import { saveManualResultAction } from "./actions";
import { ClassSheetExports } from "./class-sheet-exports";
import { OmrCell } from "./omr-files";
import { RankCardCell } from "./rank-card-files";
import type { DrivePath, DriveSchool } from "./drive-path";
import { resultProgramFields } from "./school-program";
import {
  columnRole,
  computeRows,
  ensureSerialColumn,
  foldRoll,
  identityCell,
  maxFromLabel,
  numberCell,
  subjectMaxMarks,
  type ColumnRole,
} from "./result-columns";

function toStudentDetail(row: Student, school: DriveSchool): StudentDetail {
  return {
    ...row,
    school: { id: school.id, name: school.name, code: school.code },
  };
}

type BoardRow = { key: string; cells: ResultCell[] };

function cellText(value: ResultCell | undefined) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return formatMarks(value);
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

  // Student list is the school roster for this class — sheet/OMR marks fill matching rolls only.
  const rosterRolls = new Set(students.map((student) => foldRoll(student.rollNo)));
  const roster = students.map((student) => {
    const cells = fromSaved(savedRows.get(foldRoll(student.rollNo)));
    roles.forEach((role, index) => {
      const value = identityCell(role, { ...student, classLevel });
      if (value !== undefined) cells[index] = value;
    });
    return { key: student.id, cells };
  });
  const rankedRoster = byRank(columns, roster, classLevel);

  // Walk-in / unregistered OMR rows (not on the roster) sit at the end of the class list.
  const classCol = roles.indexOf("class");
  const walkIns: BoardRow[] = [];
  for (const [roll, saved] of savedRows) {
    if (rosterRolls.has(roll)) continue;
    if (classCol >= 0) {
      const text = String(saved[classCol] ?? "").trim();
      if (text && !text.startsWith(String(classLevel))) continue;
    }
    walkIns.push({ key: `walk-in:${roll}`, cells: fromSaved(saved) });
  }
  if (walkIns.length === 0) return rankedRoster;
  return [...rankedRoster, ...byRank(columns, walkIns, classLevel)];
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

/** Rank roster students by marks; keep walk-in rows at the end of the class list. */
function byRankKeepingWalkIns(columns: string[], rows: BoardRow[], classLevel: number) {
  const roster = rows.filter((row) => !row.key.startsWith("walk-in:"));
  const walkIns = rows.filter((row) => row.key.startsWith("walk-in:"));
  return [...byRank(columns, roster, classLevel), ...byRank(columns, walkIns, classLevel)];
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
  /** Real answer-key / OMR test ID resolved on the server (never a T-N placeholder). */
  resolvedTestId?: string;
  /** When sections have different Test IDs — show each; when shared, a single class-wide row. */
  sectionTestIds?: SchoolClassTestRow[];
};

export function ClassResultsBoard({
  students,
  columns: columnsProp,
  sheet,
  resultSet,
  school,
  programs,
  path,
  backHref,
  breadcrumbs,
  scans,
  resolvedTestId,
  sectionTestIds = [],
}: ClassResultsBoardProps) {
  const columns = useMemo(
    () => ensureSerialColumn(columnsProp, []).columns,
    [columnsProp],
  );
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
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [openedStudent, setOpenedStudent] = useState<StudentDetail | null>(null);
  const byId = useMemo(() => {
    const map = new Map<string, StudentDetail>();
    for (const row of students) {
      map.set(row.id, toStudentDetail(row, school));
    }
    return map;
  }, [students, school]);

  // Soft-nav between classes must not keep a previous student search.
  useResetOnScopeChange(
    `${path.schoolId}:${path.classLevel}:${path.testNumber}:${path.program}`,
    () => {
      setQuery("");
      setOpenedStudent(null);
    },
  );

  // When another device saves an OMR, LiveRefresh reloads props — pull marks into the table.
  useEffect(() => {
    setRows(buildRows(columns, students, sheet, path.classLevel));
  }, [columns, students, sheet, path.classLevel]);

  const roles = useMemo(() => columns.map(columnRole), [columns]);
  const rollCol = roles.indexOf("roll");
  const nameCol = roles.indexOf("name");
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
  const visibleRows = useMemo(
    () =>
      rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) =>
          matchesSearch(
            query,
            rollCol >= 0 ? cellText(row.cells[rollCol]) : null,
            nameCol >= 0 ? cellText(row.cells[nameCol]) : null,
          ),
        ),
    [rows, query, rollCol, nameCol],
  );

  // Top navbar only — breadcrumbs prop is already folder levels (no "Results" root).
  const setDrivePath = useSetDrivePathCrumbs();
  useEffect(() => {
    if (!setDrivePath || openedStudent) return;
    setDrivePath(breadcrumbs);
    return () => setDrivePath([]);
  }, [breadcrumbs, setDrivePath, openedStudent]);

  const closeStudent = useCallback(() => setOpenedStudent(null), []);
  useRegisterInPageBack(openedStudent ? closeStudent : null);

  const openStudent = (studentId: string) => {
    const detail = byId.get(studentId);
    if (!detail) {
      toast.error("Student not found.");
      return;
    }
    setOpenedStudent(detail);
  };

  const refocus = useRef<HTMLElement | null>(null);

  /** Re-rank once focus leaves a row, so the row being typed in never jumps. */
  function onRowBlur(event: FocusEvent<HTMLTableRowElement>) {
    const next = event.relatedTarget as HTMLElement | null;
    if (next && event.currentTarget.contains(next)) return;
    refocus.current = next;
    setRows((current) => byRankKeepingWalkIns(columns, current, path.classLevel));
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
      role === "subject"
        ? subjectMaxMarks(columns, column)
        : role === "total"
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

  /** Prefer a real OMR/answer-key test ID over placeholders like "T-2". */
  const classTestId = (() => {
    const placeholder = (value: string | null | undefined) => {
      const id = value?.trim() ?? "";
      return !id || id === "-" || /^T-\d+$/i.test(id);
    };
    if (resolvedTestId?.trim() && !placeholder(resolvedTestId)) return resolvedTestId.trim();
    const fromScans = scans.map((scan) => scan.testId?.trim()).find((id) => id && !placeholder(id));
    if (fromScans) return fromScans;
    const fromSet = resultSet?.testId?.trim();
    if (fromSet && !placeholder(fromSet)) return fromSet;
    return "";
  })();

  function save() {
    if (rows.length === 0) {
      toast.error("No students in this class");
      return;
    }
    if (!classTestId) {
      toast.error("No Test ID for this class — add an answer key first");
      return;
    }
    startTransition(async () => {
      const programFields = resultProgramFields(school, programs, path.program);
      const result = await saveManualResultAction({
        schoolId: path.schoolId,
        ...programFields,
        testId: classTestId,
        testNumber: path.testNumber,
        classLevel: path.classLevel,
        resultSetId: resultSet?.id,
        columns,
        rows: rows.map((row, position) =>
          row.cells.map((cell, index) =>
            roles[index] === "serial" ? position + 1 : toCell(cell),
          ),
        ),
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

  if (openedStudent) {
    return (
      <StudentDetailView
        student={openedStudent}
        showActions={false}
        performancePortal="admin"
        portal="admin"
      />
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]">
        <header className="flex flex-col gap-3 border-b border-neutral-200 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold break-words text-neutral-900">
              {sectionTestIds.length > 1 ? (
                <>
                  {sectionTestIds.map((row, index) => (
                    <span key={`${row.sectionId ?? "all"}:${row.testId}`}>
                      {index > 0 ? <span className="mx-1.5 text-neutral-300">·</span> : null}
                      {row.sectionName ? (
                        <>
                          Section {row.sectionName}{" "}
                          <span className="font-mono text-brand-800">{row.testId}</span>
                        </>
                      ) : (
                        <>
                          Test ID{" "}
                          <span className="font-mono text-brand-800">{row.testId}</span>
                        </>
                      )}
                    </span>
                  ))}
                  <span className="mx-1.5 text-neutral-300">·</span>
                </>
              ) : classTestId ? (
                <>
                  Test ID{" "}
                  <span className="font-mono text-brand-800">{classTestId}</span>
                  <span className="mx-1.5 text-neutral-300">·</span>
                </>
              ) : null}
              Test {path.testNumber}
              <span className="mx-1.5 text-neutral-300">·</span>
              Class {path.classLevel}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <TableSearch
              value={query}
              onChange={setQuery}
              placeholder="Search students"
              className="w-full min-w-0 flex-1 sm:w-64 sm:flex-none"
            />
            <ClassSheetExports
              target={savedRolls.size ? cardTarget : null}
              omr={path}
              omrCount={scans.length}
            />
            <Button
              type="button"
              size="sm"
              className="h-9 w-full rounded-lg sm:w-auto"
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
            No students in this class yet. Results uses the same list as
            Students — add or import there.
          </p>
        ) : visibleRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-500 sm:px-6">
            No matching students.
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
                      {roles[index] === "roll"
                        ? "Reg No"
                        : label.replace(/\s*\((\d+M?)\)/i, "\n($1)")}
                    </TableHead>
                  ))}
                  <TableHead className="w-14 text-center text-xs font-bold uppercase">
                    <span className="inline-flex flex-col items-center leading-tight">
                      <span>Report</span>
                      <span>Card</span>
                    </span>
                  </TableHead>
                  <TableHead className="text-center text-xs font-bold uppercase">
                    OMR
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map(({ row, index: rowIndex }) => (
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
                                "mx-auto h-8 w-[4.4rem] text-center tabular-nums",
                                role === "total" &&
                                  "w-[5.5rem] font-bold text-brand-900",
                              )}
                              aria-label={`${label} for ${cellText(row.cells[roles.indexOf("name")])}`}
                            />
                          </TableCell>
                        );
                      }
                      const shown =
                        role === "percentage" && value != null && value !== ""
                          ? `${cellText(value)}%`
                          : cellText(value);
                      return (
                        <TableCell
                          key={`${label}:${index}`}
                          className={cn(
                            "tabular-nums",
                            role === "name"
                              ? "font-medium text-neutral-950"
                              : "text-center text-neutral-700",
                            role === "total" && "font-bold text-brand-900",
                            role === "percentage" && "text-brand-800",
                          )}
                        >
                          {(role === "name" || role === "roll") &&
                          cellText(value) &&
                          !row.key.startsWith("saved:") &&
                          !row.key.startsWith("walk-in:") ? (
                            <ProfileLink onClick={() => openStudent(row.key)}>
                              {cellText(value)}
                            </ProfileLink>
                          ) : (
                            shown || <span className="text-neutral-300">—</span>
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
