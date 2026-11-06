import {
  assignedSubjects,
  isClassTeacherOf,
  teacherCanAccessStudent,
  type StudentScope,
} from "../services/content-access.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import type { SubjectRange } from "./answer-key-parse.js";
import type { CellValue } from "./excel.js";
import { classWithSectionLabel, displaySectionName } from "./section-label.js";

export type RosterStudent = {
  name: string;
  rollNo: string;
  classLevel: number;
  sectionId: string | null;
  program: { code: string; name: string };
  section: { id: string; name: string } | null;
};

export type ScopedSheet = {
  columns: string[];
  rows: CellValue[][];
  classLabel: string;
};

export type ParsedSubjectScore = {
  subject: string;
  score: number;
  max: number | null;
};

export type ParsedScoreRow = {
  subjects: ParsedSubjectScore[];
  total: number | null;
  maxTotal: number | null;
  percentage: number | null;
};

type RowAccess =
  | { view: "class" }
  | { view: "subject"; subjects: string[] };

const SUBJECT_COLUMN: Record<string, RegExp> = {
  MATHEMATICS: /\bmath/i,
  PHYSICS: /\bphys/i,
  CHEMISTRY: /\bchem/i,
  BIOLOGY: /\bbio/i,
  SCIENCE: /\bscience|\bgen\.?\s*sci/i,
  ENGLISH: /\benglish|\beng\b/i,
};

function fold(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function compactLabel(label: string) {
  return fold(label.replaceAll("\n", " "));
}

function colIndex(columns: string[], patterns: RegExp[]) {
  return columns.findIndex((label) => patterns.some((pattern) => pattern.test(compactLabel(label))));
}

function normalizeRoll(value: CellValue) {
  if (value == null) return "";
  return String(value).trim().toUpperCase().replace(/\s+/g, "");
}

function isIdentityColumn(label: string) {
  const text = compactLabel(label);
  return /^(s\.?\s*no\.?|sno|sl\.?\s*no\.?|#|name|candidate\s*name|student|student name|name of the student|roll|rollno|roll no\.?|regd?\.?\s*no\.?|registration|class|section|school|gender|sex)$/i.test(
    text,
  );
}

function subjectForColumn(label: string): string | null {
  const text = compactLabel(label);
  for (const [subject, pattern] of Object.entries(SUBJECT_COLUMN)) {
    if (pattern.test(text)) return subject;
  }
  return null;
}

function studentScope(student: RosterStudent): StudentScope {
  return {
    programCode: student.program.code,
    classLevel: student.classLevel,
    sectionId: student.sectionId,
  };
}

function matchRoster(row: CellValue[], columns: string[], roster: RosterStudent[]) {
  const rollCol = colIndex(columns, [/^roll/, /regd/, /registration/]);
  const nameCol = colIndex(columns, [/candidate\s*name/, /student\s*name/, /^name$/, /name of/]);
  const roll = rollCol >= 0 ? normalizeRoll(row[rollCol] ?? null) : "";
  if (roll) {
    const hit = roster.find((student) => normalizeRoll(student.rollNo) === roll);
    if (hit) return hit;
  }
  const name = nameCol >= 0 ? fold(String(row[nameCol] ?? "")) : "";
  if (name) {
    const hits = roster.filter((student) => fold(student.name) === name);
    if (hits.length === 1) return hits[0];
  }
  return null;
}

function accessFor(teacher: TeacherAccountDto, student: RosterStudent): RowAccess | null {
  const slot = studentScope(student);
  if (!teacherCanAccessStudent(teacher, slot)) return null;
  if (isClassTeacherOf(teacher, slot)) return { view: "class" };
  const subjects = assignedSubjects(teacher, slot);
  return subjects.length ? { view: "subject", subjects } : null;
}

function keepColumn(label: string, subjects: string[]) {
  if (isIdentityColumn(label)) return true;
  const subject = subjectForColumn(label);
  return Boolean(subject && subjects.includes(subject));
}

/** Vitaran papers: 25 questions × 4 marks. */
const QUESTIONS_PER_SUBJECT = 25;
const MARKS_PER_QUESTION = 4;
const PAPER_SUBJECT_MAX = QUESTIONS_PER_SUBJECT * MARKS_PER_QUESTION;

function maxFromLabel(label: string) {
  const match = compactLabel(label).match(/\((\d+(?:\.\d+)?)\s*m\)/i);
  return match ? Number(match[1]) : null;
}

function rewriteMaxInLabel(label: string, max: number) {
  if (/\(\s*\d+(?:\.\d+)?\s*m\s*\)/i.test(label)) {
    return label.replace(/\(\s*\d+(?:\.\d+)?\s*m\s*\)/i, `(${max}M)`);
  }
  return `${label.trimEnd()} (${max}M)`;
}

/**
 * Each subject is 25 questions × 4 marks. Excel headers sometimes paste a
 * student's score into the max (BIOLOGY 96M). Prefer the answer-key band, else 100.
 */
export function canonicalizePaperMaxes(
  columns: string[],
  rows: CellValue[][],
  caption: string[] = [],
  ranges: SubjectRange[] = [],
) {
  const nextColumns = [...columns];
  let paperMax = 0;

  columns.forEach((label, index) => {
    const subject = subjectForColumn(label);
    if (!subject) return;
    const range = ranges.find((row) => row.subject === subject);
    const max = range?.maxMarks ?? PAPER_SUBJECT_MAX;
    paperMax += max;
    nextColumns[index] = rewriteMaxInLabel(label, max);
  });

  const totalIndex = columns.findIndex(
    (label) => /total marks|grand total|^total$/.test(compactLabel(label)) && !subjectForColumn(label),
  );
  if (totalIndex >= 0 && paperMax > 0) {
    nextColumns[totalIndex] = rewriteMaxInLabel(columns[totalIndex] ?? "", paperMax);
  }

  const percentIndex = columns.findIndex((label) => /percentage|percent|^%$/.test(compactLabel(label)));
  const nextRows =
    totalIndex >= 0 && percentIndex >= 0 && paperMax > 0
      ? rows.map((row) => {
          const total = numericCell(row[totalIndex] ?? null);
          if (total == null) return row;
          const next = [...row];
          next[percentIndex] = Math.round((total / paperMax) * 1000) / 10;
          return next;
        })
      : rows;

  const nextCaption = caption.map((line) =>
    paperMax > 0 ? line.replace(/Max\.?\s*Marks:\s*\d+/i, `Max. Marks: ${paperMax}`) : line,
  );

  return { columns: nextColumns, rows: nextRows, caption: nextCaption, paperMax };
}

function numericCell(value: CellValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseScoreRow(columns: string[], row: CellValue[]): ParsedScoreRow {
  const subjects: ParsedSubjectScore[] = [];
  let total: number | null = null;
  let maxTotal: number | null = null;
  let percentage: number | null = null;

  columns.forEach((label, index) => {
    const value = numericCell(row[index] ?? null);
    if (value == null) return;
    const subject = subjectForColumn(label);
    if (subject) {
      subjects.push({ subject, score: value, max: maxFromLabel(label) });
      return;
    }
    const text = compactLabel(label);
    if (/percentage|percent|^%$/.test(text)) {
      percentage = value;
      return;
    }
    if (/total marks|grand total|^total$/.test(text)) {
      total = value;
      maxTotal = maxFromLabel(label);
    }
  });

  if (total == null && subjects.length > 0) {
    total = subjects.reduce((sum, item) => sum + item.score, 0);
    const maxes = subjects.map((item) => item.max).filter((value): value is number => value != null);
    if (maxes.length === subjects.length) maxTotal = maxes.reduce((sum, value) => sum + value, 0);
  }
  if (percentage == null && total != null && maxTotal) {
    percentage = Math.round((total / maxTotal) * 1000) / 10;
  }
  return { subjects, total, maxTotal, percentage };
}

function classLabelFor(classLevel: number, sectionName: string | null) {
  return classWithSectionLabel(classLevel, sectionName);
}

function rewriteClassCell(row: CellValue[], columns: string[], student: RosterStudent) {
  const classCol = colIndex(columns, [/^class$/]);
  if (classCol < 0) return row;
  const next = [...row];
  next[classCol] = `${student.classLevel}-${displaySectionName(student.section?.name)}`;
  return next;
}

export function findRowForStudent(
  columns: string[],
  rows: CellValue[][],
  student: Pick<RosterStudent, "name" | "rollNo">,
) {
  const roll = normalizeRoll(student.rollNo);
  const name = fold(student.name);
  const rollCol = colIndex(columns, [/^roll/, /regd/, /registration/]);
  const nameCol = colIndex(columns, [/candidate\s*name/, /student\s*name/, /^name$/, /name of/]);
  return (
    rows.find((row) => (rollCol >= 0 ? normalizeRoll(row[rollCol] ?? null) === roll : false)) ??
    rows.find((row) => (nameCol >= 0 ? fold(String(row[nameCol] ?? "")) === name : false)) ??
    null
  );
}

/** Class teacher: every subject for their students. Subject teacher: only assigned subject columns. */
export function projectSheetForTeacher(
  columns: string[],
  rows: CellValue[][],
  teacher: TeacherAccountDto,
  roster: RosterStudent[],
): ScopedSheet {
  const kept: Array<{ row: CellValue[]; access: RowAccess; classLevel: number; sectionName: string | null }> = [];
  for (const row of rows) {
    const student = matchRoster(row, columns, roster);
    if (!student) continue;
    const access = accessFor(teacher, student);
    if (!access) continue;
    kept.push({
      row: rewriteClassCell(row, columns, student),
      access,
      classLevel: student.classLevel,
      sectionName: displaySectionName(student.section?.name),
    });
  }

  const sections = [...new Set(kept.map((item) => item.sectionName))];
  const classLabel =
    kept.length > 0 && sections.length <= 1
      ? classLabelFor(kept[0]!.classLevel, sections[0] ?? null)
      : kept[0]
        ? `Class ${kept[0].classLevel}`
        : "Class";

  if (kept.length === 0) return { columns, rows: [], classLabel };

  const allClass = kept.every((item) => item.access.view === "class");
  if (allClass) return { columns, rows: kept.map((item) => item.row), classLabel };

  const subjectSet = new Set(
    kept.flatMap((item) => (item.access.view === "subject" ? item.access.subjects : [])),
  );
  const subjects = [...subjectSet];
  const allSubject = kept.every((item) => item.access.view === "subject");

  if (allSubject) {
    const indexes = columns.map((_, index) => index).filter((index) => keepColumn(columns[index] ?? "", subjects));
    return {
      columns: indexes.map((index) => columns[index] ?? `Column ${index + 1}`),
      rows: kept.map((item) => indexes.map((index) => item.row[index] ?? null)),
      classLabel,
    };
  }

  return {
    columns,
    rows: kept.map((item) => {
      if (item.access.view === "class") return item.row;
      const allowed = item.access.subjects;
      return columns.map((label, index) => (keepColumn(label, allowed) ? (item.row[index] ?? null) : null));
    }),
    classLabel,
  };
}
