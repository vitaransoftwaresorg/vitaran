"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Loader2, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** On-screen crop square, in CSS pixels. */
const VIEW = 280;
/** Saved logo size: square PNG, transparent where the image doesn't reach. */
const OUT = 512;
const MAX_ZOOM = 4;

type Frame = { scale: number; x: number; y: number };

/** Keeps the image centre inside the square so the logo can't be dragged out of view. */
function clampFrame(frame: Frame, width: number, height: number): Frame {
  const halfW = (width * frame.scale) / 2;
  const halfH = (height * frame.scale) / 2;
  return {
    scale: frame.scale,
    x: Math.min(VIEW - halfW, Math.max(-halfW, frame.x)),
    y: Math.min(VIEW - halfH, Math.max(-halfH, frame.y)),
  };
}

/**
 * Square crop for a school logo: drag to move, zoom with the slider. Starts with the whole
 * image fitted in the square, so wide logos keep their full width unless zoomed in.
 */
export function LogoCropper({
  src,
  onCancel,
  onCrop,
}: {
  src: string | null;
  onCancel: () => void;
  onCrop: (file: File) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<Frame>({ scale: 1, x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; frame: Frame } | null>(null);

  useEffect(() => {
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const fit = Math.min(VIEW / img.naturalWidth, VIEW / img.naturalHeight);
      setImage(img);
      setFrame({
        scale: fit,
        x: (VIEW - img.naturalWidth * fit) / 2,
        y: (VIEW - img.naturalHeight * fit) / 2,
      });
    };
    img.src = src;
    return () => {
      alive = false;
      setImage(null);
    };
  }, [src]);

  const fit = image ? Math.min(VIEW / image.naturalWidth, VIEW / image.naturalHeight) : 1;
  const cover = image ? Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight) : 1;
  const minScale = fit;
  const maxScale = cover * MAX_ZOOM;

  function zoomTo(scale: number) {
    if (!image) return;
    const next = Math.min(maxScale, Math.max(minScale, scale));
    setFrame((current) => {
      const ratio = next / current.scale;
      const centred = {
        scale: next,
        x: VIEW / 2 - (VIEW / 2 - current.x) * ratio,
        y: VIEW / 2 - (VIEW / 2 - current.y) * ratio,
      };
      return clampFrame(centred, image.naturalWidth, image.naturalHeight);
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, frame };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || !image) return;
    setFrame(
      clampFrame(
        {
          scale: start.frame.scale,
          x: start.frame.x + event.clientX - start.x,
          y: start.frame.y + event.clientY - start.y,
        },
        image.naturalWidth,
        image.naturalHeight,
      ),
    );
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }

  async function save() {
    if (!image) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const k = OUT / VIEW;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        image,
        frame.x * k,
        frame.y * k,
        image.naturalWidth * frame.scale * k,
        image.naturalHeight * frame.scale * k,
      );
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) onCrop(new File([blob], "logo.png", { type: "image/png" }));
    } finally {
      setSaving(false);
    }
  }

  const step = (maxScale - minScale) / 10 || 0.1;

  return (
    <Dialog.Root open={Boolean(src)} onOpenChange={(open) => (open ? null : onCancel())}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/70 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[60] w-[min(94vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 shadow-2xl outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Dialog.Title className="text-sm font-semibold text-neutral-900">Crop logo</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div
            className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-xl border border-neutral-200 bg-[repeating-conic-gradient(#f1f1f4_0_25%,#fff_0_50%)] bg-[length:16px_16px] active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob being cropped
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute top-0 left-0 max-w-none select-none"
                style={{
                  width: image.naturalWidth * frame.scale,
                  height: image.naturalHeight * frame.scale,
                  transform: `translate(${frame.x}px, ${frame.y}px)`,
                }}
              />
            ) : (
              <Loader2 className="absolute top-1/2 left-1/2 size-6 -translate-1/2 animate-spin text-neutral-400" />
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              aria-label="Zoom out"
              className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
              onClick={() => zoomTo(frame.scale - step)}
            >
              <Minus className="size-4" />
            </button>
            <input
              type="range"
              aria-label="Zoom"
              min={minScale}
              max={maxScale}
              step={(maxScale - minScale) / 200 || 0.01}
              value={frame.scale}
              disabled={!image}
              onChange={(event) => zoomTo(Number(event.currentTarget.value))}
              className="h-1.5 flex-1 accent-brand-800"
            />
            <button
              type="button"
              aria-label="Zoom in"
              className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
              onClick={() => zoomTo(frame.scale + step)}
            >
              <Plus className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-neutral-500">Drag to move · zoom to fit the logo in the square</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={!image || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              Use logo
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
