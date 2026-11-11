"use client";

/** Branded answer key PDF, streamed through the portal's own session. */
export const answerKeyPdfHref = (basePath: string, id: string, download = false) =>
  `${basePath}/${encodeURIComponent(id)}/pdf${download ? "?download=1" : ""}`;

/** Opens the browser print dialog for a same-origin PDF without leaving the page. */
export function printPdf(href: string, onReady?: () => void) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.src = href;
  frame.onload = () => {
    onReady?.();
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(href, "_blank", "noopener");
    }
    window.setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}
