"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { classLabel } from "@/utils/format";
import { solutionBookPartsFromHref } from "./solution-book-path";
import type { SolutionBook } from "./solution-books";

function apiSrc(href: string) {
  const parts = solutionBookPartsFromHref(href);
  if (!parts) return null;
  if (href.startsWith("/teacher-resources/")) {
    return `/api/teacher-resources/${parts.map(encodeURIComponent).join("/")}`;
  }
  return `/api/solution-books/${parts.map(encodeURIComponent).join("/")}`;
}

export function solutionBookViewHref(basePath: string, book: SolutionBook) {
  const parts = solutionBookPartsFromHref(book.href);
  if (!parts) return null;
  const root = basePath.replace(/\/$/, "");
  return `${root}/view/${parts.map(encodeURIComponent).join("/")}`;
}

export function solutionBookLabel(book: Pick<SolutionBook, "subject" | "grade" | "volume">) {
  return `${book.subject} · ${classLabel(book.grade)}${
    book.volume != null ? ` · Volume ${book.volume}` : ""
  }`;
}

/** Infer a short label from `/solution-books/.../subject/class-N.pdf` path parts. */
export function labelFromSolutionPath(parts: string[]) {
  const file = parts.at(-1) ?? "";
  const subjectRaw = parts.at(-2) ?? "";
  const subject = subjectRaw
    ? subjectRaw.charAt(0).toUpperCase() + subjectRaw.slice(1).toLowerCase()
    : "Resource";
  const gradeMatch = /class-(\d+)/i.exec(file);
  const grade = gradeMatch ? classLabel(Number(gradeMatch[1])) : file.replace(/\.pdf$/i, "");
  return `${subject} · ${grade}`;
}

type SolutionBookViewerPageProps = {
  /** Path under /solution-books, e.g. ["integrated","mathematics","class-6.pdf"] */
  pathParts: string[];
  backHref: string;
  title?: string;
};

/** Full-page, view-only PDF (canvas) — works on mobile, no browser PDF chrome / save / print. */
export function SolutionBookViewerPage({
  pathParts,
  backHref,
  title,
}: SolutionBookViewerPageProps) {
  const href = `/solution-books/${pathParts.join("/")}`;
  const src = apiSrc(href);
  const label = title ?? labelFromSolutionPath(pathParts);
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Loading…");
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-solution-book-print-block", "1");
    style.textContent = `
      @media print {
        html, body { display: none !important; }
      }
    `;
    document.head.appendChild(style);

    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const block =
        ((event.ctrlKey || event.metaKey) &&
          (key === "p" || key === "s" || key === "c" || key === "u" || key === "a")) ||
        key === "f12" ||
        (event.ctrlKey && event.shiftKey && (key === "i" || key === "j"));
      if (block) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onContext = (event: Event) => event.preventDefault();
    const onBeforePrint = (event: Event) => event.preventDefault();

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("contextmenu", onContext, true);
    window.addEventListener("beforeprint", onBeforePrint, true);
    return () => {
      style.remove();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("contextmenu", onContext, true);
      window.removeEventListener("beforeprint", onBeforePrint, true);
    };
  }, []);

  useEffect(() => {
    if (!src || !hostRef.current) return;
    const host = hostRef.current;
    host.replaceChildren();
    let cancelled = false;

    (async () => {
      try {
        setStatus("loading");
        setMessage("Loading…");
        const pdfjs = await import("pdfjs-dist");
        // Same-origin worker (copied to /public/pdfjs) — reliable on mobile Safari.
        pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker.min.mjs?v=${pdfjs.version}`;

        const pdf = await pdfjs.getDocument({
          url: src,
          withCredentials: true,
          // Don't attach a download filename in the browser's fetch layer.
          httpHeaders: { Accept: "application/pdf" },
        }).promise;
        if (cancelled) {
          await pdf.destroy();
          return;
        }

        setPageCount(pdf.numPages);
        const width = Math.min(host.clientWidth || window.innerWidth, 960);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) break;
          setMessage(`Loading page ${pageNumber} of ${pdf.numPages}…`);
          const page = await pdf.getPage(pageNumber);
          const base = page.getViewport({ scale: 1 });
          const scale = (width * Math.min(window.devicePixelRatio || 1, 2)) / base.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "mx-auto mb-3 w-full max-w-4xl rounded-lg bg-white shadow-sm";
          canvas.style.height = "auto";
          canvas.setAttribute("aria-label", `Page ${pageNumber}`);
          const context = canvas.getContext("2d");
          if (!context) continue;
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          if (cancelled) break;
          host.appendChild(canvas);
          if (pageNumber === 1) {
            setStatus("ready");
            setMessage("");
          }
        }

        await pdf.destroy();
        if (!cancelled) {
          setStatus("ready");
          setMessage("");
        }
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not open this resource.");
      }
    })();

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [src]);

  if (!src) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-100 p-6 text-center">
        <p className="text-sm text-neutral-600">Resource not found.</p>
        <Link href={backHref} className="text-sm font-semibold text-brand-800 hover:underline">
          Back to resources
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-neutral-200 print:hidden"
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-300 bg-brand-950 px-3 py-2.5 text-white sm:px-4">
        <Link
          href={backHref}
          className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="Back to resources"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{label}</p>
          <p className="truncate text-[11px] text-white/70">
            View only — save and print are disabled
            {pageCount > 0 ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      </header>

      <div className="relative flex-1 px-2 py-3 sm:px-4 sm:py-4">
        {status !== "ready" ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-600">
            {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
            <span>{message}</span>
            {status === "error" ? (
              <Link href={backHref} className="font-semibold text-brand-800 hover:underline">
                Go back
              </Link>
            ) : null}
          </div>
        ) : null}
        <div ref={hostRef} className="mx-auto max-w-4xl" />
      </div>
    </div>
  );
}
