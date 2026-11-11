import express, { type Response } from "express";
import { z } from "zod";
import { AppError } from "./app-error.js";

export const PDF_MAX_BYTES = 10 * 1024 * 1024;

const PDF_SIGNATURE = Buffer.from("%PDF-");

/** Uploads send the PDF as the raw request body and their metadata in the query string. */
export const readPdfBody = express.raw({ type: "application/pdf", limit: PDF_MAX_BYTES });

export const pdfFileNameSchema = z.string().trim().min(1).max(255);

/** Express leaves the body empty when no PDF was sent. */
export function readPdf(body: unknown): Buffer | null {
  if (!Buffer.isBuffer(body) || body.length === 0) return null;
  if (!body.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    throw new AppError(400, "Only PDF files can be uploaded", [
      { path: ["file"], message: "Only PDF files can be uploaded" },
    ]);
  }
  return body;
}

export function requirePdf(body: unknown): Buffer {
  const pdf = readPdf(body);
  if (!pdf) {
    throw new AppError(400, "Attach a PDF file", [{ path: ["file"], message: "Attach a PDF file" }]);
  }
  return pdf;
}

/** Column values for a newly uploaded PDF. */
export function toPdfData(pdf: Buffer, fileName: string) {
  return { fileName, fileSize: pdf.length, data: Buffer.from(pdf) };
}

export function sendPdf(res: Response, { fileName, data }: { fileName: string; data: Uint8Array }) {
  res
    .type("application/pdf")
    .set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    .send(Buffer.from(data));
}
