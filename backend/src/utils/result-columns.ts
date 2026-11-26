import type { CellValue } from "./excel.js";
import { displaySectionName } from "./section-label.js";
import { titleCase } from "./title-case.js";

/** Drop float residue (e.g. 326.4450000000006 → 326.445). */
function roundMarks(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(3));
}

export type ColumnRole =
  | "serial"
  | "roll"
  | "name"
  | "class"
  | "section"
  | "total"
  | "percentage"
  | "sectionRank"
  | "classRank"
  | "subject"
  | null;

const SUBJECT_HEADER: Record<string, string> = { MATHEMATICS: "MATHS" };
const KNOWN_SUBJECT = /\bmath|\bphys|\bchem|\bbio|\bscience|\benglish|\bsocial|\bhindi|\btelugu|\bgk\b/i;

/** Canonical OMR paper order (MPCB). PCB / MPC are subsets. */
export const PAPER_SUBJECT_ORDER = ["MATHEMATICS", "PHYSICS", "CHEMISTRY", "BIOLOGY"] as const;

export function subjectHeader(code: string) {
  return SUBJECT_HEADER[code] ?? code.replaceAll("_", " ").toUpperCase();
}

/** Map a results header like "MATHS (100M)" back to MATHEMATICS. */
export function subjectCodeFromHeader(label: string): string | null {
  const text = foldLabel(label);
  if (/^math/.test(text)) return "MATHEMATICS";
  if (/^phys/.test(text)) return "PHYSICS";
  if (/^chem/.test(text)) return "CHEMISTRY";
  if (/^bio/.test(text)) return "BIOLOGY";
  return null;
}

export function orderedPaperSubjects(codes: Iterable<string>) {
  const set = new Set(
    [...codes].map((code) => code.trim().toUpperCase()).filter(Boolean),
  );
  return PAPER_SUBJECT_ORDER.filter((code) => set.has(code));
}

/** Copy cells from an old sheet layout into a new column layout (by role / subject). */
export function remapSheetToColumns(
  oldColumns: string[],
  newColumns: string[],
  rows: CellValue[][],
): CellValue[][] {
  if (oldColumns.length === 0) {
    return rows.map(() => newColumns.map(() => null));
  }
  const oldRoles = oldColumns.map(columnRole);
  const sourceOf = (label: string, role: ColumnRole) => {
    const exact = oldColumns.findIndex((other) => foldLabel(other) === foldLabel(label));
    if (exact >= 0) return exact;
    if (role === "subject") {
      const code = subjectCodeFromHeader(label);
      if (!code) return -1;
      return oldColumns.findIndex(
        (other, index) =>
          oldRoles[index] === "subject" && subjectCodeFromHeader(other) === code,
      );
    }
    return role ? oldRoles.indexOf(role) : -1;
  };
  const sources = newColumns.map((label) => sourceOf(label, columnRole(label)));
  return rows.map((row) => sources.map((source) => (source >= 0 ? (row[source] ?? null) : null)));
}

/**
 * Build standard columns for the subjects on this exam (e.g. PCB → 300M, MPCB → 400M).
 * Keeps any subject that already has marks on the sheet so mixed history is not wiped.
 */
export function columnsForExamSubjects(
  subjectCodes: string[],
  options?: { oldColumns?: string[]; rows?: CellValue[][] },
) {
  const codes = new Set(orderedPaperSubjects(subjectCodes));
  const oldColumns = options?.oldColumns ?? [];
  const rows = options?.rows ?? [];
  oldColumns.forEach((label, index) => {
    if (columnRole(label) !== "subject") return;
    const code = subjectCodeFromHeader(label);
    if (!code) return;
    if (rows.some((row) => numberCell(row[index]) != null)) {
      codes.add(code as (typeof PAPER_SUBJECT_ORDER)[number]);
    }
  });
  const ordered = orderedPaperSubjects(codes);
  if (ordered.length === 0) return null;
  return standardColumns(ordered.map((subject) => ({ subject, maxMarks: SUBJECT_PAPER_MAX })));
}

export const foldLabel = (label: string) => label.replaceAll("\n", " ").replace(/\s+/g, " ").trim().toLowerCase();
export const foldRoll = (value: CellValue | undefined) =>
  String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");

/** Require the M suffix so unrelated "(100)" labels are not treated as marks. */
export function maxFromLabel(label: string) {
  const match = foldLabel(label).match(/\((\d+(?:\.\d+)?)\s*m\)/i);
  return match ? Number(match[1]) : null;
}

export function columnRole(label: string): ColumnRole {
  const text = foldLabel(label);
  if (/^((s|sl|sr)\.?\s*no\.?|serial(\s*(no\.?|number))?|#)$/.test(text)) return "serial";
  if (/section\s*rank/.test(text)) return "sectionRank";
  if (/class\s*rank|overall\s*rank|^rank$/.test(text)) return "classRank";
  if (/^(roll|regd?\.?\s*no|registration)/.test(text)) return "roll";
  if (/name/.test(text)) return "name";
  if (/^class$/.test(text)) return "class";
  if (/^section$/.test(text)) return "section";
  if (/^total/.test(text)) return "total";
  if (/percent|^%$/.test(text)) return "percentage";
  if (KNOWN_SUBJECT.test(text) || maxFromLabel(label) != null) return "subject";
  return null;
}

/** Column of `columns` that holds the given answer-key subject code, or -1. */
export function subjectColumn(columns: string[], code: string) {
  const prefix = subjectHeader(code).toLowerCase().slice(0, 4);
  return columns.findIndex((label) => columnRole(label) === "subject" && foldLabel(label).startsWith(prefix));
}

/** Each subject paper is out of 100 for result entry / display (not question count). */
export const SUBJECT_PAPER_MAX = 100;

function rewriteMaxInLabel(label: string, max: number) {
  if (/\(\s*\d+(?:\.\d+)?\s*m\s*\)/i.test(label)) {
    return label.replace(/\(\s*\d+(?:\.\d+)?\s*m\s*\)/i, `(${max}M)`);
  }
  return `${label.trimEnd()} (${max}M)`;
}

/** Force every subject column to SUBJECT_PAPER_MAX and total to the sum. */
export function forceSubjectPaperMaxes(columns: string[], subjectMax = SUBJECT_PAPER_MAX) {
  let subjectCount = 0;
  const next = columns.map((label) => {
    if (columnRole(label) !== "subject") return label;
    subjectCount += 1;
    return rewriteMaxInLabel(label, subjectMax);
  });
  if (subjectCount === 0) return next;
  const totalMax = subjectCount * subjectMax;
  return next.map((label) =>
    columnRole(label) === "total" ? rewriteMaxInLabel(label, totalMax) : label,
  );
}

/** S.No · Reg No · CandidateName · CLASS · subjects · Total · Percentage · ranks. */
export function standardColumns(subjects: Array<{ subject: string; maxMarks: number }>) {
  const normalized = subjects.map((row) => ({ ...row, maxMarks: SUBJECT_PAPER_MAX }));
  const max = normalized.reduce((sum, row) => sum + row.maxMarks, 0);
  return [
    "S.No",
    "Reg No",
    "CandidateName",
    "CLASS",
    ...normalized.map((row) => `${subjectHeader(row.subject)} (${row.maxMarks}M)`),
    max > 0 ? `Total Marks (${max}M)` : "Total Marks",
    "Percentage",
    "Section Rank",
    "Class Rank",
  ];
}

export function identityCell(
  role: ColumnRole,
  student: { rollNo: string; name: string; classLevel: number; sectionName: string | null },
): CellValue | undefined {
  const section = displaySectionName(student.sectionName);
  if (role === "roll") return student.rollNo;
  if (role === "name") return student.name;
  if (role === "class") return `${student.classLevel}${section}`;
  if (role === "section") return section;
  return undefined;
}

export function numberCell(value: CellValue | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null || typeof value === "boolean") return null;
  const text = value.trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Totals = sum of subject marks (when any are entered), percentage from the column max,
 * then rows sorted by total with section/class ranks; equal totals share a rank.
 */
export function recomputeSheet(columns: string[], rows: CellValue[][], classLevel: number) {
  const roles = columns.map(columnRole);
  const subjectCols = roles.flatMap((role, index) => (role === "subject" ? [index] : []));
  const totalCol = roles.indexOf("total");
  const percentCol = roles.indexOf("percentage");
  const nameCol = roles.indexOf("name");
  // Percentage is always out of 100 × subject count (ignore stale 25M headers).
  const totalMax =
    subjectCols.length > 0
      ? subjectCols.length * SUBJECT_PAPER_MAX
      : (totalCol >= 0 ? maxFromLabel(columns[totalCol]!) : null) ?? 0;

  const filled = rows.map((source) => {
    const row = columns.map((_, index) => source[index] ?? null);
    if (nameCol >= 0 && typeof row[nameCol] === "string") row[nameCol] = titleCase(row[nameCol]);
    for (const index of subjectCols) row[index] = numberCell(row[index]) ?? (row[index] === "" ? null : row[index]!);
    if (totalCol < 0) return row;
    const marks = subjectCols.map((index) => numberCell(row[index]));
    const takenCount = marks.filter((mark) => mark != null).length;
    // Null subject = not on this student’s exam pattern — % out of attempted papers only.
    const rowMax = takenCount > 0 ? takenCount * SUBJECT_PAPER_MAX : totalMax;
    if (marks.some((mark) => mark != null)) {
      row[totalCol] = roundMarks(marks.reduce<number>((sum, mark) => sum + (mark ?? 0), 0));
    } else {
      const total = numberCell(row[totalCol]);
      row[totalCol] =
        total != null ? roundMarks(total) : row[totalCol] === "" ? null : row[totalCol]!;
    }
    const total = numberCell(row[totalCol]);
    if (percentCol >= 0) {
      row[percentCol] = total != null && rowMax > 0 ? Math.round((total / rowMax) * 10000) / 100 : null;
    }
    return row;
  });

  const ranked = rankRows(columns, filled, classLevel);
  const serialCol = roles.indexOf("serial");
  if (serialCol < 0) return ranked;
  return ranked.map((row, position) => {
    const next = [...row];
    next[serialCol] = position + 1;
    return next;
  });
}

/** Sheets uploaded without S.No / rank columns still show them. */
export function withRankColumns(columns: string[], rows: CellValue[][], classLevel: number) {
  const roles = columns.map(columnRole);
  let next = [...columns];
  let padded = rows.map((row) => columns.map((_, index) => row[index] ?? null));

  if (!roles.includes("serial")) {
    next = ["S.No", ...next];
    padded = padded.map((row, position) => [position + 1, ...row]);
  }

  const nextRoles = next.map(columnRole);
  const suffix = [
    ...(nextRoles.includes("sectionRank") ? [] : ["Section Rank"]),
    ...(nextRoles.includes("classRank") ? [] : ["Class Rank"]),
  ];
  if (suffix.length === 0 || !nextRoles.includes("total")) {
    return { columns: next, rows: padded };
  }

  next = [...next, ...suffix];
  padded = padded.map((row) => [...row, ...suffix.map(() => null)]);
  return { columns: next, rows: rankRows(next, padded, classLevel) };
}

/** Rows by total, highest first, with section/class ranks filled; equal totals share a rank. */
function rankRows(columns: string[], filled: CellValue[][], classLevel: number) {
  const roles = columns.map(columnRole);
  const totalCol = roles.indexOf("total");
  const sectionCol = roles.indexOf("section");
  const classCol = roles.indexOf("class");
  const sectionRankCol = roles.indexOf("sectionRank");
  const classRankCol = roles.indexOf("classRank");
  if (totalCol < 0) return filled;
  const totalOf = (row: CellValue[]) => numberCell(row[totalCol]) ?? -Infinity;
  const sectionOf = (row: CellValue[]) => {
    if (sectionCol >= 0) return displaySectionName(String(row[sectionCol] ?? ""));
    if (classCol >= 0) {
      const text = String(row[classCol] ?? "").replace(String(classLevel), "").replace(/[^a-z]/gi, "");
      return displaySectionName(text);
    }
    return displaySectionName(null);
  };

  const sorted = [...filled].sort((a, b) => totalOf(b) - totalOf(a));
  return sorted.map((row) => {
    const total = numberCell(row[totalCol]);
    const next = [...row];
    if (classRankCol >= 0) {
      next[classRankCol] = total == null ? null : 1 + sorted.filter((other) => totalOf(other) > total).length;
    }
    if (sectionRankCol >= 0) {
      const section = sectionOf(row);
      next[sectionRankCol] =
        total == null
          ? null
          : 1 + sorted.filter((other) => sectionOf(other) === section && totalOf(other) > total).length;
    }
    return next;
  });
}
