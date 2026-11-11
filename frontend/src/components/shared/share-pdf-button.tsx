"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

function fileNameFrom(disposition: string | null, fallback: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Fetched PDFs, so a tap can open the share sheet without waiting on the network. */
const loaded = new Map<string, File>();
const loading = new Map<string, Promise<File>>();

function loadPdf(href: string, fallbackName: string): Promise<File> {
  const done = loaded.get(href);
  if (done) return Promise.resolve(done);
  let pending = loading.get(href);
  if (!pending) {
    pending = fetch(href, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.text()) || "PDF not available");
        const blob = await response.blob();
        const name = fileNameFrom(response.headers.get("Content-Disposition"), fallbackName);
        const file = new File([blob], name, { type: blob.type || "application/pdf" });
        loaded.set(href, file);
        // Results and profiles change; don't hand out a stale file later in the session.
        setTimeout(() => loaded.delete(href), 5 * 60_000);
        return file;
      })
      .finally(() => loading.delete(href));
    loading.set(href, pending);
  }
  return pending;
}

/** Must run inside the tap (or a toast action tap): phones only open the share sheet for a fresh gesture. */
function openShareSheet(file: File, title: string) {
  if (!window.isSecureContext || !navigator.share) {
    saveFile(file);
    toast.message("Sharing needs the https site — the PDF was downloaded instead");
    return;
  }
  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    saveFile(file);
    toast.message("This browser can't share files, so the PDF was downloaded");
    return;
  }
  navigator.share({ files: [file], title }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      toast("PDF ready", { action: { label: "Share", onClick: () => openShareSheet(file, title) } });
      return;
    }
    toast.error("Could not share the PDF");
  });
}

/**
 * Shares the PDF file itself (WhatsApp, mail…) through the phone's share sheet.
 * `preload` fetches it up front so the first tap opens the sheet straight away.
 */
export function SharePdfButton({
  href,
  fileName,
  title,
  className,
  preload = false,
  children,
}: {
  href: string;
  fileName: string;
  title?: string;
  className?: string;
  preload?: boolean;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const shareTitle = title ?? fileName;

  useEffect(() => {
    if (preload) loadPdf(href, fileName).catch(() => undefined);
  }, [preload, href, fileName]);

  function warm() {
    loadPdf(href, fileName).catch(() => undefined);
  }

  function onClick() {
    const ready = loaded.get(href);
    if (ready) return openShareSheet(ready, shareTitle);
    setBusy(true);
    loadPdf(href, fileName)
      .then((file) => openShareSheet(file, shareTitle))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not load the PDF"))
      .finally(() => setBusy(false));
  }

  return (
    <button
      type="button"
      title={`Share ${shareTitle}`}
      aria-label={`Share ${shareTitle}`}
      disabled={busy}
      onPointerDown={warm}
      onPointerEnter={warm}
      onFocus={warm}
      onClick={onClick}
      className={className}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Share2 />}
      {children}
    </button>
  );
}
