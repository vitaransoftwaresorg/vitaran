import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import opentype, { type Font } from "opentype.js";
import sharp from "sharp";
import {
  asAnswers,
  keyHasMultiCorrect,
  keyOptions,
  markedList,
  type AnswerOption,
} from "../utils/answer-key-parse.js";
import type { BubbleMap } from "./detect.js";
import { subjectHeader } from "../utils/result-columns.js";
import { questionResult } from "./score.js";

const GREEN = "#16a34a";
const RED = "#dc2626";
/** Partial credit (some key options only) — yellow on the evaluated sheet. */
const YELLOW = "#ca8a04";

type TableRow = {
  subject: string;
  correct: number;
  partial?: number;
  wrong: number;
  blank: number;
  total: number;
  maxTotal?: number;
};

let tableFont: Promise<Font | null> | null = null;

/** Bundled font → outlines, so Sharp prints marks on any host without system fonts. */
function loadTableFont() {
  tableFont ??= readFile(fileURLToPath(new URL("../../assets/fonts/cinzel-700.woff", import.meta.url)))
    .then((file) => opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)))
    .catch(() => null);
  return tableFont;
}

/**
 * Warped sheet colours: green = correct, red = wrong, yellow = partial,
 * plus a green ring on the key option when the student missed it.
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
    if (filled && (result === "correct" || result === "wrong" || result === "partial")) {
      const color = result === "correct" ? GREEN : result === "partial" ? YELLOW : RED;
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
  const table = subjects.length
    ? await scoreTablePng(subjects, bubbles.width, keyHasMultiCorrect(key))
    : null;
  const withTable = table
    ? await sharp(marked)
        .extend({ top: table.height, background: "#ffffff" })
        .composite([{ input: table.png, top: 0, left: 0 }])
        .png()
        .toBuffer()
    : marked;
  return sharp(withTable)
    .resize({ width: 1100, height: 1900, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer();
}

const formatMarks = (value: number) => String(Number(value.toFixed(3)));

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function marksCell(row: Pick<TableRow, "total" | "maxTotal">) {
  const got = formatMarks(row.total);
  return row.maxTotal != null && row.maxTotal > 0 ? `${got}/${formatMarks(row.maxTotal)}` : got;
}

function textPath(
  font: Font | null,
  value: string,
  x: number,
  y: number,
  size: number,
  options: { anchor?: "start" | "middle"; bold?: boolean },
) {
  if (font) {
    const width = font.getAdvanceWidth(value, size);
    const startX = options.anchor === "middle" ? x - width / 2 : x;
    return `<path d="${font.getPath(value, startX, y, size).toPathData(2)}" fill="#111"/>`;
  }
  const bold = options.bold ? ' font-weight="700"' : "";
  return `<text x="${x}" y="${y}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="${size}"${bold} fill="#111" text-anchor="${options.anchor ?? "start"}">${escapeXml(value)}</text>`;
}

/** Subject-wise Right / (Partial) / Wrong / Blank / Marks table drawn above the sheet. */
async function scoreTablePng(subjects: TableRow[], width: number, showPartial: boolean) {
  const font = await loadTableFont();
  const header = showPartial
    ? ["Subject", "R", "P", "W", "B", "Marks"]
    : ["Subject", "R", "W", "B", "Marks"];
  const rows: string[][] = [
    header,
    ...subjects.map((row) => {
      const counts = showPartial
        ? [String(row.correct), String(row.partial ?? 0), String(row.wrong), String(row.blank)]
        : [String(row.correct), String(row.wrong), String(row.blank)];
      return [subjectHeader(row.subject), ...counts, marksCell(row)];
    }),
    [
      "Total",
      ...(showPartial
        ? [
            String(subjects.reduce((sum, row) => sum + row.correct, 0)),
            String(subjects.reduce((sum, row) => sum + (row.partial ?? 0), 0)),
            String(subjects.reduce((sum, row) => sum + row.wrong, 0)),
            String(subjects.reduce((sum, row) => sum + row.blank, 0)),
          ]
        : [
            String(subjects.reduce((sum, row) => sum + row.correct, 0)),
            String(subjects.reduce((sum, row) => sum + row.wrong, 0)),
            String(subjects.reduce((sum, row) => sum + row.blank, 0)),
          ]),
      marksCell({
        total: subjects.reduce((sum, row) => sum + row.total, 0),
        maxTotal: subjects.reduce((sum, row) => sum + (row.maxTotal ?? 0), 0) || undefined,
      }),
    ],
  ];
  const margin = Math.round(width * 0.04);
  const tableWidth = width - margin * 2;
  const rowHeight = Math.round(width * 0.05);
  const fontSize = Math.round(rowHeight * 0.48);
  const shares = showPartial ? [0.26, 0.1, 0.1, 0.1, 0.1, 0.34] : [0.3, 0.12, 0.12, 0.12, 0.34];
  const xs = shares.reduce<number[]>((acc, share) => [...acc, acc[acc.length - 1]! + share * tableWidth], [margin]);
  const top = margin;
  const height = top + rowHeight * rows.length + margin;
  const parts: string[] = [
    `<rect x="${margin}" y="${top}" width="${tableWidth}" height="${rowHeight * rows.length}" fill="#cdeef5" stroke="#111" stroke-width="2"/>`,
  ];
  rows.forEach((cells, r) => {
    const y = top + r * rowHeight;
    if (r > 0) {
      parts.push(
        `<line x1="${margin}" y1="${y}" x2="${margin + tableWidth}" y2="${y}" stroke="#111" stroke-width="2"/>`,
      );
    }
    const baseline = y + rowHeight * 0.68;
    const bold = r === 0 || r === rows.length - 1;
    cells.forEach((cell, c) => {
      const left = c === 0;
      const x = left ? xs[c]! + fontSize * 0.35 : (xs[c]! + xs[c + 1]!) / 2;
      parts.push(textPath(font, cell, x, baseline, fontSize, { anchor: left ? "start" : "middle", bold }));
    });
  });
  for (const x of xs.slice(1, -1)) {
    parts.push(
      `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + rowHeight * rows.length}" stroke="#111" stroke-width="2"/>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${parts.join("")}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { height, png };
}
