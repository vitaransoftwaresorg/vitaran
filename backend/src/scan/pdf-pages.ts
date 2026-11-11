import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import { AppError } from "../utils/app-error.js";

export const MAX_PDF_PAGES = 300;
/** Higher width keeps bubble ink sharp enough for layoutOmrBubbles. */
const RENDER_WIDTH = 2200;

export type OmrPdfPage = {
  page: number;
  fileName: string;
  /** JPEG bytes for one student sheet. */
  jpeg: Buffer;
};

function assertPdf(pdf: Buffer) {
  if (pdf.length < 5 || pdf.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new AppError(400, "Upload a PDF of OMR sheets");
  }
}

/** Fast page count — no rasterization. */
export async function omrPdfPageCount(pdf: Buffer): Promise<number> {
  assertPdf(pdf);
  const parser = new PDFParse({ data: pdf });
  try {
    const info = await parser.getInfo();
    const total = info.total ?? 0;
    if (total < 1) throw new AppError(422, "This PDF has no pages");
    if (total > MAX_PDF_PAGES) {
      throw new AppError(400, `PDF has too many pages (max ${MAX_PDF_PAGES})`);
    }
    return total;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(422, "Could not read this PDF. Export pages as images or try another file.");
  } finally {
    await parser.destroy();
  }
}

/** Parses the PDF once and renders pages on demand; close it when done. */
export function openOmrPdf(pdf: Buffer, originalName = "omr.pdf") {
  assertPdf(pdf);
  const base = originalName.replace(/\.pdf$/i, "") || "omr";
  const parser = new PDFParse({ data: pdf });

  async function render(pageNumber: number): Promise<OmrPdfPage> {
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new AppError(400, "Invalid PDF page");
    }
    try {
      const shot = await parser.getScreenshot({
        partial: [pageNumber],
        desiredWidth: RENDER_WIDTH,
        imageBuffer: true,
        imageDataUrl: false,
      });
      const page = shot.pages?.[0];
      const raw = page?.data;
      if (!raw || !(raw instanceof Uint8Array || Buffer.isBuffer(raw))) {
        throw new AppError(422, `Could not render PDF page ${pageNumber}`);
      }
      const jpeg = await sharp(Buffer.from(raw))
        .rotate()
        .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
        .toBuffer();
      return {
        page: page.pageNumber ?? pageNumber,
        fileName: `${base}-p${pageNumber}.jpg`,
        jpeg,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(422, `Could not read PDF page ${pageNumber}. Try exporting that page as an image.`);
    }
  }

  return { render, close: () => parser.destroy() };
}

/** Render a single PDF page to a JPEG OMR sheet. */
export async function omrPageFromPdf(
  pdf: Buffer,
  pageNumber: number,
  originalName = "omr.pdf",
): Promise<OmrPdfPage> {
  const reader = openOmrPdf(pdf, originalName);
  try {
    return await reader.render(pageNumber);
  } finally {
    await reader.close();
  }
}
