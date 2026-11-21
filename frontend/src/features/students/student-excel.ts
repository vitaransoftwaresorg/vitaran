"use client";

import type { CellValue as ExcelCellValue } from "exceljs";

export type ImportedStudent = {
  rollNo: string;
  name: string;
  parentName: string;
  parentPhone: string;
  /** Section letter/name from Excel, e.g. A / B. */
  section: string;
  /** Class level from school-wide import sheets (1–12). */
  classLevel: number | null;
};

type Column = keyof ImportedStudent;

/** Bulk save limit on the API; one import fills at most this many rows. */
export const MAX_IMPORT_ROWS = 300;

/** School-wide Excel import cap (submitted in per-class bulk batches). */
export const MAX_SCHOOL_IMPORT_ROWS = 1500;

type TemplateColumn = { key: Column; header: string; width: number };

const BASE_COLUMNS: TemplateColumn[] = [
  { key: "rollNo", header: "Reg No *", width: 14 },
  { key: "name", header: "Student name (optional)", width: 28 },
  { key: "parentName", header: "Parent name (optional)", width: 28 },
  { key: "parentPhone", header: "Parent mobile (optional)", width: 18 },
];

const SECTION_COLUMN: TemplateColumn = {
  key: "section",
  header: "Section *",
  width: 10,
};

const CLASS_COLUMN: TemplateColumn = {
  key: "classLevel",
  header: "Class *",
  width: 10,
};

/** Default template column order (with section) — also used when Excel has no header row. */
const TEMPLATE_COLUMNS: TemplateColumn[] = [
  BASE_COLUMNS[0]!,
  SECTION_COLUMN,
  ...BASE_COLUMNS.slice(1),
];

/** School-wide template: Class + Section so rows can land in different classes. */
const SCHOOL_TEMPLATE_COLUMNS: TemplateColumn[] = [
  CLASS_COLUMN,
  { key: "section", header: "Section", width: 10 },
  ...BASE_COLUMNS,
];

export type StudentsTemplateOptions = {
  /** When false, omit the Section column (class/section already chosen on the page). Default true. */
  includeSection?: boolean;
  /** School-wide sheet with a Class column. */
  schoolWide?: boolean;
  fileName?: string;
  /** Used in the download file name when fileName is not set. */
  scopeLabel?: string;
};

/** Header text → column; checked in order so "parent name" wins over plain "name". */
const HEADER_MATCHERS: Array<[Column, RegExp]> = [
  ["parentPhone", /mobile|phone|contact|whats ?app/],
  ["parentName", /parent|father|mother|guardian/],
  ["classLevel", /^class|^grade|^std\.?|^standard/],
  ["section", /section|sec\.?$/],
  ["rollNo", /reg|roll|admission|enrol/],
  ["name", /name|student/],
];

const loadExcel = () => import("exceljs").then((mod) => mod.default ?? mod);

function cellText(value: ExcelCellValue): string {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("result" in value) return cellText((value.result ?? null) as ExcelCellValue);
  return "";
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

function columnFor(header: string): Column | null {
  const text = header.toLowerCase().replace(/\*/g, "").trim();
  if (!text) return null;
  for (const [column, pattern] of HEADER_MATCHERS) if (pattern.test(text)) return column;
  return null;
}

function parseClassLevel(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}

function templateColumns(opts: { includeSection: boolean; schoolWide: boolean }): TemplateColumn[] {
  if (opts.schoolWide) return SCHOOL_TEMPLATE_COLUMNS;
  if (!opts.includeSection) return BASE_COLUMNS;
  return TEMPLATE_COLUMNS;
}

/** Read students from the first sheet of an .xlsx file. Header names decide the columns; without a header row the template order is used. */
export async function readStudentsExcel(file: File): Promise<ImportedStudent[]> {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error("Could not open this file. Save it as an Excel workbook (.xlsx) and try again.");
  }
  const sheet = workbook.worksheets.find((ws) => ws.actualRowCount > 0);
  if (!sheet) throw new Error("This Excel file has no rows.");

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    for (let col = 1; col <= Math.max(row.cellCount, SCHOOL_TEMPLATE_COLUMNS.length); col += 1) {
      values.push(clean(cellText(row.getCell(col).value)));
    }
    if (values.some(Boolean)) rows.push(values);
  });

  let map = new Map<Column, number>();
  let start = 0;
  const headerIndex = rows.slice(0, 5).findIndex((cells) => {
    const found = new Map<Column, number>();
    cells.forEach((cell, index) => {
      // Headers are words; a 7-digit number in a cell means this is already data.
      if (/\d{5,}/.test(cell)) return;
      const column = columnFor(cell);
      if (column && !found.has(column)) found.set(column, index);
    });
    if (found.size >= 2) map = found;
    return found.size >= 2;
  });
  if (headerIndex >= 0) {
    start = headerIndex + 1;
  } else {
    // No header row — use template order, but skip leading blank columns (common spacer col A).
    const offset = rows.reduce((min, cells) => {
      const first = cells.findIndex(Boolean);
      if (first < 0) return min;
      return Math.min(min, first);
    }, Number.POSITIVE_INFINITY);
    const shift = Number.isFinite(offset) ? offset : 0;
    const firstData = rows[0] ?? [];
    const first = (firstData[shift] ?? "").trim();
    const second = (firstData[shift + 1] ?? "").trim();
    // School-wide sheets often start with a class number in col 1.
    const looksLikeClass = parseClassLevel(first) != null && !/^\d{7}$/.test(first);
    const looksLikeSection = /^[A-Z0-9]{1,4}$/i.test(second) && !/^\d{7}$/.test(second);
    const columns = looksLikeClass
      ? SCHOOL_TEMPLATE_COLUMNS
      : looksLikeSection
        ? TEMPLATE_COLUMNS
        : BASE_COLUMNS;
    map = new Map(columns.map((column, index) => [column.key, index + shift]));
  }

  const pick = (cells: string[], column: Column) => {
    const index = map.get(column);
    return index == null ? "" : (cells[index] ?? "");
  };

  return rows.slice(start).flatMap((cells) => {
    const student: ImportedStudent = {
      rollNo: pick(cells, "rollNo").replace(/\D/g, ""),
      name: pick(cells, "name"),
      parentName: pick(cells, "parentName"),
      parentPhone: pick(cells, "parentPhone").replace(/\D/g, "").replace(/^(?:91|0)(\d{10})$/, "$1"),
      section: pick(cells, "section").trim().toUpperCase(),
      classLevel: parseClassLevel(pick(cells, "classLevel")),
    };
    const hasData =
      Boolean(student.rollNo || student.name || student.parentName || student.parentPhone) ||
      student.classLevel != null ||
      Boolean(student.section);
    return hasData ? [student] : [];
  });
}

/** Blank import sheet with the columns the importer expects; number columns are text so leading zeros stay. */
export async function downloadStudentsTemplate(options: StudentsTemplateOptions | string = {}) {
  const opts: StudentsTemplateOptions =
    typeof options === "string" ? { fileName: options } : options;
  const schoolWide = Boolean(opts.schoolWide);
  const includeSection = opts.includeSection !== false;
  const columns = templateColumns({ includeSection, schoolWide });
  const fileName =
    opts.fileName ??
    (opts.scopeLabel
      ? `students-${opts.scopeLabel.replace(/\s+/g, "-").toLowerCase()}.xlsx`
      : schoolWide
        ? "school-students-import.xlsx"
        : "students-import-template.xlsx");

  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(({ key, header, width }) => ({ key, header, width }));
  const textKeys: Column[] = schoolWide
    ? ["classLevel", "section", "rollNo", "parentPhone"]
    : includeSection
      ? ["rollNo", "parentPhone", "section"]
      : ["rollNo", "parentPhone"];
  for (const key of textKeys) sheet.getColumn(key).numFmt = "@";

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF191C5F" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
