"use client";

import type { CellValue as ExcelCellValue } from "exceljs";
import type { KeyAnswer } from "@/types/answer-key";
import { parseKeyAnswer } from "@/types/answer-key";
import {
  ANSWER_KEY_TABLE_COLUMNS,
  answerKeyTableQuestion,
  answerKeyTableRows,
} from "./answer-key-table-layout";

export type ImportedKeyAnswer = {
  question: number;
  answer: KeyAnswer;
};

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

function parseQuestion(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isInteger(value) && value >= 1 && value <= 200 ? value : null;
}

function pushAnswer(
  out: ImportedKeyAnswer[],
  seen: Set<number>,
  question: number | null,
  answerRaw: string,
) {
  const answer = parseKeyAnswer(answerRaw);
  if (question == null && !answer) return;
  if (question == null) {
    throw new Error(`Row has an answer but no question number (${answerRaw}).`);
  }
  if (!answer) return;
  if (seen.has(question)) {
    throw new Error(`Question ${question} appears more than once.`);
  }
  seen.add(question);
  out.push({ question, answer });
}

/** Blank key sheet in the same row layout as the on-screen answer key table. */
export async function downloadAnswerKeyTemplate(options?: {
  questionCount?: number;
  fileName?: string;
}) {
  const questionCount = Math.min(200, Math.max(1, options?.questionCount ?? 100));
  const questions = Array.from({ length: questionCount }, (_, index) => index + 1);
  const columns = ANSWER_KEY_TABLE_COLUMNS;
  const rows = answerKeyTableRows(questionCount);
  const fileName = options?.fileName ?? "answer-key-import.xlsx";

  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Answers", { views: [{ state: "frozen", ySplit: 1 }] });

  const headerValues: string[] = [];
  for (let col = 0; col < columns; col += 1) {
    headerValues.push("Q", "Answer");
  }
  const header = sheet.addRow(headerValues);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF191C5F" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;

  for (let col = 1; col <= columns * 2; col += 1) {
    // Wider Answer cols so multi keys like B/C stay text, not clipped.
    sheet.getColumn(col).width = col % 2 === 1 ? 8 : 12;
    sheet.getColumn(col).numFmt = "@";
    sheet.getColumn(col).alignment = { horizontal: "center" };
  }

  for (let row = 0; row < rows; row += 1) {
    const values: string[] = [];
    for (let col = 0; col < columns; col += 1) {
      const question = answerKeyTableQuestion(questions, row, col);
      values.push(question != null ? String(question) : "", "");
    }
    sheet.addRow(values);
  }

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

/**
 * Read answers from the first sheet.
 * Supports the shared row grid (Q/Answer pairs across) or a simple two-column list.
 */
export async function readAnswerKeyExcel(file: File): Promise<ImportedKeyAnswer[]> {
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
    for (let col = 1; col <= Math.max(row.cellCount, 2); col += 1) {
      values.push(clean(cellText(row.getCell(col).value)));
    }
    if (values.some(Boolean)) rows.push(values);
  });

  const out: ImportedKeyAnswer[] = [];
  const seen = new Set<number>();
  const header = rows[0] ?? [];
  const looksLikeGridHeader =
    header.filter((cell) => /^q\.?$|^question/i.test(cell)).length >= 2 ||
    header.filter((cell) => /answer|key|option/i.test(cell)).length >= 2;

  // Wide grid: each row is Q, Answer, Q, Answer, … (same as the on-screen table).
  if (looksLikeGridHeader || (header.length >= 4 && parseQuestion(header[0] ?? "") != null)) {
    const start = looksLikeGridHeader ? 1 : 0;
    for (const cells of rows.slice(start)) {
      for (let col = 0; col + 1 < cells.length; col += 2) {
        pushAnswer(out, seen, parseQuestion(cells[col] ?? ""), cells[col + 1] ?? "");
      }
    }
    if (out.length > 0 || looksLikeGridHeader) return out;
  }

  // Fallback: two-column Question / Answer list.
  let questionCol = 0;
  let answerCol = 1;
  let start = 0;
  const qHeader = header.findIndex((cell) => /question|^q\.?$|^no\.?$|^#/i.test(cell));
  const aHeader = header.findIndex((cell) => /answer|key|option|correct/i.test(cell));
  if (qHeader >= 0 && aHeader >= 0) {
    questionCol = qHeader;
    answerCol = aHeader;
    start = 1;
  }

  for (const cells of rows.slice(start)) {
    pushAnswer(out, seen, parseQuestion(cells[questionCol] ?? ""), cells[answerCol] ?? "");
  }

  return out;
}
