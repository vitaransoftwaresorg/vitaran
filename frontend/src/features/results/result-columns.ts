import { displaySectionName } from "@/features/schools/section-label";
import type { ResultCell } from "@/types/result";
import { roundMarks } from "@/types/scan";

/** Mirrors backend `utils/result-columns.ts` so the class table can show totals and ranks live. */
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

const KNOWN_SUBJECT = /\bmath|\bphys|\bchem|\bbio|\bscience|\benglish|\bsocial|\bhindi|\btelugu|\bgk\b/i;

const foldLabel = (label: string) => label.replaceAll("\n", " ").replace(/\s+/g, " ").trim().toLowerCase();

export const foldRoll = (value: ResultCell | undefined) =>
  String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");

/** Require the M suffix so "(100)" on unrelated labels is not treated as marks. */
export function maxFromLabel(label: string) {
  const match = foldLabel(label).match(/\((\d+(?:\.\d+)?)\s*m\)/i);
  return match ? Number(match[1]) : null;
}

/** Each subject is out of 100 for entry / percentage (not question count). */
export const SUBJECT_PAPER_MAX = 100;

/** Subject max from its header, else 100. */
export function subjectMaxMarks(columns: string[], column: number) {
  const fromLabel = maxFromLabel(columns[column]!);
  if (fromLabel != null && fromLabel > 0) return fromLabel;
  const roles = columns.map(columnRole);
  if (roles[column] !== "subject") return null;
  return SUBJECT_PAPER_MAX;
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

export function numberCell(value: ResultCell | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null || typeof value === "boolean") return null;
  const text = value.trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
}

export function identityCell(
  role: ColumnRole,
  student: { rollNo: string; name: string; classLevel: number; sectionName: string | null },
): ResultCell | undefined {
  const section = displaySectionName(student.sectionName);
  if (role === "roll") return student.rollNo;
  if (role === "name") return student.name;
  if (role === "class") return `${student.classLevel}${section}`;
  if (role === "section") return section;
  return undefined;
}

/** Fills serial numbers, total, percentage and ranks in place order (no sorting). */
export function computeRows(columns: string[], rows: ResultCell[][], classLevel: number) {
  const roles = columns.map(columnRole);
  const subjectCols = roles.flatMap((role, index) => (role === "subject" ? [index] : []));
  const totalCol = roles.indexOf("total");
  const percentCol = roles.indexOf("percentage");
  const sectionCol = roles.indexOf("section");
  const classCol = roles.indexOf("class");
  const sectionRankCol = roles.indexOf("sectionRank");
  const classRankCol = roles.indexOf("classRank");
  const serialCol = roles.indexOf("serial");
  // Percentage is always out of 100 marks × subject count — never the old 25M headers.
  const totalMax =
    subjectCols.length > 0
      ? subjectCols.length * SUBJECT_PAPER_MAX
      : (totalCol >= 0 ? maxFromLabel(columns[totalCol]!) : null) ?? 0;

  const filled = rows.map((source, position) => {
    const row = [...source];
    if (serialCol >= 0) row[serialCol] = position + 1;
    if (totalCol < 0) return row;
    const marks = subjectCols.map((index) => numberCell(row[index]));
    const takenCount = marks.filter((mark) => mark != null).length;
    // Null subject = not on this student’s exam pattern — % out of attempted papers only.
    const rowMax = takenCount > 0 ? takenCount * SUBJECT_PAPER_MAX : totalMax;
    if (marks.some((mark) => mark != null)) {
      row[totalCol] = roundMarks(marks.reduce<number>((sum, mark) => sum + (mark ?? 0), 0));
    }
    const total = numberCell(row[totalCol]);
    if (percentCol >= 0) {
      row[percentCol] = total != null && rowMax > 0 ? Math.round((total / rowMax) * 10000) / 100 : null;
    }
    return row;
  });
  if (totalCol < 0) return filled;

  const totalOf = (row: ResultCell[]) => numberCell(row[totalCol]) ?? -Infinity;
  const sectionOf = (row: ResultCell[]) => {
    if (sectionCol >= 0) return displaySectionName(String(row[sectionCol] ?? ""));
    if (classCol >= 0) {
      return displaySectionName(String(row[classCol] ?? "").replace(String(classLevel), "").replace(/[^a-z]/gi, ""));
    }
    return displaySectionName(null);
  };
  return filled.map((row) => {
    const total = numberCell(row[totalCol]);
    const next = [...row];
    if (classRankCol >= 0) {
      next[classRankCol] = total == null ? null : 1 + filled.filter((other) => totalOf(other) > total).length;
    }
    if (sectionRankCol >= 0) {
      const section = sectionOf(row);
      next[sectionRankCol] =
        total == null
          ? null
          : 1 + filled.filter((other) => sectionOf(other) === section && totalOf(other) > total).length;
    }
    return next;
  });
}
