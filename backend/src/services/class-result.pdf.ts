import type { Font } from "opentype.js";
import { PDFDocument, StandardFonts, setCharacterSpacing, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import {
  BRAND_50,
  BRAND_200,
  BRAND_700,
  BRAND_900,
  BRAND_950,
  N_200,
  N_400,
  N_500,
  N_700,
  N_950,
  WHITE,
  embedLogo,
  fitSize,
  hex,
  initials,
  safeText,
  truncate,
  type Fonts,
} from "./pdf-kit.js";

export type ClassResultRow = {
  rank: number | null;
  sectionRank: number | null;
  rollNo: string;
  name: string;
  classLabel: string;
  marks: Array<number | null>;
  total: number | null;
  percentage: number | null;
};

export type ClassResultPdfData = {
  schoolName: string;
  programName: string;
  classLevel: number;
  testNumber: number;
  testId: string;
  subjects: Array<{ label: string; max: number | null }>;
  totalMax: number | null;
  rows: ClassResultRow[];
};

export type ClassResultPdfAssets = {
  vitaran: Buffer | null;
  school: Buffer | null;
  titleFont: Font | null;
};

/** A4; landscape when the subjects leave too little room for names. */
const PORTRAIT: [number, number] = [595.28, 841.89];
const LANDSCAPE: [number, number] = [841.89, 595.28];
const M = 34;
const FOOTER = 44;
const ROW_H = 19;
const HEAD_H = 30;

const GOLD = hex("#c9a227");
const GOLD_DARK = hex("#8a6a10");
const MEDALS = [hex("#c9a227"), hex("#8e97ab"), hex("#b06a2c")];
const MEDAL_TINTS = [hex("#fbf5e1"), hex("#f1f3f7"), hex("#f8ece2")];

const fmt = (value: number | null, digits = 2) =>
  value == null ? "-" : String(Math.round(value * 10 ** digits) / 10 ** digits);

type Ctx = { pdf: PDFDocument; fonts: Fonts; titleFont: Font | null; size: [number, number] };

type Align = "left" | "center" | "right";

/** `top` is the baseline measured from the top of the page. */
function text(
  page: PDFPage,
  value: string,
  x: number,
  top: number,
  options: { font: Fonts["regular"]; size: number; color?: RGB; align?: Align; spacing?: number },
) {
  const content = safeText(options.font, value);
  const spacing = options.spacing ?? 0;
  const width = options.font.widthOfTextAtSize(content, options.size) + spacing * Math.max(0, content.length - 1);
  const left = options.align === "center" ? x - width / 2 : options.align === "right" ? x - width : x;
  if (spacing) page.pushOperators(setCharacterSpacing(spacing));
  page.drawText(content, {
    x: left,
    y: page.getHeight() - top,
    font: options.font,
    size: options.size,
    color: options.color ?? N_950,
  });
  if (spacing) page.pushOperators(setCharacterSpacing(0));
  return width;
}

function box(
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  height: number,
  radius: number,
  options: { fill?: RGB; border?: RGB; borderWidth?: number },
) {
  const r = Math.min(radius, width / 2, height / 2);
  const path =
    `M ${r} 0 H ${width - r} Q ${width} 0 ${width} ${r} V ${height - r} Q ${width} ${height} ${width - r} ${height} ` +
    `H ${r} Q 0 ${height} 0 ${height - r} V ${r} Q 0 0 ${r} 0 Z`;
  page.drawSvgPath(path, {
    x,
    y: page.getHeight() - top,
    color: options.fill,
    borderColor: options.border,
    borderWidth: options.border ? (options.borderWidth ?? 0.75) : 0,
  });
}

function image(page: PDFPage, img: PDFImage, x: number, top: number, boxW: number, boxH: number) {
  const scale = Math.min(boxW / img.width, boxH / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  page.drawImage(img, {
    x: x + (boxW - width) / 2,
    y: page.getHeight() - top - boxH + (boxH - height) / 2,
    width,
    height,
  });
}

function diamond(page: PDFPage, cx: number, cy: number, r: number, color: RGB) {
  page.drawSvgPath(`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`, { x: cx, y: page.getHeight() - cy, color });
}

function hline(page: PDFPage, x1: number, x2: number, top: number, color: RGB, thickness = 0.75) {
  const y = page.getHeight() - top;
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

const TRACKING = 0.06;

/** Display text drawn as Cinzel outlines (looks the same on every printer); Helvetica bold if the font is missing. */
function display(
  ctx: Ctx,
  page: PDFPage,
  value: string,
  cx: number,
  baseline: number,
  maxWidth: number,
  size: number,
  min: number,
  color: RGB,
) {
  const font = ctx.titleFont;
  if (!font) {
    const fitted = fitSize(ctx.fonts.bold, value, maxWidth, size * 0.8, min * 0.8);
    text(page, value, cx, baseline, { font: ctx.fonts.bold, size: fitted, color, align: "center" });
    return fitted;
  }
  let next = size;
  const width = (s: number) => font.getAdvanceWidth(value, s, { letterSpacing: TRACKING });
  while (next > min && width(next) > maxWidth) next -= 0.5;
  const path = font.getPath(value, 0, 0, next, { letterSpacing: TRACKING }).toPathData(2);
  page.drawSvgPath(path, { x: cx - width(next) / 2, y: page.getHeight() - baseline, color });
  return next;
}

/** Two lines split where they come out closest in width. */
function splitTitle(value: string) {
  const words = value.split(/\s+/);
  let best: [string, string] = [value, ""];
  let gap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const pair: [string, string] = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const diff = Math.abs(pair[0].length - pair[1].length);
    if (diff < gap) [best, gap] = [pair, diff];
  }
  return best;
}

type Logos = { vitaran: PDFImage | null; school: PDFImage | null };

/** Logos, school name, ornament and the result title; returns where the content starts. */
function drawHeader(ctx: Ctx, page: PDFPage, data: ClassResultPdfData, logos: Logos) {
  const [W] = ctx.size;
  page.drawRectangle({ x: 0, y: page.getHeight() - 7, width: W, height: 7, color: BRAND_900 });
  page.drawRectangle({ x: 0, y: page.getHeight() - 9, width: W, height: 2, color: GOLD });

  if (logos.vitaran) image(page, logos.vitaran, M, 24, 92, 46);
  const crest = 54;
  if (logos.school) {
    image(page, logos.school, W - M - crest, 20, crest, crest);
  } else {
    page.drawCircle({ x: W - M - crest / 2, y: page.getHeight() - 47, size: 25, color: BRAND_900 });
    page.drawCircle({ x: W - M - crest / 2, y: page.getHeight() - 47, size: 22, borderColor: GOLD, borderWidth: 1 });
    text(page, initials(data.schoolName), W - M - crest / 2, 52, {
      font: ctx.fonts.bold,
      size: 14,
      color: WHITE,
      align: "center",
    });
  }

  const nameWidth = W - 2 * (M + 104);
  const name = data.schoolName.toUpperCase();
  const width = (value: string, size: number) =>
    ctx.titleFont
      ? ctx.titleFont.getAdvanceWidth(value, size, { letterSpacing: TRACKING })
      : ctx.fonts.bold.widthOfTextAtSize(safeText(ctx.fonts.bold, value), size * 0.8);
  let y: number;
  if (width(name, 18) <= nameWidth || !name.includes(" ")) {
    display(ctx, page, name, W / 2, 50, nameWidth, 24, 13, BRAND_950);
    y = 64;
  } else {
    const [first, second] = splitTitle(name);
    display(ctx, page, first, W / 2, 39, nameWidth, 18, 12, BRAND_950);
    display(ctx, page, second, W / 2, 61, nameWidth, 18, 12, BRAND_950);
    y = 72;
  }

  hline(page, W / 2 - 70, W / 2 - 9, y, GOLD, 1);
  diamond(page, W / 2, y, 4, GOLD);
  hline(page, W / 2 + 9, W / 2 + 70, y, GOLD, 1);

  const title = `Test ${data.testNumber} Results`;
  display(ctx, page, title, W / 2, y + 27, W - 2 * M, 20, 14, BRAND_900);

  const facts = [`Class ${data.classLevel}`, data.programName, data.testId ? `Test ID ${data.testId}` : ""]
    .map((part) => part.trim())
    .filter((part, index, all) => part && all.indexOf(part) === index);
  const line = facts.join("   |   ");
  const lineSize = fitSize(ctx.fonts.bold, line, W - 2 * M - 40, 9, 7);
  const lineW = ctx.fonts.bold.widthOfTextAtSize(safeText(ctx.fonts.bold, line), lineSize) + 0.8 * line.length;
  box(page, W / 2 - lineW / 2 - 14, y + 37, lineW + 28, 20, 10, { fill: BRAND_900 });
  text(page, line, W / 2, y + 50.5, { font: ctx.fonts.bold, size: lineSize, color: WHITE, align: "center", spacing: 0.8 });

  return y + 74;
}

/** Later pages: one line naming the school and the result, so loose pages stay identifiable. */
function drawRunningHeader(ctx: Ctx, page: PDFPage, data: ClassResultPdfData) {
  const [W] = ctx.size;
  page.drawRectangle({ x: 0, y: page.getHeight() - 7, width: W, height: 7, color: BRAND_900 });
  page.drawRectangle({ x: 0, y: page.getHeight() - 9, width: W, height: 2, color: GOLD });
  text(page, truncate(ctx.fonts.bold, data.schoolName, 10, W / 2), M, 30, { font: ctx.fonts.bold, size: 10, color: BRAND_950 });
  text(page, `Test ${data.testNumber} Results  |  Class ${data.classLevel}`, W - M, 30, {
    font: ctx.fonts.regular,
    size: 9,
    color: N_500,
    align: "right",
  });
  hline(page, M, W - M, 38, BRAND_200);
  return 50;
}

function medal(ctx: Ctx, page: PDFPage, cx: number, cy: number, r: number, rank: number) {
  const color = MEDALS[rank - 1] ?? BRAND_700;
  page.drawCircle({ x: cx, y: page.getHeight() - cy, size: r, color });
  page.drawCircle({ x: cx, y: page.getHeight() - cy, size: r - 1.8, borderColor: WHITE, borderWidth: 0.8, borderOpacity: 0.8 });
  const size = r * 0.95;
  text(page, String(rank), cx, cy + size * 0.36, { font: ctx.fonts.bold, size, color: WHITE, align: "center" });
}

function drawToppers(ctx: Ctx, page: PDFPage, data: ClassResultPdfData, top: number) {
  const toppers = data.rows.filter((row) => row.rank != null && row.rank <= 3 && row.total != null).slice(0, 3);
  if (!toppers.length) return top;
  const [W] = ctx.size;

  diamond(page, M + 4, top + 5, 4, GOLD);
  text(page, "TOP PERFORMERS", M + 14, top + 8.5, { font: ctx.fonts.bold, size: 9.5, color: BRAND_900, spacing: 1.6 });
  hline(page, M + 128, W - M, top + 5, GOLD, 0.6);

  const cardsTop = top + 18;
  const gap = 12;
  const cardW = (W - 2 * M - gap * 2) / 3;
  const cardH = 66;
  toppers.forEach((row, index) => {
    const rank = row.rank!;
    const x = M + index * (cardW + gap);
    box(page, x, cardsTop, cardW, cardH, 10, { fill: MEDAL_TINTS[rank - 1] ?? BRAND_50, border: MEDALS[rank - 1] ?? BRAND_200, borderWidth: 1 });
    medal(ctx, page, x + 26, cardsTop + cardH / 2, 15, rank);
    const textX = x + 50;
    const textW = cardW - 60;
    text(page, truncate(ctx.fonts.bold, row.name, 10.5, textW), textX, cardsTop + 20, {
      font: ctx.fonts.bold,
      size: 10.5,
      color: N_950,
    });
    text(page, truncate(ctx.fonts.regular, `${row.rollNo}  |  ${row.classLabel}`, 7.5, textW), textX, cardsTop + 32, {
      font: ctx.fonts.regular,
      size: 7.5,
      color: N_500,
    });
    const score = `${fmt(row.total)}${data.totalMax ? ` / ${fmt(data.totalMax)}` : ""}`;
    const scoreW = text(page, score, textX, cardsTop + 52, { font: ctx.fonts.bold, size: 14, color: BRAND_950 });
    if (row.percentage != null) {
      text(page, `${fmt(row.percentage)}%`, textX + scoreW + 8, cardsTop + 52, {
        font: ctx.fonts.bold,
        size: 9,
        color: GOLD_DARK,
      });
    }
  });
  return cardsTop + cardH + 16;
}

type Column = {
  head: string[];
  width: number;
  align: Align;
  cell: (row: ClassResultRow) => string;
  bold?: boolean;
};

function columnsFor(data: ClassResultPdfData, tableW: number, withSection: boolean) {
  const subjectW = data.subjects.length > 6 ? 40 : 48;
  const fixed: Column[] = [
    { head: ["RANK"], width: 38, align: "center", cell: (row) => (row.rank == null ? "-" : String(row.rank)), bold: true },
    { head: ["ROLL NO"], width: 66, align: "left", cell: (row) => row.rollNo },
  ];
  const trailing: Column[] = [
    { head: ["CLASS"], width: 40, align: "center", cell: (row) => row.classLabel },
    ...data.subjects.map(
      (subject, index): Column => ({
        head: [subject.label.toUpperCase(), subject.max != null ? `(${fmt(subject.max)})` : ""],
        width: subjectW,
        align: "center",
        cell: (row) => fmt(row.marks[index] ?? null),
      }),
    ),
    {
      head: ["TOTAL", data.totalMax != null ? `(${fmt(data.totalMax)})` : ""],
      width: 52,
      align: "center",
      cell: (row) => fmt(row.total),
      bold: true,
    },
    { head: ["PERCENTAGE"], width: 62, align: "center", cell: (row) => (row.percentage == null ? "-" : fmt(row.percentage)), bold: true },
    ...(withSection
      ? [{ head: ["SEC", "RANK"], width: 36, align: "center", cell: (row) => (row.sectionRank == null ? "-" : String(row.sectionRank)) } as Column]
      : []),
  ];
  const used = [...fixed, ...trailing].reduce((sum, column) => sum + column.width, 0);
  const name: Column = { head: ["STUDENT NAME"], width: tableW - used, align: "left", cell: (row) => row.name, bold: true };
  return [...fixed, name, ...trailing];
}

const minimumNameWidth = 130;

function drawTableHead(ctx: Ctx, page: PDFPage, columns: Column[], top: number) {
  const [W] = ctx.size;
  box(page, M, top, W - 2 * M, HEAD_H, 6, { fill: BRAND_900 });
  let x = M;
  for (const column of columns) {
    const lines = column.head.filter(Boolean);
    const pad = 7;
    const anchor = column.align === "center" ? x + column.width / 2 : x + pad;
    lines.forEach((line, index) => {
      const size = fitSize(ctx.fonts.bold, line, column.width - 6, 7, 5);
      const baseline = lines.length === 1 ? top + 18.5 : top + 13 + index * 9;
      text(page, line, anchor, baseline, {
        font: ctx.fonts.bold,
        size: index === 0 ? size : 6,
        color: index === 0 ? WHITE : BRAND_200,
        align: column.align === "center" ? "center" : "left",
        spacing: index === 0 ? 0.5 : 0,
      });
    });
    x += column.width;
  }
  return top + HEAD_H;
}

function drawRow(ctx: Ctx, page: PDFPage, columns: Column[], row: ClassResultRow, top: number, striped: boolean) {
  const [W] = ctx.size;
  const podium = row.rank != null && row.rank <= 3;
  if (podium) {
    page.drawRectangle({ x: M, y: page.getHeight() - top - ROW_H, width: W - 2 * M, height: ROW_H, color: MEDAL_TINTS[row.rank! - 1]! });
  } else if (striped) {
    page.drawRectangle({ x: M, y: page.getHeight() - top - ROW_H, width: W - 2 * M, height: ROW_H, color: BRAND_50 });
  }
  hline(page, M, W - M, top + ROW_H, N_200, 0.4);

  let x = M;
  const baseline = top + ROW_H / 2 + 3.2;
  columns.forEach((column, index) => {
    if (index === 0 && podium) {
      medal(ctx, page, x + column.width / 2, top + ROW_H / 2, 7, row.rank!);
    } else {
      const font = column.bold ? ctx.fonts.bold : ctx.fonts.regular;
      const size = 8.5;
      const value = truncate(font, column.cell(row), size, column.width - 10);
      text(page, value, column.align === "center" ? x + column.width / 2 : x + 7, baseline, {
        font,
        size,
        color: column.bold ? N_950 : N_700,
        align: column.align === "center" ? "center" : "left",
      });
    }
    x += column.width;
  });
  return top + ROW_H;
}

/** Blank line for the principal to sign by hand. */
function drawSignature(ctx: Ctx, page: PDFPage, top: number) {
  const [W] = ctx.size;
  const right = W - M;
  hline(page, right - 150, right, top + 46, N_400, 0.6);
  text(page, "Principal", right - 75, top + 58, { font: ctx.fonts.bold, size: 8, color: N_700, align: "center" });
  text(page, "Signature & seal", right - 75, top + 68, { font: ctx.fonts.regular, size: 7.5, color: N_500, align: "center" });
}

function drawFooters(ctx: Ctx, pages: PDFPage[]) {
  const [W] = ctx.size;
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  pages.forEach((page, index) => {
    hline(page, M, W - M, page.getHeight() - 30, BRAND_200, 0.6);
    text(page, `Prepared by Vitaran Learning  |  ${date}`, M, page.getHeight() - 18, {
      font: ctx.fonts.regular,
      size: 7.5,
      color: N_500,
    });
    text(page, `Page ${index + 1} of ${pages.length}`, W - M, page.getHeight() - 18, {
      font: ctx.fonts.regular,
      size: 7.5,
      color: N_500,
      align: "right",
    });
  });
}

/** One class's result for printing and pinning on a notice board, in rank order. */
export async function renderClassResultPdf(data: ClassResultPdfData, assets: ClassResultPdfAssets) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${data.schoolName} - Class ${data.classLevel} - Test ${data.testNumber} Results`);
  pdf.setAuthor("Vitaran Learning");
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const withSection = new Set(data.rows.map((row) => row.classLabel)).size > 1;
  const portraitCols = columnsFor(data, PORTRAIT[0] - 2 * M, withSection);
  const size = portraitCols[2]!.width >= minimumNameWidth ? PORTRAIT : LANDSCAPE;
  const ctx: Ctx = { pdf, fonts, titleFont: assets.titleFont, size };
  const columns = size === PORTRAIT ? portraitCols : columnsFor(data, LANDSCAPE[0] - 2 * M, withSection);
  const [logoVitaran, logoSchool] = await Promise.all([
    embedLogo(pdf, assets.vitaran),
    embedLogo(pdf, assets.school),
  ]);

  const pages: PDFPage[] = [];
  const addPage = () => {
    const page = pdf.addPage(size);
    pages.push(page);
    return page;
  };
  const limit = size[1] - FOOTER;

  let page = addPage();
  let y = drawHeader(ctx, page, data, { vitaran: logoVitaran, school: logoSchool });
  y = drawToppers(ctx, page, data, y);
  y = drawTableHead(ctx, page, columns, y);
  data.rows.forEach((row, index) => {
    if (y + ROW_H > limit) {
      page = addPage();
      y = drawTableHead(ctx, page, columns, drawRunningHeader(ctx, page, data));
    }
    y = drawRow(ctx, page, columns, row, y, index % 2 === 1);
  });

  const signatureH = 76;
  if (y + 18 + signatureH > limit) {
    page = addPage();
    y = drawRunningHeader(ctx, page, data);
  }
  drawSignature(ctx, page, y + 18);
  drawFooters(ctx, pages);
  return Buffer.from(await pdf.save());
}
