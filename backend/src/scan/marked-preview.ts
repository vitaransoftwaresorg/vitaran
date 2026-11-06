import sharp from "sharp";
import { asAnswers, keyOptions, markedList, type AnswerOption } from "../utils/answer-key-parse.js";
import type { BubbleMap } from "./detect.js";
import { subjectHeader } from "../utils/result-columns.js";
import { questionResult } from "./score.js";

const GREEN = "#16a34a";
const RED = "#dc2626";

/**
 * Warped sheet with every filled bubble coloured green (counts as correct) or red (wrong),
 * plus a green ring on the key's option where the student missed it, under a subject score table.
 */
export async function markedSheetPreview(
  sheet: Buffer,
  bubbles: BubbleMap,
  answers: Record<string, AnswerOption[]>,
  keyAnswers: unknown,
  subjects: TableRow[] = [],
): Promise<Buffer> {
  const key = asAnswers(keyAnswers);
  const r = bubbles.radius * 1.15;
  const stroke = Math.max(2, bubbles.radius * 0.28);
  const shapes: string[] = [];
  for (const point of bubbles.points) {
    const question = String(point.question);
    const expected = key[question];
    const result = questionResult(answers[question], expected);
    const filled = markedList(answers[question]).includes(point.option);
    const circle = `cx="${point.x}" cy="${point.y}" r="${r}"`;
    if (filled && (result === "correct" || result === "wrong")) {
      const color = result === "correct" ? GREEN : RED;
      shapes.push(
        `<circle ${circle} fill="${color}" fill-opacity="0.45" stroke="${color}" stroke-width="${stroke}"/>`,
      );
    } else if (!filled && result !== "correct" && result !== "unkeyed" && keyOptions(expected).includes(point.option)) {
      shapes.push(`<circle ${circle} fill="none" stroke="${GREEN}" stroke-width="${stroke}"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bubbles.width}" height="${bubbles.height}">${shapes.join("")}</svg>`;
  const marked = await sharp(sheet)
    .resize(bubbles.width, bubbles.height, { fit: "fill" })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  const table = subjects.length ? scoreTable(subjects, bubbles.width) : null;
  const withTable = table
    ? await sharp(marked)
        .extend({ top: table.height, background: "#ffffff" })
        .composite([{ input: Buffer.from(table.svg), top: 0, left: 0 }])
        .png()
        .toBuffer()
    : marked;
  return sharp(withTable)
    .resize({ width: 1100, height: 1900, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer();
}

type TableRow = { subject: string; correct: number; wrong: number; blank: number; total: number };

const formatMarks = (value: number) => String(Math.round(value * 100) / 100);

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Subject-wise Right / Wrong / Blank / Marks table drawn above the sheet. */
function scoreTable(subjects: TableRow[], width: number) {
  const rows: string[][] = [
    ["Subject", "R", "W", "B", "Marks"],
    ...subjects.map((row) => [
      subjectHeader(row.subject),
      String(row.correct),
      String(row.wrong),
      String(row.blank),
      formatMarks(row.total),
    ]),
    [
      "Total",
      String(subjects.reduce((sum, row) => sum + row.correct, 0)),
      String(subjects.reduce((sum, row) => sum + row.wrong, 0)),
      String(subjects.reduce((sum, row) => sum + row.blank, 0)),
      formatMarks(subjects.reduce((sum, row) => sum + row.total, 0)),
    ],
  ];
  const margin = Math.round(width * 0.04);
  const tableWidth = width - margin * 2;
  const rowHeight = Math.round(width * 0.05);
  const font = Math.round(rowHeight * 0.52);
  const shares = [0.3, 0.15, 0.15, 0.15, 0.25];
  const xs = shares.reduce<number[]>((acc, share) => [...acc, acc[acc.length - 1]! + share * tableWidth], [margin]);
  const top = margin;
  const height = top + rowHeight * rows.length + margin;
  const parts: string[] = [
    `<rect x="${margin}" y="${top}" width="${tableWidth}" height="${rowHeight * rows.length}" fill="#cdeef5" stroke="#111" stroke-width="2"/>`,
  ];
  rows.forEach((cells, r) => {
    const y = top + r * rowHeight;
    if (r > 0) parts.push(`<line x1="${margin}" y1="${y}" x2="${margin + tableWidth}" y2="${y}" stroke="#111" stroke-width="2"/>`);
    const bold = r === 0 || r === rows.length - 1 ? ' font-weight="700"' : "";
    cells.forEach((cell, c) => {
      const left = c === 0;
      const x = left ? xs[c]! + font * 0.4 : (xs[c]! + xs[c + 1]!) / 2;
      parts.push(
        `<text x="${x}" y="${y + rowHeight * 0.68}" font-family="Arial, Helvetica, sans-serif" font-size="${font}"${bold} fill="#111" text-anchor="${left ? "start" : "middle"}">${escapeXml(cell)}</text>`,
      );
    });
  });
  for (const x of xs.slice(1, -1)) {
    parts.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${top + rowHeight * rows.length}" stroke="#111" stroke-width="2"/>`);
  }
  return {
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${parts.join("")}</svg>`,
  };
}
