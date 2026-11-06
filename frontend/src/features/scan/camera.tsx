"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ScanPortal } from "@/services/scans";
import type { ScanPreview, TestIdCheck } from "@/types/scan";
import { registerOmrPdfDirect, previewOmrPdfPageDirect } from "./client-upload";
import { checkTestIdAction } from "./actions";
import { getOmrUploadAuthAction } from "./upload-auth";
import type { ScanQueueItem } from "./queue-item";

type ScanFn = (form: FormData) => Promise<{ ok: true; result: ScanPreview } | { ok: false; message: string }>;

const MAX_SIDE = 4096;
const JPEG_QUALITY = 0.97;
const MAX_BYTES = 8_000_000;

function isPdfFile(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

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

const TEST_ID_LENGTH = 6;
const TEST_ID_PATTERN = /^\d{6}$/;
const testIdInput = (value: string) => value.replace(/\D/g, "").slice(0, TEST_ID_LENGTH);

type TestCheckState =
  | { value: string; ok: true; keys: TestIdCheck["keys"] }
  | { value: string; ok: false; message: string };

function toCheckState(
  value: string,
  result: ({ ok: true } & TestIdCheck) | { ok: false; message: string },
): TestCheckState {
  return result.ok ? { value, ok: true, keys: result.keys } : { value, ok: false, message: result.message };
}

export function ScanCamera({
  portal,
  onScanned,
  onBatchScanned,
  onQueued,
  scanAction,
  rollNo = "",
  testId = "",
  onRollNo,
  onTestId,
}: {
  portal: ScanPortal;
  onScanned: (result: ScanPreview) => void;
  onBatchScanned?: (results: ScanPreview[]) => void;
  onQueued?: (items: ScanQueueItem[]) => void;
  scanAction: ScanFn;
  rollNo?: string;
  testId?: string;
  onRollNo?: (value: string) => void;
  onTestId?: (value: string) => void;
}) {
  const phone = usePhone();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const [testCheck, setTestCheck] = useState<TestCheckState | null>(null);
  const enteredTest = testId.trim();
  const testComplete = TEST_ID_PATTERN.test(enteredTest);
  const checked = testComplete && testCheck?.value === enteredTest ? testCheck : null;
  const testReady = Boolean(checked?.ok);

  useEffect(() => {
    if (!testComplete) return;
    let live = true;
    void checkTestIdAction(portal, enteredTest).then((result) => {
      if (live) setTestCheck(toCheckState(enteredTest, result));
    });
    return () => {
      live = false;
    };
  }, [portal, enteredTest, testComplete]);

  /** Every scan and upload needs a 6-digit test ID that has an answer key for this school. */
  async function verifyTestId() {
    if (!testComplete) {
      toast.error("Enter the 6-digit test ID from the answer key first.");
      return false;
    }
    if (checked) {
      if (!checked.ok) toast.error(checked.message);
      return checked.ok;
    }
    const result = await checkTestIdAction(portal, enteredTest);
    const state = toCheckState(enteredTest, result);
    setTestCheck(state);
    if (!state.ok) toast.error(state.message);
    return state.ok;
  }

  const testHint = !enteredTest ? (
    <p className="text-[11px] text-neutral-500">Enter the 6-digit test ID first, then upload.</p>
  ) : !testComplete ? (
    <p className="text-[11px] text-neutral-500">
      Enter all 6 digits ({enteredTest.length}/6)
    </p>
  ) : !checked ? (
    <p className="flex items-center gap-1.5 text-[11px] text-neutral-500">
      <Loader2 className="size-3 animate-spin" />
      Checking test ID…
    </p>
  ) : checked.ok ? (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-900">
      {checked.keys.map((key) => (
        <p key={`${key.programCode}:${key.classLevel}:${key.testNumber}`} className="font-semibold">
          {key.programName} · Test {key.testNumber} · Class {key.classLevel}
        </p>
      ))}
    </div>
  ) : (
    <p className="text-[11px] font-medium text-red-700">{checked.message}</p>
  );

  async function submit(source: Blob) {
    if (!(await verifyTestId())) return;
    setBusy(true);
    setStatus("Reading sheet…");
    try {
      const file = await asJpegFile(source);
      const form = new FormData();
      form.append("file", file);
      if (phone) form.append("rollNo", rollNo.trim());
      if (testId.trim()) form.append("testId", testId.trim());
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
      setStatus("");
    }
  }

  async function submitPdf(file: File) {
    const forcedTestId = testId.trim();
    if (!forcedTestId) {
      toast.error("Enter the test ID from the answer key before uploading the PDF.");
      return;
    }
    if (!(await verifyTestId())) return;
    setBusy(true);
    setStatus("Uploading PDF…");
    try {
      const auth = await getOmrUploadAuthAction(portal);
      if (!auth.ok) {
        toast.error(auth.message);
        return;
      }
      const registered = await registerOmrPdfDirect(
        auth.uploadUrl,
        auth.token,
        file,
        forcedTestId,
      );
      const { batchId, pageCount } = registered;
      if (pageCount < 1) {
        toast.error("This PDF has no pages.");
        return;
      }
      toast.message(
        pageCount === 1
          ? "PDF ready · 1 student sheet"
          : `Reading ${pageCount} student sheets · Test ID ${forcedTestId}`,
      );

      const results: ScanPreview[] = [];
      const failures: string[] = [];
      const seenRolls = new Set<string>();
      let duplicates = 0;
      for (let page = 1; page <= pageCount; page += 1) {
        setStatus(`Reading sheet ${page} of ${pageCount}…`);
        try {
          const preview = await previewOmrPdfPageDirect(
            auth.batchPreviewUrl,
            auth.token,
            batchId,
            page,
            { testId: forcedTestId },
          );
          const roll = (preview.scan.rollNo || preview.scan.student.rollNo || "").replace(/\D/g, "");
          if (roll && seenRolls.has(roll)) {
            duplicates += 1;
            continue;
          }
          if (roll) seenRolls.add(roll);
          results.push(preview);
        } catch (error) {
          failures.push(
            `Page ${page}: ${error instanceof Error ? error.message : "Could not read"}`,
          );
        }
      }

      if (!results.length) {
        toast.error(failures[0] ?? "Could not read any sheets from this PDF.");
        return;
      }
      const parts = [`${results.length} unique sheet${results.length === 1 ? "" : "s"}`];
      if (duplicates) parts.push(`${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped`);
      if (failures.length) parts.push(`${failures.length} failed`);
      if (failures.length) {
        toast.warning(`Read ${parts.join(" · ")}`, {
          description: failures.slice(0, 6).join("\n") + (failures.length > 6 ? `\n+${failures.length - 6} more` : ""),
          duration: 15000,
          classNames: { description: "whitespace-pre-line" },
        });
      } else if (duplicates) toast.message(`Read ${parts.join(" · ")}`);
      else toast.success(`Read all ${results.length} sheets`);
      onBatchScanned?.(results);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this PDF.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  function onPick(event: ChangeEvent<HTMLInputElement>, batch: boolean) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) {
      toast.error(phone ? "Take a photo of the OMR sheet." : "Pick photos or a PDF of OMR sheets.");
      return;
    }
    const pdf = files.find(isPdfFile);
    if (pdf) {
      if (files.length > 1) toast.message("Using the PDF — extra image files were ignored.");
      void submitPdf(pdf);
      return;
    }
    if (batch) {
      onQueued?.(
        files.slice(1).map((file) => ({
          kind: "file" as const,
          file,
          testId: testId.trim() || undefined,
        })),
      );
    }
    void submit(files[0]!);
  }

  if (phone === null) {
    return <div className="aspect-[3/4] w-full rounded-2xl bg-neutral-100" />;
  }

  if (!phone) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5 rounded-2xl border border-neutral-200 bg-white p-4">
          <Label htmlFor="scan-test-desktop" className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Test ID
          </Label>
          <Input
            id="scan-test-desktop"
            inputMode="numeric"
            autoComplete="off"
            maxLength={TEST_ID_LENGTH}
            value={testId}
            disabled={busy}
            placeholder="6 digits, as on the answer key"
            className="h-11 rounded-xl px-3.5 text-base tracking-widest tabular-nums"
            onChange={(event) => onTestId?.(testIdInput(event.currentTarget.value))}
          />
          {testHint}
        </div>
        <label
          aria-disabled={!testReady || busy}
          onClick={(event) => {
            if (busy || testReady) return;
            event.preventDefault();
            toast.error(
              checked && !checked.ok ? checked.message : "Enter a valid test ID first, then upload.",
            );
          }}
          className={cn(
            "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center",
            busy && "pointer-events-none opacity-60",
            !testReady && !busy && "cursor-not-allowed bg-neutral-50 opacity-60",
          )}
        >
          <input
            type="file"
            accept="image/*,application/pdf,.pdf"
            multiple
            className="hidden"
            disabled={busy || !testReady}
            onChange={(event) => onPick(event, true)}
          />
          {busy ? <Loader2 className="size-8 animate-spin text-brand-800" /> : <Upload className="size-8 text-brand-800" />}
          <p className="text-sm font-semibold text-neutral-900">
            {busy ? status || "Working…" : testReady ? "Upload OMR photos or a PDF" : "Enter the test ID to upload"}
          </p>
          <p className="text-xs text-neutral-500">
            One sheet, a photo batch, or one PDF with up to 120 students (one page each). After a PDF upload,
            every sheet is listed together. JPEG, PNG, HEIC, or PDF.
          </p>
        </label>
      </div>
    );
  }

  function openCamera() {
    if (!/^\d{6,7}$/.test(rollNo.trim()) || !testComplete) {
      toast.error("Enter the registration number and the 6-digit test ID.");
      return;
    }
    if (!checked) {
      toast.message("Checking the test ID — tap again in a moment.");
      return;
    }
    if (!checked.ok) {
      toast.error(checked.message);
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
            maxLength={TEST_ID_LENGTH}
            value={testId}
            disabled={busy}
            placeholder="6 digits, as on the answer key"
            className="h-11 rounded-xl px-3.5 text-base tracking-widest tabular-nums"
            onChange={(event) => onTestId?.(testIdInput(event.target.value))}
          />
          {testHint}
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
