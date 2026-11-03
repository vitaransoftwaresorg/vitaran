"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ScanPreview } from "@/types/scan";

type ScanFn = (form: FormData) => Promise<{ ok: true; result: ScanPreview } | { ok: false; message: string }>;

const MAX_SIDE = 4096;
const JPEG_QUALITY = 0.97;
const MAX_BYTES = 8_000_000;

function usePhone() {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const sync = () => {
      setPhone(
        window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
          /iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent),
      );
    };
    sync();
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone;
}

function loadImage(source: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(source);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this photo."));
    };
    image.src = url;
  });
}

function isJpeg(source: Blob) {
  return source.type === "image/jpeg" || source.type === "image/jpg";
}

async function asJpegFile(source: Blob) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read this photo.");
  try {
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const width = bitmap.width;
    const height = bitmap.height;
    if (isJpeg(source) && source.size > 0 && source.size <= MAX_BYTES && Math.max(width, height) <= MAX_SIDE) {
      bitmap.close();
      return new File([source], "omr.jpg", { type: "image/jpeg" });
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(1, width, height));
    canvas.width = Math.max(2, Math.round(width * scale));
    canvas.height = Math.max(2, Math.round(height * scale));
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
  } catch {
    const image = await loadImage(source);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (isJpeg(source) && source.size > 0 && source.size <= MAX_BYTES && Math.max(width, height) <= MAX_SIDE) {
      return new File([source], "omr.jpg", { type: "image/jpeg" });
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(1, width, height));
    canvas.width = Math.max(2, Math.round(width * scale));
    canvas.height = Math.max(2, Math.round(height * scale));
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("Could not read this photo.");
  return new File([blob], "omr.jpg", { type: "image/jpeg" });
}

export function ScanCamera({
  onScanned,
  onQueued,
  scanAction,
  rollNo = "",
  testId = "",
  onRollNo,
  onTestId,
}: {
  onScanned: (result: ScanPreview) => void;
  onQueued?: (files: File[]) => void;
  scanAction: ScanFn;
  rollNo?: string;
  testId?: string;
  onRollNo?: (value: string) => void;
  onTestId?: (value: string) => void;
}) {
  const phone = usePhone();
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function submit(source: Blob) {
    setBusy(true);
    try {
      const file = await asJpegFile(source);
      const form = new FormData();
      form.append("file", file);
      if (phone) {
        form.append("rollNo", rollNo.trim());
        form.append("testId", testId.trim());
      }
      const result = await scanAction(form);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onScanned(result.result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this sheet. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onPick(event: ChangeEvent<HTMLInputElement>, batch: boolean) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) {
      toast.error(phone ? "Take a photo of the OMR sheet." : "Pick a photo of the OMR sheet.");
      return;
    }
    if (batch) onQueued?.(files.slice(1));
    void submit(files[0]!);
  }

  if (phone === null) {
    return <div className="aspect-[3/4] w-full rounded-2xl bg-neutral-100" />;
  }

  if (!phone) {
    return (
      <div className="space-y-3">
        <label
          className={cn(
            "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(event) => onPick(event, true)}
          />
          {busy ? <Loader2 className="size-8 animate-spin text-brand-800" /> : <Upload className="size-8 text-brand-800" />}
          <p className="text-sm font-semibold text-neutral-900">{busy ? "Uploading the photo…" : "Upload photos of OMR sheets"}</p>
          <p className="text-xs text-neutral-500">One sheet or a batch. JPEG, PNG, or HEIC from this computer.</p>
        </label>
      </div>
    );
  }

  function openCamera() {
    if (!/^\d{6,7}$/.test(rollNo.trim()) || !/^\d{1,12}$/.test(testId.trim())) {
      toast.error("Enter the registration number and test ID.");
      return;
    }
    cameraRef.current?.click();
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="space-y-1.5">
          <Label htmlFor="scan-roll" className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Registration number
          </Label>
          <Input
            id="scan-roll"
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            value={rollNo}
            disabled={busy}
            placeholder="6 or 7 digits"
            className="h-11 rounded-xl px-3.5 text-base"
            onChange={(event) => onRollNo?.(event.target.value.replace(/\D/g, "").slice(0, 7))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scan-test" className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Test ID
          </Label>
          <Input
            id="scan-test"
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            value={testId}
            disabled={busy}
            placeholder="As on the answer key"
            className="h-11 rounded-xl px-3.5 text-base"
            onChange={(event) => onTestId?.(event.target.value.replace(/\D/g, "").slice(0, 12))}
          />
        </div>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg"
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={(event) => onPick(event, false)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={openCamera}
        className={cn(
          "flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center",
          busy ? "opacity-60" : "cursor-pointer",
        )}
      >
        {busy ? <Loader2 className="size-8 animate-spin text-brand-800" /> : <Camera className="size-8 text-brand-800" />}
        <p className="text-sm font-semibold text-neutral-900">{busy ? "Reading the 100 answers…" : "Scan OMR"}</p>
        <p className="text-xs text-neutral-500">Opens the phone camera. The photo is used only for the 100 questions.</p>
      </button>
    </div>
  );
}
