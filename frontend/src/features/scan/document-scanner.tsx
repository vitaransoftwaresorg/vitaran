"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, Flashlight, FlashlightOff, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_QUAD,
  blendQuad,
  captureQuad,
  detectSheet,
  quadArea,
  enhanceScan,
  quadDistance,
  offCenter,
  sheetSharpness,
  tooAngled,
  warpPixels,
  MIN_SHARPNESS,
  type SheetQuad,
} from "./sheet-detect";
import { MAX_TILT_DEG, usePhoneTilt } from "./phone-tilt";

const DETECT_EVERY_MS = 100;
/** Outline glide time constant: each frame moves ~1 - e^(-dt/τ) of the way to the target. */
const GLIDE_MS = 140;
/** Recent outlines kept; an outline is shown once `AGREE` of them agree within `AGREE_DIST`. */
const HISTORY = 8;
const AGREE = 3;
const AGREE_DIST = 0.035;
/** Missed frames before the outline is dropped (so one bad frame does not flicker it off). */
const DROP_AFTER = 4;
/** Frames the outline must hold still before it shows as locked (~1 s). */
const STEADY_FRAMES = 7;
const STEADY_MOVE = 0.012;
/** Outline changes smaller than this are detection noise, so the shown outline holds still. */
const DEADBAND = 0.006;
/** Share of the way the shown outline moves toward the smoothed detection each detect tick. */
const FOLLOW = 0.35;
const MIN_AREA = 0.22;
const MAX_CAPTURE_SIDE = 4096;
const BLUR_NOTICE_MS = 3500;
/** A4 at 200 dpi, the size of the scanned page that is uploaded. */
const SCAN_W = 1654;
const SCAN_H = 2339;
const OUTLINE = "56,189,248";

type Phase = "starting" | "live" | "adjust";
type Box = { left: number; top: number; width: number; height: number };
type Shot = {
  photo: Blob;
  width: number;
  height: number;
  /** Where the corners were placed automatically. */
  corners: SheetQuad;
  /** Auto corners good enough to read from; otherwise, unless moved, the original photo is sent and the server finds the paper. */
  trusted: boolean;
};

type DocumentScannerProps = {
  /** `cropped`: the flattened, whitened page, like a scanner output. Otherwise the original photo. */
  onCapture: (file: Blob, cropped: boolean) => void;
  onClose: () => void;
  /** Camera blocked or unsupported: fall back to the system camera. */
  onUnavailable: () => void;
};

/** Where an `object-contain` media of `mediaW × mediaH` sits inside a `boxW × boxH` box. */
function containBox(mediaW: number, mediaH: number, boxW: number, boxH: number): Box {
  if (!mediaW || !mediaH || !boxW || !boxH) return { left: 0, top: 0, width: boxW, height: boxH };
  const scale = Math.min(boxW / mediaW, boxH / mediaH);
  const width = mediaW * scale;
  const height = mediaH * scale;
  return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}

type Pt = { x: number; y: number };

/** Centered A4 frame inside the camera picture, shown until a sheet is found. */
function guideFrame(box: Box): Pt[] {
  let height = box.height * 0.78;
  let width = height / Math.SQRT2;
  if (width > box.width * 0.86) {
    width = box.width * 0.86;
    height = width * Math.SQRT2;
  }
  const left = box.left + (box.width - width) / 2;
  const top = box.top + (box.height - height) / 2;
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];
}

const points = (quad: SheetQuad, box: Box) =>
  quad.map((p) => `${box.left + p.x * box.width},${box.top + p.y * box.height}`).join(" ");

/** Flattens `corners` of `source` into a white-balanced A4 page, like a document scanner's output. */
async function scanPage(source: CanvasImageSource, width: number, height: number, corners: SheetQuad) {
  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const pixels = warpPixels(ctx.getImageData(0, 0, width, height), corners, SCAN_W, SCAN_H, true);
  if (!pixels) return null;
  enhanceScan(pixels);
  work.width = SCAN_W;
  work.height = SCAN_H;
  ctx.putImageData(new ImageData(pixels, SCAN_W, SCAN_H), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => work.toBlob(resolve, "image/jpeg", 0.92));
  work.width = work.height = 0;
  return blob;
}

async function scanFromPhoto(photo: Blob, corners: SheetQuad) {
  const bitmap = await createImageBitmap(photo);
  try {
    return await scanPage(bitmap, bitmap.width, bitmap.height, corners);
  } finally {
    bitmap.close();
  }
}

/** Per-corner median of recent agreeing outlines: one noisy frame cannot pull the outline. */
function medianQuad(quads: SheetQuad[]): SheetQuad {
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };
  return quads[0]!.map((_, i) => ({
    x: median(quads.map((q) => q[i]!.x)),
    y: median(quads.map((q) => q[i]!.y)),
  })) as SheetQuad;
}

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));

/**
 * Full-screen single-sheet scanner modelled on the Notes document scanner: live outline,
 * tap to capture, then the photo with crop corners already on the sheet (drag to adjust, with
 * a loupe) and Use Scan, which sends a flattened white page.
 */
export function DocumentScanner({ onCapture, onClose, onUnavailable }: DocumentScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<SVGPolygonElement>(null);
  const liveBoxRef = useRef<Box>({ left: 0, top: 0, width: 0, height: 0 });
  const streamRef = useRef<MediaStream | null>(null);
  const detectCanvas = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<SheetQuad[]>([]);
  const displayRef = useRef<SheetQuad | null>(null);
  const rawRef = useRef<SheetQuad | null>(null);
  const missRef = useRef(0);
  const steadyRef = useRef(0);
  const busyRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("starting");
  const [quad, setQuad] = useState<SheetQuad | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [video, setVideo] = useState({ width: 0, height: 0 });
  const [shot, setShot] = useState<Shot | null>(null);
  const [editUrl, setEditUrl] = useState<string | null>(null);
  const [corners, setCorners] = useState<SheetQuad>(DEFAULT_QUAD);
  const [flash, setFlash] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const tilt = usePhoneTilt(phase === "live");
  const tiltRef = useRef(tilt);
  useEffect(() => {
    tiltRef.current = tilt;
  }, [tilt]);

  const resetTracking = useCallback(() => {
    historyRef.current = [];
    displayRef.current = null;
    rawRef.current = null;
    missRef.current = 0;
    steadyRef.current = 0;
    setQuad(null);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
      onUnavailable();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
        whiteBalanceMode?: string[];
        exposureMode?: string[];
        focusMode?: string[];
      };
      const advanced: Record<string, string>[] = [];
      if (caps.whiteBalanceMode?.includes("continuous")) advanced.push({ whiteBalanceMode: "continuous" });
      if (caps.exposureMode?.includes("continuous")) advanced.push({ exposureMode: "continuous" });
      if (caps.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" });
      if (advanced.length) {
        await track?.applyConstraints({ advanced: advanced as MediaTrackConstraintSet[] }).catch(() => undefined);
      }
      setTorch(caps.torch ? false : null);
      const element = videoRef.current;
      if (!element) return;
      element.srcObject = stream;
      await element.play().catch(() => undefined);
      setPhase("live");
    } catch {
      onUnavailable();
    }
  }, [onUnavailable]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void startStream());
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      stopStream();
      document.body.style.overflow = overflow;
    };
  }, [startStream, stopStream]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setStage({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (editUrl) URL.revokeObjectURL(editUrl);
  }, [editUrl]);

  const resumeLive = useCallback(() => {
    resetTracking();
    setShot(null);
    setEditUrl(null);
    const element = videoRef.current;
    if (element && streamRef.current) {
      void element.play().catch(() => undefined);
      setPhase("live");
    } else {
      setPhase("starting");
      void startStream();
    }
  }, [resetTracking, startStream]);

  const capture = useCallback(async () => {
    const element = videoRef.current;
    if (!element || busyRef.current || !element.videoWidth) return;
    busyRef.current = true;
    setNotice(null);
    try {
      const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(element.videoWidth, element.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(element.videoWidth * scale);
      canvas.height = Math.round(element.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx?.drawImage(element, 0, 0, canvas.width, canvas.height);
      const found = captureQuad(canvas, canvas.width, canvas.height, document.createElement("canvas"), displayRef.current);
      const quad = found?.quad ?? null;
      const reject = (message: string) => {
        canvas.width = canvas.height = 0;
        navigator.vibrate?.([40, 60, 40]);
        setNotice(message);
      };
      if (tiltRef.current != null && tiltRef.current > MAX_TILT_DEG) {
        reject(`Phone is at ${90 - tiltRef.current}° — hold it flat over the sheet (80°–95°) and tap again`);
        return;
      }
      if (found?.trusted && tooAngled(found.quad, canvas.width, canvas.height)) {
        reject("Photo is at an angle — hold the phone straight above the sheet and tap again");
        return;
      }
      if (found?.trusted && offCenter(found.quad)) {
        reject("Sheet is off to one side — hold the phone over the middle of the sheet and tap again");
        return;
      }
      const pixels = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      if (pixels && sheetSharpness(pixels, quad ?? DEFAULT_QUAD) < MIN_SHARPNESS) {
        reject("Photo is blurry — hold the phone steady and tap again");
        return;
      }
      const photo = await toJpeg(canvas);
      if (!photo) {
        resumeLive();
        return;
      }
      element.pause();
      const start = quad ?? DEFAULT_QUAD;
      setShot({ photo, width: canvas.width, height: canvas.height, corners: start, trusted: found?.trusted ?? false });
      canvas.width = canvas.height = 0;
      setCorners(start);
      setEditUrl(URL.createObjectURL(photo));
      setFlash(true);
      window.setTimeout(() => setFlash(false), 160);
      navigator.vibrate?.(20);
      setPhase("adjust");
    } finally {
      busyRef.current = false;
    }
  }, [resumeLive]);

  // Live outline: agree over several frames and hold through brief misses.
  useEffect(() => {
    if (phase !== "live") return;
    const element = videoRef.current;
    if (!element) return;
    detectCanvas.current ??= document.createElement("canvas");
    const timer = window.setInterval(() => {
      if (busyRef.current || !element.videoWidth || element.readyState < 2) return;
      if (element.videoWidth !== video.width || element.videoHeight !== video.height) {
        setVideo({ width: element.videoWidth, height: element.videoHeight });
      }
      const found = detectSheet(element, element.videoWidth, element.videoHeight, detectCanvas.current!);
      const prevRaw = rawRef.current;
      rawRef.current = found;

      if (!found) {
        missRef.current += 1;
        steadyRef.current = 0;
        if (missRef.current >= DROP_AFTER) {
          historyRef.current = [];
          displayRef.current = null;
          setQuad(null);
        }
        return;
      }

      missRef.current = 0;
      const history = [...historyRef.current, found].slice(-HISTORY);
      historyRef.current = history;
      const agreeing = history.filter((q) => quadDistance(q, found) < AGREE_DIST);
      const target = medianQuad(agreeing);
      const shown = displayRef.current;
      if (agreeing.length >= AGREE || shown) {
        const next =
          shown && quadDistance(shown, target) < 0.08
            ? quadDistance(shown, target) < DEADBAND
              ? shown
              : blendQuad(shown, target, FOLLOW)
            : agreeing.length >= AGREE
              ? target
              : shown;
        if (next !== shown) {
          displayRef.current = next;
          setQuad(next);
        }
      }

      const still = prevRaw != null && quadDistance(found, prevRaw) < STEADY_MOVE;
      const bigEnough = quadArea(found) >= MIN_AREA;
      steadyRef.current = still && bigEnough && displayRef.current ? steadyRef.current + 1 : 0;
    }, DETECT_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [phase, video.width, video.height]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || torch == null) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  }

  /** Moved corners are the user's crop; untouched ones are only trusted for a strict outline. */
  async function send() {
    if (!shot) return;
    const moved = quadDistance(corners, shot.corners) > 0.002;
    if (!moved && !shot.trusted) {
      stopStream();
      onCapture(shot.photo, false);
      return;
    }
    setWorking(true);
    try {
      const scan = await scanFromPhoto(shot.photo, corners);
      if (!scan) return;
      stopStream();
      onCapture(scan, true);
    } finally {
      setWorking(false);
    }
  }

  function cancel() {
    stopStream();
    onClose();
  }

  const liveBox = containBox(video.width, video.height, stage.width, stage.height);
  const editBox = containBox(shot?.width ?? 0, shot?.height ?? 0, stage.width, stage.height);
  const live = phase === "live" || phase === "starting";

  useEffect(() => {
    liveBoxRef.current = liveBox;
  });

  // 60 fps outline: glides from the guide frame onto the sheet and follows it, never jumps.
  useEffect(() => {
    if (!live) return;
    let frame = 0;
    let last = performance.now();
    let drawn: Pt[] | null = null;
    let found = 0;
    let fill = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const polygon = outlineRef.current;
      const box = liveBoxRef.current;
      if (!polygon || !box.width) return;
      const k = 1 - Math.exp(-Math.min(64, now - last) / GLIDE_MS);
      last = now;
      const sheet = displayRef.current;
      const target = sheet
        ? sheet.map((p) => ({ x: box.left + p.x * box.width, y: box.top + p.y * box.height }))
        : guideFrame(box);
      drawn = drawn ? drawn.map((p, i) => ({ x: p.x + (target[i]!.x - p.x) * k, y: p.y + (target[i]!.y - p.y) * k })) : target;
      found += ((sheet ? 1 : 0) - found) * k;
      fill += (Math.min(1, steadyRef.current / STEADY_FRAMES) - fill) * k;
      const [r, g, b] = OUTLINE.split(",").map(Number) as [number, number, number];
      const mix = (from: number, to: number) => Math.round(from + (to - from) * found);
      polygon.setAttribute("points", drawn.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
      polygon.setAttribute("stroke", `rgba(${mix(255, r)},${mix(255, g)},${mix(255, b)},${0.45 + 0.55 * found})`);
      polygon.setAttribute("stroke-width", (1.5 + found * (1.5 + fill * 1.5)).toFixed(2));
      polygon.setAttribute("fill", `rgba(${r},${g},${b},${(found * (0.05 + fill * 0.15)).toFixed(3)})`);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), BLUR_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const tilted = tilt != null && tilt > MAX_TILT_DEG;
  const sheetReady =
    phase === "live" &&
    !tilted &&
    quad != null &&
    quadArea(quad) >= MIN_AREA &&
    !tooAngled(quad, video.width, video.height) &&
    !offCenter(quad);

  const hint = notice
    ? notice
    : phase === "starting"
      ? "Starting camera…"
      : tilted
        ? `Phone at ${90 - tilt}° — hold it flat over the sheet (80°–95°)`
        : !quad
        ? "Position the OMR sheet in view"
        : quadArea(quad) < MIN_AREA
          ? "Move closer"
          : tooAngled(quad, video.width, video.height)
            ? "Hold the phone straight above the sheet"
            : offCenter(quad)
              ? "Move the phone over the middle of the sheet"
              : "Tap the shutter";

  const topButton = "inline-flex h-10 items-center rounded-full px-3 text-[15px] font-semibold active:bg-white/10";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex touch-none flex-col bg-black text-white select-none">
      <div className="flex min-h-14 items-center justify-between gap-2 px-2 pt-[max(env(safe-area-inset-top),0.5rem)] pb-1">
        {phase === "adjust" ? (
          <>
            <button type="button" onClick={cancel} className={topButton}>
              Cancel
            </button>
            <p className="min-w-0 truncate text-[15px] font-semibold">Drag corners to crop</p>
            <span className="w-16" />
          </>
        ) : (
          <>
            <button type="button" onClick={cancel} className={topButton}>
              Cancel
            </button>
            <div className="flex items-center gap-1">
              {torch != null ? (
                <button
                  type="button"
                  aria-label={torch ? "Turn off light" : "Turn on light"}
                  onClick={() => void toggleTorch()}
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-full",
                    torch ? "text-sky-300" : "text-white/90 active:bg-white/10",
                  )}
                >
                  {torch ? <Flashlight className="size-5" /> : <FlashlightOff className="size-5" />}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn("absolute inset-0 size-full object-contain", !live && "invisible")}
        />

        {phase === "live" ? (
          <svg className="pointer-events-none absolute inset-0 size-full">
            <polygon ref={outlineRef} fill="none" stroke="none" strokeLinejoin="round" />
          </svg>
        ) : null}

        {live ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
            <span
              className={cn(
                "rounded-lg px-3 py-1.5 text-[15px] font-medium backdrop-blur",
                notice ? "bg-amber-500/90 text-black" : "bg-black/55",
              )}
            >
              {hint}
            </span>
          </div>
        ) : null}

        {phase === "adjust" && editUrl ? (
          <CornerEditor url={editUrl} box={editBox} corners={corners} onChange={setCorners} />
        ) : null}

        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-white transition-opacity duration-150",
            flash ? "opacity-70" : "opacity-0",
          )}
        />
      </div>

      <div className="flex min-h-[112px] items-center px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {phase === "adjust" ? (
          <div className="flex w-full items-center justify-between gap-3">
            <ToolButton icon={<RotateCcw className="size-6" />} label="Retake" onClick={resumeLive} />
            <button
              type="button"
              disabled={working}
              onClick={() => void send()}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[17px] font-semibold text-black active:bg-white/80 disabled:opacity-60"
            >
              {working ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              Use Scan
            </button>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <button
              type="button"
              aria-label="Scan sheet"
              disabled={!sheetReady}
              onClick={() => void capture()}
              className="flex size-[74px] items-center justify-center rounded-full border-[3px] border-white disabled:opacity-40"
            >
              <span className="size-[60px] rounded-full bg-white transition-transform active:scale-90" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-w-16 flex-col items-center gap-1 text-xs font-medium active:opacity-60",
        active ? "text-sky-300" : "text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function CornerEditor({
  url,
  box,
  corners,
  onChange,
}: {
  url: string;
  box: Box;
  corners: SheetQuad;
  onChange: (next: SheetQuad) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);

  const move = (event: ReactPointerEvent, index: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !box.width || !box.height) return;
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left - box.left) / box.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top - box.top) / box.height));
    onChange(corners.map((p, i) => (i === index ? { x, y } : p)) as SheetQuad);
  };

  const at = (index: number) => ({
    x: box.left + corners[index]!.x * box.width,
    y: box.top + corners[index]!.y * box.height,
  });

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- local capture preview (blob URL) */}
      <img
        src={url}
        alt="Captured OMR sheet"
        className="absolute object-fill"
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      />
      <svg ref={svgRef} className="absolute inset-0 size-full">
        <defs>
          <mask id="sheet-crop">
            <rect width="100%" height="100%" fill="white" />
            <polygon points={points(corners, box)} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#sheet-crop)" />
        <polygon
          points={points(corners, box)}
          fill="none"
          stroke={`rgb(${OUTLINE})`}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {corners.map((_, index) => {
          const p = at(index);
          return (
            <g
              key={index}
              onPointerDown={(event) => {
                (event.target as Element).setPointerCapture(event.pointerId);
                setDrag(index);
              }}
              onPointerMove={(event) => {
                if (drag === index) move(event, index);
              }}
              onPointerUp={() => setDrag(null)}
              onPointerCancel={() => setDrag(null)}
              style={{ touchAction: "none", cursor: "grab" }}
            >
              <circle cx={p.x} cy={p.y} r={28} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={drag === index ? 15 : 12}
                fill="none"
                stroke={`rgb(${OUTLINE})`}
                strokeWidth={3}
              />
            </g>
          );
        })}
      </svg>
      {drag != null ? <Loupe url={url} box={box} point={corners[drag]!} /> : null}
    </>
  );
}

/** Magnified view of the corner under the finger, like Notes. */
function Loupe({ url, box, point }: { url: string; box: Box; point: { x: number; y: number } }) {
  const size = 112;
  const zoom = 2.5;
  const px = box.left + point.x * box.width;
  const py = box.top + point.y * box.height;
  const left = point.x < 0.5 ? box.left + box.width - size - 12 : box.left + 12;
  return (
    <div
      className="pointer-events-none absolute top-3 overflow-hidden rounded-full border-2 border-white shadow-lg"
      style={{
        left,
        width: size,
        height: size,
        backgroundImage: `url(${url})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${box.width * zoom}px ${box.height * zoom}px`,
        backgroundPosition: `${size / 2 - (px - box.left) * zoom}px ${size / 2 - (py - box.top) * zoom}px`,
      }}
    >
      <span className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-300" />
    </div>
  );
}
