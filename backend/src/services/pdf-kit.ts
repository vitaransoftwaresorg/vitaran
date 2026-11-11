import {
  setCharacterSpacing,
  rgb,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import sharp from "sharp";

/** A4 in points. */
export const W = 595.28;
export const H = 841.89;
export const M = 36;
export const CONTENT = W - M * 2;
export const FOOTER = 46;

export const hex = (value: string) => {
  const n = Number.parseInt(value.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** Same palette as the portal pages (brand + neutral). */
export const BRAND_950 = hex("#0a0c2e");
export const BRAND_900 = hex("#10133f");
export const BRAND_800 = hex("#191c5f");
export const BRAND_700 = hex("#262a7a");
export const BRAND_200 = hex("#d6d7e5");
export const BRAND_100 = hex("#ebebf3");
export const BRAND_50 = hex("#f6f6fa");
export const N_950 = hex("#0a0a0a");
export const N_800 = hex("#262626");
export const N_700 = hex("#404040");
export const N_500 = hex("#737373");
export const N_400 = hex("#a3a3a3");
export const N_200 = hex("#e5e5e5");
export const N_100 = hex("#f5f5f5");
export const N_50 = hex("#fafafa");
export const AMBER_700 = hex("#b45309");
export const SKY_700 = hex("#0369a1");
export const WHITE = rgb(1, 1, 1);

export type Fonts = { regular: PDFFont; bold: PDFFont };

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("") || "S";

/** Standard PDF fonts only cover WinAnsi; anything else would throw while drawing. */
export function safeText(font: PDFFont, value: string) {
  const supported = new Set(font.getCharacterSet());
  return [...value.replace(/\u2212/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')]
    .map((char) => (char === "\n" || supported.has(char.codePointAt(0)!) ? char : "?"))
    .join("");
}

export function roundedRect(
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  height: number,
  radius: number,
  options: { fill?: RGB; border?: RGB; borderWidth?: number; opacity?: number },
) {
  const r = Math.min(radius, width / 2, height / 2);
  const path =
    `M ${r} 0 H ${width - r} Q ${width} 0 ${width} ${r} V ${height - r} Q ${width} ${height} ${width - r} ${height} ` +
    `H ${r} Q 0 ${height} 0 ${height - r} V ${r} Q 0 0 ${r} 0 Z`;
  page.drawSvgPath(path, {
    x,
    y: H - top,
    color: options.fill,
    borderColor: options.border,
    borderWidth: options.border ? (options.borderWidth ?? 0.75) : 0,
    opacity: options.opacity,
  });
}

export type TextOptions = {
  font: PDFFont;
  size: number;
  color?: RGB;
  align?: "left" | "center" | "right";
  spacing?: number;
};

/** `top` is the text baseline measured from the top of the page. */
export function drawText(page: PDFPage, value: string, x: number, top: number, options: TextOptions) {
  const content = safeText(options.font, value);
  const spacing = options.spacing ?? 0;
  const width = options.font.widthOfTextAtSize(content, options.size) + spacing * Math.max(0, content.length - 1);
  const left = options.align === "center" ? x - width / 2 : options.align === "right" ? x - width : x;
  if (spacing) page.pushOperators(setCharacterSpacing(spacing));
  page.drawText(content, { x: left, y: H - top, font: options.font, size: options.size, color: options.color ?? N_950 });
  if (spacing) page.pushOperators(setCharacterSpacing(0));
  return width;
}

export function fitSize(font: PDFFont, value: string, maxWidth: number, size: number, min: number) {
  let next = size;
  while (next > min && font.widthOfTextAtSize(safeText(font, value), next) > maxWidth) next -= 0.5;
  return next;
}

/** Shortens `value` with an ellipsis until it fits. */
export function truncate(font: PDFFont, value: string, size: number, maxWidth: number) {
  let text = safeText(font, value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  while (text.length > 1 && font.widthOfTextAtSize(`${text}...`, size) > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}...`;
}

export function wrap(font: PDFFont, value: string, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of safeText(font, value).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function drawImageIn(
  page: PDFPage,
  image: PDFImage,
  x: number,
  top: number,
  boxW: number,
  boxH: number,
  opacity = 1,
) {
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: x + (boxW - width) / 2,
    y: H - top - boxH + (boxH - height) / 2,
    width,
    height,
    opacity,
  });
}

export async function embedLogo(pdf: PDFDocument, data: Buffer | null) {
  if (!data) return null;
  try {
    const png = await sharp(data, { density: 300 })
      .resize(600, 600, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return await pdf.embedPng(png);
  } catch {
    return null;
  }
}

/** Vitaran logo left, school crest right, school name centred; returns where content starts. */
export function drawLogoHeader(
  page: PDFPage,
  fonts: Fonts,
  logos: { vitaran: PDFImage | null; school: PDFImage | null },
  schoolName: string,
  subtitle: string,
) {
  if (logos.vitaran) drawImageIn(page, logos.vitaran, M, 22, 96, 42);
  const crestX = W - M - 52;
  if (logos.school) {
    drawImageIn(page, logos.school, crestX, 18, 52, 50);
  } else {
    page.drawCircle({ x: crestX + 26, y: H - 43, size: 22, color: BRAND_900 });
    drawText(page, initials(schoolName), crestX + 26, 48, { font: fonts.bold, size: 14, color: WHITE, align: "center" });
  }
  const nameWidth = 2 * (W / 2 - (M + 96 + 16));
  const nameSize = fitSize(fonts.bold, schoolName, nameWidth, 15, 10);
  drawText(page, schoolName, W / 2, 42, { font: fonts.bold, size: nameSize, color: BRAND_950, align: "center" });
  drawText(page, subtitle, W / 2, 57, { font: fonts.regular, size: 9, color: N_500, align: "center" });
  page.drawLine({ start: { x: M, y: H - 78 }, end: { x: W - M, y: H - 78 }, thickness: 0.75, color: BRAND_200 });
  return 94;
}

export function drawPageFooters(pages: PDFPage[], fonts: Fonts, label: string) {
  pages.forEach((sheet, index) => {
    sheet.drawLine({ start: { x: M, y: 32 }, end: { x: W - M, y: 32 }, thickness: 0.6, color: BRAND_200 });
    drawText(sheet, label, M, H - 20, { font: fonts.regular, size: 7.5, color: N_500 });
    drawText(sheet, `Page ${index + 1} of ${pages.length}`, W - M, H - 20, {
      font: fonts.regular,
      size: 7.5,
      color: N_500,
      align: "right",
    });
  });
}
