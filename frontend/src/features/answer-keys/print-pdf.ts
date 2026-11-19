"use client";

/** Branded answer key PDF, streamed through the portal's own session. */
export const answerKeyPdfHref = (basePath: string, id: string, download = false) =>
  `${basePath}/${encodeURIComponent(id)}/pdf${download ? "?download=1" : ""}`;

function attachHiddenFrame() {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  // Must have real size — 0×0 iframes print blank in Chrome; keep it off-screen.
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(frame);
  return frame;
}

function cleanupFrame(frame: HTMLIFrameElement, url?: string) {
  window.setTimeout(() => {
    frame.remove();
    if (url) URL.revokeObjectURL(url);
  }, 60_000);
}

/** Content-Disposition filename, else the caller fallback. */
function fileNameFrom(disposition: string | null, fallback?: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // keep going
    }
  }
  const plain = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
  return plain || fallback || "document";
}

/** Chrome “Save as PDF” uses document.title and often appends .pdf itself. */
function printTitle(fileName: string) {
  return fileName.replace(/\.(pdf|jpe?g|png|webp)$/i, "") || "document";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Temporarily set the page title so Print → Save as PDF picks up a real name. */
function withPrintTitle(fileName: string, run: () => void) {
  const title = printTitle(fileName);
  const previous = document.title;
  document.title = title;
  const restore = () => {
    if (document.title === title) document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  try {
    run();
  } finally {
    // afterprint may not fire for iframe/PDF prints — restore after the dialog settles.
    window.setTimeout(restore, 2_000);
  }
}

/** Opens the browser print dialog for a same-origin PDF — stays on this page. */
export function printPdf(href: string, onReady?: () => void, fileName?: string) {
  void (async () => {
    const frame = attachHiddenFrame();
    let objectUrl: string | undefined;
    try {
      const response = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the PDF");
      const name = fileNameFrom(response.headers.get("Content-Disposition"), fileName);
      const blob = await response.blob();
      // Named File helps some browsers; title is what Save as PDF usually uses.
      const file = new File([blob], name, { type: blob.type || "application/pdf" });
      objectUrl = URL.createObjectURL(file);
      let printed = false;
      const done = () => {
        if (printed) return;
        printed = true;
        onReady?.();
        withPrintTitle(name, () => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } catch {
            // ignore — dialog may still open
          }
        });
        cleanupFrame(frame, objectUrl);
      };
      frame.onload = () => window.setTimeout(done, 300);
      frame.src = objectUrl;
      // Some browsers never fire load for PDF embeds — fallback print attempt.
      window.setTimeout(done, 2000);
    } catch {
      frame.remove();
      onReady?.();
    }
  })();
}

/**
 * Print a single A4 JPEG (e.g. one rank card) via the print dialog only — no new tab.
 */
export function printImage(href: string, onReady?: () => void, fileName?: string) {
  void (async () => {
    const frame = attachHiddenFrame();
    let objectUrl: string | undefined;
    try {
      const response = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the image");
      const name = fileNameFrom(response.headers.get("Content-Disposition"), fileName);
      const title = printTitle(name);
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      const doc = frame.contentDocument;
      if (!doc) throw new Error("No frame document");
      doc.open();
      doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      img {
        display: block;
        width: 210mm;
        height: 297mm;
        object-fit: contain;
        page-break-after: avoid;
        page-break-inside: avoid;
      }
    </style>
  </head>
  <body>
    <img src="${objectUrl}" alt="" />
  </body>
</html>`);
      doc.close();
      const img = doc.querySelector("img");
      const go = () => {
        onReady?.();
        withPrintTitle(name, () => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } catch {
            // ignore
          }
        });
        cleanupFrame(frame, objectUrl);
      };
      if (img?.complete) window.setTimeout(go, 150);
      else img?.addEventListener("load", () => window.setTimeout(go, 150));
    } catch {
      frame.remove();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      onReady?.();
    }
  })();
}
