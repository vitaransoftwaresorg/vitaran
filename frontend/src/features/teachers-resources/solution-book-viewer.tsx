"use client";

import { useEffect, useId, useState } from "react";
import { Eye, Loader2, X } from "lucide-react";
import { classLabel } from "@/utils/format";
import { solutionBookPartsFromHref } from "./solution-book-path";
import type { SolutionBook } from "./solution-books";

function viewerSrc(href: string) {
  const parts = solutionBookPartsFromHref(href);
  if (!parts) return null;
  // Hide Chrome/Edge PDF chrome (download / print) where the viewer supports it.
  return `/api/solution-books/${parts.map(encodeURIComponent).join("/")}#toolbar=0&navpanes=0&scrollbar=1`;
}

type SolutionBookViewerProps = {
  book: SolutionBook;
  onClose: () => void;
};

/** Full-screen view-only PDF shell — no download/print UI, blocks copy/print shortcuts. */
export function SolutionBookViewer({ book, onClose }: SolutionBookViewerProps) {
  const titleId = useId();
  const src = viewerSrc(book.href);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const style = document.createElement("style");
    style.setAttribute("data-solution-book-print-block", "1");
    style.textContent = "@media print { body { display: none !important; } }";
    document.head.appendChild(style);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      const key = event.key.toLowerCase();
      const block =
        (event.ctrlKey || event.metaKey) &&
        (key === "p" || key === "s" || key === "c" || key === "u" || key === "a");
      if (block || key === "f12" || (event.ctrlKey && event.shiftKey && key === "i")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onContext = (event: Event) => {
      event.preventDefault();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("contextmenu", onContext, true);
    return () => {
      document.body.style.overflow = previous;
      style.remove();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("contextmenu", onContext, true);
    };
  }, [onClose]);

  if (!src) return null;

  const label = `${book.subject} · ${classLabel(book.grade)}${
    book.volume != null ? ` · Volume ${book.volume}` : ""
  }`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] flex flex-col bg-brand-950/70 backdrop-blur-sm print:hidden"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-6xl flex-col bg-white shadow-2xl sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        onCopy={(event) => event.preventDefault()}
        onCut={(event) => event.preventDefault()}
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
      >
        <header className="flex items-center gap-3 border-b border-brand-100 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-800 text-white">
            <Eye className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p id={titleId} className="truncate text-sm font-semibold text-brand-950">
              {label}
            </p>
            <p className="text-xs text-neutral-500">
              View only — download, print and copy are disabled
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close viewer"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 bg-neutral-100">
          {!ready ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-neutral-600">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : null}
          <iframe
            title={label}
            src={src}
            className="h-full w-full border-0"
            onLoad={() => setReady(true)}
          />
        </div>
      </div>
    </div>
  );
}
