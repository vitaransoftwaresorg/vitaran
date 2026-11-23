"use client";

import { useState, type ReactNode } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_ZOOM = 1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value / ZOOM_STEP) * ZOOM_STEP));
}

/** ± / % / reset toolbar + ctrl/meta+wheel zoom around a sheet or card image. */
export function ImageZoomPane({
  children,
  className,
  toolbarLeft,
  resetKey,
}: {
  children: ReactNode;
  className?: string;
  /** Label or extra controls on the left of the zoom bar. */
  toolbarLeft?: ReactNode;
  /** Changing this resets zoom to 100% (e.g. Evaluated ↔ Original). */
  resetKey?: string | number;
}) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [prevKey, setPrevKey] = useState(resetKey);
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setZoom(DEFAULT_ZOOM);
  }

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-2 py-1.5">
        <div className="min-w-0 px-1 text-xs font-semibold text-neutral-600">{toolbarLeft}</div>
        <div className="flex items-center rounded-lg border border-neutral-200">
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN}
            onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
            className="inline-flex size-8 items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-12 px-1 text-center text-xs font-semibold tabular-nums text-neutral-700">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
            className="inline-flex size-8 items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            title="Reset to 100%"
            aria-label="Reset to 100%"
            disabled={zoom === DEFAULT_ZOOM}
            onClick={() => setZoom(DEFAULT_ZOOM)}
            className="inline-flex size-8 items-center justify-center border-l border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto p-2"
        onWheel={(event) => {
          if (!(event.ctrlKey || event.metaKey)) return;
          event.preventDefault();
          const direction = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
          setZoom((value) => clampZoom(value + direction));
        }}
      >
        <div
          className="mx-auto origin-top transition-[width] duration-150"
          style={{ width: `${zoom * 100}%` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
