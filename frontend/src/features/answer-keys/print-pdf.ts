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

/** Opens the browser print dialog for a same-origin PDF — stays on this page. */
export function printPdf(href: string, onReady?: () => void) {
  void (async () => {
    const frame = attachHiddenFrame();
    let objectUrl: string | undefined;
    try {
      const response = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the PDF");
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      let printed = false;
      const done = () => {
        if (printed) return;
        printed = true;
        onReady?.();
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          // ignore — dialog may still open
        }
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
export function printImage(href: string, onReady?: () => void) {
  void (async () => {
    const frame = attachHiddenFrame();
    let objectUrl: string | undefined;
    try {
      const response = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the image");
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      const doc = frame.contentDocument;
      if (!doc) throw new Error("No frame document");
      doc.open();
      doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Print</title>
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
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          // ignore
        }
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
