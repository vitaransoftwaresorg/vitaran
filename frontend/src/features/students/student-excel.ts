"use client";

import type { CellValue as ExcelCellValue } from "exceljs";

export type ImportedStudent = {
  rollNo: string;
  name: string;
  parentName: string;
  parentPhone: string;
  email: string;
};

type Column = keyof ImportedStudent;

/** Bulk save limit on the API; one import fills at most this many rows. */
export const MAX_IMPORT_ROWS = 300;

const TEMPLATE_COLUMNS: Array<{ key: Column; header: string; width: number }> = [
  { key: "rollNo", header: "Reg. no", width: 14 },
  { key: "name", header: "Student name", width: 28 },
  { key: "parentName", header: "Parent name", width: 28 },
  { key: "parentPhone", header: "Parent mobile", width: 16 },
  { key: "email", header: "Parent email", width: 30 },
];

/** Header text → column; checked in order so "parent name" wins over plain "name". */
const HEADER_MATCHERS: Array<[Column, RegExp]> = [
  ["email", /mail/],
  ["parentPhone", /mobile|phone|contact|whats ?app/],
  ["parentName", /parent|father|mother|guardian/],
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
  const text = header.toLowerCase();
  if (!text) return null;
  for (const [column, pattern] of HEADER_MATCHERS) if (pattern.test(text)) return column;
  return null;
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
    for (let col = 1; col <= Math.max(row.cellCount, TEMPLATE_COLUMNS.length); col += 1) {
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
  if (headerIndex >= 0) start = headerIndex + 1;
  else map = new Map(TEMPLATE_COLUMNS.map((column, index) => [column.key, index]));

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
      email: pick(cells, "email").toLowerCase(),
    };
    return Object.values(student).some(Boolean) ? [student] : [];
  });
}

/** Blank import sheet with the columns the importer expects; number columns are text so leading zeros stay. */
export async function downloadStudentsTemplate(fileName = "students-import-template.xlsx") {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = TEMPLATE_COLUMNS.map(({ key, header, width }) => ({ key, header, width }));
  for (const key of ["rollNo", "parentPhone"] as const) sheet.getColumn(key).numFmt = "@";

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF191C5F" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  const help = workbook.addWorksheet("How to fill");
  help.getColumn(1).width = 90;
  [
    "One student per row on the Students sheet. Keep the header row.",
    "Reg. no: 7 digits, unique in the school (required).",
    "Student name and Parent name: at least 2 letters (required).",
    "Parent mobile: 10 digits, no +91 (required).",
    "Parent email: optional.",
    `Up to ${MAX_IMPORT_ROWS} students per file. Program, class and section are picked on the Add students page.`,
  ].forEach((line) => help.addRow([line]));

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
