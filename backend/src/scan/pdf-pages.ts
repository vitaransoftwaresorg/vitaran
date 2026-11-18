import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";

export const MAX_PDF_PAGES = 500;
/** Width for PDF batch pages — sharp enough for bubbles, lean enough for ~500-page uploads. */
const RENDER_WIDTH = 1600;
const FAILED_DIR = path.join(tmpdir(), "vitaran-omr", "failed");

export type OmrPdfPage = {
  page: number;
  fileName: string;
  /** JPEG bytes for one student sheet. */
  jpeg: Buffer;
};

/** Some scanner / email exports put junk or a BOM before the real PDF header. */
function normalizePdfBytes(raw: Buffer): Buffer {
  if (raw.length >= 5 && raw.subarray(0, 5).toString("utf8") === "%PDF-") return raw;
  // UTF-8 BOM
  if (
    raw.length >= 8 &&
    raw[0] === 0xef &&
    raw[1] === 0xbb &&
    raw[2] === 0xbf &&
    raw.subarray(3, 8).toString("utf8") === "%PDF-"
  ) {
    return raw.subarray(3);
  }
  const marker = Buffer.from("%PDF-");
  const idx = raw.indexOf(marker);
  if (idx > 0 && idx < 4096) return raw.subarray(idx);
  throw new AppError(400, "Upload a PDF of OMR sheets");
}

async function loadPdfBytes(pdf: Buffer | string): Promise<Buffer> {
  const bytes = typeof pdf === "string" ? await readFile(pdf) : pdf;
  if (bytes.length < 5) throw new AppError(400, "Upload a PDF of OMR sheets");
  return normalizePdfBytes(bytes);
}

/** Standalone copy so the PDF.js worker can transfer it without detaching our Buffer. */
function pdfData(bytes: Buffer): Uint8Array {
  return Uint8Array.from(bytes);
}

function createParser(bytes: Buffer) {
  return new PDFParse({
    data: pdfData(bytes),
    // Empty password covers "restricted" scanner PDFs that still open in Preview.
    password: "",
    CanvasFactory,
  });
}

function pdfErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (/password/i.test(name) || /password/i.test(message)) {
    return "This PDF is password-protected. Remove the password and upload again.";
  }
  if (/InvalidPDF|MissingPDF|FormatError|UnexpectedResponse/i.test(name) || /invalid pdf/i.test(message)) {
    return "Could not read this PDF. Export pages as images or try another file.";
  }
  return "Could not read this PDF. Export pages as images or try another file.";
}

async function keepFailedPdf(bytes: Buffer, reason: unknown) {
  try {
    await mkdir(FAILED_DIR, { recursive: true });
    const filePath = path.join(FAILED_DIR, `${Date.now()}-${bytes.length}.pdf`);
    await writeFile(filePath, bytes);
    logger.warn(
      {
        err: reason,
        filePath,
        bytes: bytes.length,
        magic: bytes.subarray(0, 8).toString("utf8"),
      },
      "OMR PDF parse failed — kept a copy for inspection",
    );
  } catch (error) {
    logger.warn({ err: error }, "Could not keep failed OMR PDF");
  }
}

async function pageCountWithPdfLib(bytes: Buffer): Promise<number | null> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    return null;
  }
}

/** Fast page count — no rasterization. */
export async function omrPdfPageCount(pdf: Buffer | string): Promise<number> {
  const bytes = await loadPdfBytes(pdf);
  const parser = createParser(bytes);
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
    const fallback = await pageCountWithPdfLib(bytes);
    await keepFailedPdf(bytes, error);
    logger.warn(
      {
        err: error,
        bytes: bytes.length,
        pdfLibPages: fallback,
      },
      "OMR PDF getInfo failed",
    );
    throw new AppError(422, pdfErrorMessage(error));
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function toJpeg(raw: Uint8Array | Buffer): Promise<Buffer> {
  return sharp(Buffer.from(raw))
    .rotate()
    .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/** Scanned OMR PDFs are often one embedded image per page — use that when screenshot fails. */
async function renderEmbeddedImage(parser: PDFParse, pageNumber: number): Promise<Buffer | null> {
  try {
    const result = await parser.getImage({
      partial: [pageNumber],
      imageThreshold: 0,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const images = result.pages?.[0]?.images ?? [];
    let best: { data: Uint8Array | Buffer; area: number } | null = null;
    for (const image of images) {
      const data = image.data;
      if (!data || !(data instanceof Uint8Array || Buffer.isBuffer(data))) continue;
      const area = (image.width ?? 0) * (image.height ?? 0);
      if (!best || area > best.area) best = { data, area };
    }
    if (!best || best.area < 10_000) return null;
    return toJpeg(best.data);
  } catch {
    return null;
  }
}

/**
 * Parses the PDF once and renders pages on demand; close it when done.
 * Accepts a Buffer or an on-disk path (preferred for large class PDFs).
 */
export async function openOmrPdf(pdf: Buffer | string, originalName = "omr.pdf") {
  const bytes = await loadPdfBytes(pdf);
  const base = originalName.replace(/\.pdf$/i, "") || "omr";
  const parser = createParser(bytes);

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
      if (raw && (raw instanceof Uint8Array || Buffer.isBuffer(raw))) {
        return {
          page: page.pageNumber ?? pageNumber,
          fileName: `${base}-p${pageNumber}.jpg`,
          jpeg: await toJpeg(raw),
        };
      }
    } catch (error) {
      logger.warn({ err: error, page: pageNumber }, "PDF screenshot failed; trying embedded image");
    }

    const embedded = await renderEmbeddedImage(parser, pageNumber);
    if (embedded) {
      return {
        page: pageNumber,
        fileName: `${base}-p${pageNumber}.jpg`,
        jpeg: embedded,
      };
    }

    throw new AppError(
      422,
      `Could not read PDF page ${pageNumber}. Try exporting that page as an image.`,
    );
  }

  return {
    render,
    close: () => parser.destroy().catch(() => undefined),
  };
}

/** Render a single PDF page to a JPEG OMR sheet. */
export async function omrPageFromPdf(
  pdf: Buffer | string,
  pageNumber: number,
  originalName = "omr.pdf",
): Promise<OmrPdfPage> {
  const reader = await openOmrPdf(pdf, originalName);
  try {
    return await reader.render(pageNumber);
  } finally {
    await reader.close();
  }
}
