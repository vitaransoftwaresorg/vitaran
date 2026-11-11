"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ScanPortal } from "@/services/scans";
import { previewScanAction } from "./actions";
import { getScanBatch, setScanBatch, type PdfFailure } from "./batch-store";
import { asJpegFile } from "./camera";
import { fetchFailedPageImage, resolvePdfFailure } from "./pdf-batch";

/** Failed PDF pages: look at what the reader saw, then photograph the paper sheet again. */
export function FailedPages({
  portal,
  testId,
  failures,
  disabled,
}: {
  portal: ScanPortal;
  testId: string;
  failures: PdfFailure[];
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<number | null>(null);
  const [rescanning, setRescanning] = useState<number | null>(null);
  const [viewing, setViewing] = useState<PdfFailure | null>(null);

  function pickPhoto(page: number) {
    targetRef.current = page;
    inputRef.current?.click();
  }

  async function rescan(file: File) {
    const page = targetRef.current;
    if (page == null) return;
    setRescanning(page);
    try {
      const form = new FormData();
      form.append("file", await asJpegFile(file));
      form.append("testId", testId);
      const result = await previewScanAction(portal, form);
      if (!result.ok) {
        toast.error(`Page ${page}: ${result.message}`);
        return;
      }
      const reg = result.result.scan.student.rollNo;
      if (getScanBatch().some((item) => item.scan.student.rollNo === reg)) {
        toast.warning(`Page ${page}: Reg ${reg} is already in this list.`);
        resolvePdfFailure(page);
        return;
      }
      setScanBatch([...getScanBatch(), result.result]);
      resolvePdfFailure(page);
      setViewing((current) => (current?.page === page ? null : current));
      toast.success(`Page ${page} read · ${result.result.scan.student.name} added to the list`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this sheet.");
    } finally {
      setRescanning(null);
    }
  }

  return (
    <details className="text-xs text-red-700" open>
      <summary className="cursor-pointer font-medium">
        Pages that could not be read ({failures.length}) — view them or scan the paper sheet again
      </summary>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void rescan(file);
        }}
      />
      <ul className="mt-2 max-h-64 divide-y divide-red-100 overflow-y-auto rounded-lg border border-red-100 bg-red-50/40">
        {failures.map((failure) => (
          <li key={failure.page} className="flex items-center gap-2 px-3 py-2">
            <p className="min-w-0 flex-1">
              <span className="font-semibold">Page {failure.page}</span>
              <span className="text-red-600"> · {failure.message}</span>
            </p>
            {failure.hasImage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                onClick={() => setViewing(failure)}
              >
                <Eye className="size-3.5" />
                View
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs"
              disabled={disabled || rescanning != null}
              onClick={() => pickPhoto(failure.page)}
            >
              {rescanning === failure.page ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Camera className="size-3.5" />
              )}
              {rescanning === failure.page ? "Reading…" : "Scan again"}
            </Button>
          </li>
        ))}
      </ul>

      <Sheet open={viewing != null} onOpenChange={(open) => (open ? null : setViewing(null))}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Page {viewing?.page}</SheetTitle>
            <p className="text-sm text-red-700">{viewing?.message}</p>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {viewing ? <PageImage key={viewing.page} page={viewing.page} /> : null}
          </div>
          {viewing ? (
            <div className="border-t border-neutral-100 p-4">
              <Button
                type="button"
                className="w-full gap-1.5"
                disabled={disabled || rescanning != null}
                onClick={() => pickPhoto(viewing.page)}
              >
                {rescanning === viewing.page ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                {rescanning === viewing.page ? "Reading…" : "Scan this sheet again"}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </details>
  );
}

function PageImage({ page }: { page: number }) {
  const [state, setState] = useState<{ url?: string; error?: string }>({});

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    fetchFailedPageImage(page)
      .then((next) => {
        url = next;
        if (cancelled) URL.revokeObjectURL(next);
        else setState({ url: next });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ error: error instanceof Error ? error.message : "Could not load this page." });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [page]);

  if (state.error) return <p className="py-10 text-center text-sm text-red-700">{state.error}</p>;
  if (!state.url) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-brand-700" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- blob URL from the scan API
  return <img src={state.url} alt={`PDF page ${page}`} className="w-full rounded-lg border border-neutral-200" />;
}
