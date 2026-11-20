"use client";

import { toast } from "sonner";

export { emptyReportMessage } from "./report-messages";

function fileNameFrom(disposition: string | null, fallback: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // keep going
    }
  }
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

/**
 * Fetch a report PDF and save it. On empty/missing results, show a toast instead
 * of downloading a broken file.
 */
export async function downloadReportPdf(href: string, fallbackName: string) {
  const response = await fetch(href, { cache: "no-store" });
  if (!response.ok) {
    const message = ((await response.text()) || "").trim() || "No report cards records yet";
    toast.error(message);
    return false;
  }
  const blob = await response.blob();
  const name = fileNameFrom(response.headers.get("Content-Disposition"), fallbackName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}
