import type { CellValue } from "./excel.js";
import { displaySectionName } from "./section-label.js";
import { titleCase } from "./title-case.js";

export type ColumnRole =
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

export function subjectHeader(code: string) {
  return SUBJECT_HEADER[code] ?? code.replaceAll("_", " ").toUpperCase();
}

export const foldLabel = (label: string) => label.replaceAll("\n", " ").replace(/\s+/g, " ").trim().toLowerCase();
export const foldRoll = (value: CellValue | undefined) =>
  String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");

export function maxFromLabel(label: string) {
  const match = foldLabel(label).match(/\((\d+(?:\.\d+)?)\s*m?\)/i);
  return match ? Number(match[1]) : null;
}

export function columnRole(label: string): ColumnRole {
  const text = foldLabel(label);
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

/** RollNo · CandidateName · CLASS · one column per subject · Total · Percentage · ranks. */
export function standardColumns(subjects: Array<{ subject: string; maxMarks: number }>) {
  const max = subjects.reduce((sum, row) => sum + row.maxMarks, 0);
  return [
    "RollNo",
    "CandidateName",
    "CLASS",
    ...subjects.map((row) => `${subjectHeader(row.subject)} (${row.maxMarks}M)`),
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
  const subjectMaxes = subjectCols.map((index) => maxFromLabel(columns[index]!) ?? 0);
  const totalMax =
    (totalCol >= 0 ? maxFromLabel(columns[totalCol]!) : null) ?? subjectMaxes.reduce((sum, max) => sum + max, 0);

  const filled = rows.map((source) => {
    const row = columns.map((_, index) => source[index] ?? null);
    if (nameCol >= 0 && typeof row[nameCol] === "string") row[nameCol] = titleCase(row[nameCol]);
    for (const index of subjectCols) row[index] = numberCell(row[index]) ?? (row[index] === "" ? null : row[index]!);
    if (totalCol < 0) return row;
    const marks = subjectCols.map((index) => numberCell(row[index]));
    if (marks.some((mark) => mark != null)) {
      row[totalCol] = marks.reduce<number>((sum, mark) => sum + (mark ?? 0), 0);
    } else {
      row[totalCol] = numberCell(row[totalCol]) ?? (row[totalCol] === "" ? null : row[totalCol]!);
    }
    const total = numberCell(row[totalCol]);
    if (percentCol >= 0) {
      row[percentCol] = total != null && totalMax > 0 ? Math.round((total / totalMax) * 10000) / 100 : null;
    }
    return row;
  });

  return rankRows(columns, filled, classLevel);
}

/** Sheets uploaded without rank columns still show Section Rank and Class Rank, from the totals. */
export function withRankColumns(columns: string[], rows: CellValue[][], classLevel: number) {
  const roles = columns.map(columnRole);
  const added = [
    ...(roles.includes("sectionRank") ? [] : ["Section Rank"]),
    ...(roles.includes("classRank") ? [] : ["Class Rank"]),
  ];
  if (!roles.includes("total") || added.length === 0) return { columns, rows };
  const next = [...columns, ...added];
  const padded = rows.map((row) => [...columns.map((_, index) => row[index] ?? null), ...added.map(() => null)]);
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
