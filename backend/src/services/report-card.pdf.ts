import { PDFDocument } from "pdf-lib";

/** Concatenate several PDF buffers into one file (class packs). */
export async function mergePdfBuffers(parts: Buffer[], title: string) {
  const out = await PDFDocument.create();
  out.setAuthor("Vitaran Learning");
  out.setTitle(title);
  for (const part of parts) {
    const doc = await PDFDocument.load(part);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    for (const page of pages) out.addPage(page);
  }
  return Buffer.from(await out.save());
}
