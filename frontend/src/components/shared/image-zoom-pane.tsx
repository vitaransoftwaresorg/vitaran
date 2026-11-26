"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_ZOOM = 0.75;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value / ZOOM_STEP) * ZOOM_STEP));
}

/** ± / % / rotate / reset toolbar + wheel zoom + drag to pan around a sheet or card image. */
export function ImageZoomPane({
  children,
  className,
  toolbarLeft,
  resetKey,
  align = "center",
}: {
  children: ReactNode;
  className?: string;
  /** Label or extra controls on the left of the zoom bar. */
  toolbarLeft?: ReactNode;
  /** Changing this resets zoom/rotation to the default (e.g. Evaluated ↔ Original). */
  resetKey?: string | number;
  /**
   * Vertical alignment of the sheet in the pane.
   * Use `start` for OMR so the student name at the top is visible without panning.
   */
  align?: "center" | "start";
}) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [prevKey, setPrevKey] = useState(resetKey);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setZoom(DEFAULT_ZOOM);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }

  const atDefault =
    zoom === DEFAULT_ZOOM && rotation === 0 && pan.x === 0 && pan.y === 0;

  function setZoomAndMaybeResetPan(next: number) {
    const value = clampZoom(next);
    setZoom(value);
    if (value === DEFAULT_ZOOM) setPan({ x: 0, y: 0 });
  }

  function rotateClockwise() {
    setRotation((current) => (current + 90) % 360);
    setPan({ x: 0, y: 0 });
  }

  function resetView() {
    setZoom(DEFAULT_ZOOM);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    // Let buttons / links inside the pane work normally.
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const sideways = rotation % 180 !== 0;

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
            onClick={() => setZoomAndMaybeResetPan(zoom - ZOOM_STEP)}
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
            onClick={() => setZoomAndMaybeResetPan(zoom + ZOOM_STEP)}
            className="inline-flex size-8 items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            title="Rotate 90°"
            aria-label="Rotate 90 degrees"
            onClick={rotateClockwise}
            className="inline-flex size-8 items-center justify-center border-l border-neutral-200 text-neutral-700 hover:bg-neutral-50"
          >
            <RotateCw className="size-3.5" />
          </button>
          <button
            type="button"
            title={`Reset to ${Math.round(DEFAULT_ZOOM * 100)}%`}
            aria-label={`Reset to ${Math.round(DEFAULT_ZOOM * 100)}%`}
            disabled={atDefault}
            onClick={resetView}
            className="inline-flex size-8 items-center justify-center border-l border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden p-2 touch-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onWheel={(event) => {
          if (!(event.ctrlKey || event.metaKey)) {
            // Trackpad / mouse wheel pans when zoomed or rotated.
            if (zoom === DEFAULT_ZOOM && rotation === 0) return;
            event.preventDefault();
            setPan((current) => ({
              x: current.x - event.deltaX,
              y: current.y - event.deltaY,
            }));
            return;
          }
          event.preventDefault();
          const direction = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
          setZoomAndMaybeResetPan(zoom + direction);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className={cn(
            "flex h-full w-full justify-center",
            align === "start" ? "items-start" : "items-center",
          )}
        >
          <div
            className="will-change-transform"
            style={{
              width: sideways ? `${zoom * 100 * (3 / 4)}%` : `${zoom * 100}%`,
              maxWidth: "100%",
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg)`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
