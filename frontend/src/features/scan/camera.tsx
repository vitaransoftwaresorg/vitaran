"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ScanPortal } from "@/services/scans";
import type { ScanPreview, TestIdCheck } from "@/types/scan";
import { registerOmrPdfDirect } from "./client-upload";
import { EXAM_PATTERN_OPTIONS, type ExamPattern } from "./exam-pattern";
import { fileNameHasTestNumber } from "./pdf-file-name";
import { startPdfJob } from "./pdf-batch";
import { bindPendingIdentityAction, checkTestIdAction } from "./actions";
import { DocumentScanner } from "./document-scanner";
import { OmrRollRecovery } from "./omr-roll-recovery";
import type { OmrStudentMatch } from "./omr-student-actions";
import { requestTiltPermission } from "./phone-tilt";
import { majorityWalkInFromBatch } from "./batch-store";
import { canRecoverRoll, normalizeRollNo, ROLL_LENGTH, rollInput } from "./roll-helpers";
import { FULL_PAGE_QUAD, type SheetQuad } from "./sheet-detect";
import { getOmrUploadAuthAction } from "./upload-auth";
import type { ScanQueueItem } from "./queue-item";
import type { PreviewScanFailure } from "./actions";
import { detectPhoneClient } from "./use-is-phone";

type ScanFn = (
  form: FormData,
) => Promise<{ ok: true; result: ScanPreview } | PreviewScanFailure>;

const MAX_SIDE = 4096;
const JPEG_QUALITY = 0.97;
const MAX_BYTES = 8_000_000;

function isPdfFile(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function usePhone() {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const sync = () => setPhone(detectPhoneClient());
    sync();
    const coarse = window.matchMedia("(pointer: coarse)");
    const hover = window.matchMedia("(hover: none)");
    coarse.addEventListener("change", sync);
    hover.addEventListener("change", sync);
    return () => {
      coarse.removeEventListener("change", sync);
      hover.removeEventListener("change", sync);
    };
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

export async function asJpegFile(source: Blob) {
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

const TEST_ID_MIN_LENGTH = 6;
const TEST_ID_MAX_LENGTH = 7;
const TEST_ID_PATTERN = /^\d{6,7}$/;
const testIdInput = (value: string) => value.replace(/\D/g, "").slice(0, TEST_ID_MAX_LENGTH);

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
  onQueued,
  scanAction,
  testId = "",
  onTestId,
  examPattern = "",
  onExamPattern,
}: {
  portal: ScanPortal;
  onScanned: (result: ScanPreview) => void;
  onQueued?: (items: ScanQueueItem[]) => void;
  scanAction: ScanFn;
  testId?: string;
  onTestId?: (value: string) => void;
  examPattern?: string;
  onExamPattern?: (value: ExamPattern | "") => void;
}) {
  const phone = usePhone();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [testCheck, setTestCheck] = useState<TestCheckState | null>(null);
  const [rollError, setRollError] = useState<string | null>(null);
  const [rollMatches, setRollMatches] = useState<OmrStudentMatch[]>([]);
  const [rollHint, setRollHint] = useState("");
  const retryRef = useRef<{ source: Blob; corners?: SheetQuad; previewId?: string } | null>(null);
  const enteredTest = testId.trim();
  const testComplete = TEST_ID_PATTERN.test(enteredTest);
  const checked = testComplete && testCheck?.value === enteredTest ? testCheck : null;
  const patternReady = EXAM_PATTERN_OPTIONS.some((row) => row.value === examPattern);
  const testReady = Boolean(checked?.ok) && patternReady;

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

  /** Every scan and upload needs a 6–7 digit test ID that has an answer key. Returns keys when ok. */
  async function verifyTestId(): Promise<false | TestIdCheck["keys"]> {
    if (!testComplete) {
      toast.error("Enter the 6-digit test ID from the answer key first.");
      return false;
    }
    if (!patternReady) {
      toast.error("Choose the exam pattern (MPCB, PCB, or MPC).");
      return false;
    }
    if (checked) {
      if (!checked.ok) {
        toast.error(checked.message);
        return false;
      }
      return checked.keys;
    }
    const result = await checkTestIdAction(portal, enteredTest);
    const state = toCheckState(enteredTest, result);
    setTestCheck(state);
    if (!state.ok) {
      toast.error(state.message);
      return false;
    }
    return state.keys;
  }

  function patternField(id: string) {
    if (!checked?.ok) return null;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Exam pattern
        </Label>
        <Select
          items={EXAM_PATTERN_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          value={patternReady ? examPattern : null}
          disabled={busy}
          onValueChange={(value) => {
            if (value == null) return;
            onExamPattern?.(value as ExamPattern);
          }}
        >
          <SelectTrigger id={id} className="h-11 w-full rounded-xl bg-white px-3.5 text-sm">
            <SelectValue placeholder="MPCB, PCB, or MPC" />
          </SelectTrigger>
          <SelectContent>
            {EXAM_PATTERN_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const testHint = !enteredTest ? (
    <p className="text-[11px] text-neutral-500">Enter the 6-digit test ID first, then upload.</p>
  ) : !testComplete ? (
    <p className="text-[11px] text-neutral-500">
      Enter 6–7 digits ({enteredTest.length}/{TEST_ID_MAX_LENGTH})
    </p>
  ) : !checked ? (
    <p className="flex items-center gap-1.5 text-[11px] text-neutral-500">
      <Loader2 className="size-3 animate-spin" />
      Checking test ID…
    </p>
  ) : checked.ok ? (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-900">
      {checked.keys.map((key, index) => (
        <p
          key={`${key.owner ?? "platform"}:${key.sectionName ?? ""}:${key.programCode}:${key.classLevel}:${key.testNumber}:${index}`}
          className="font-semibold"
        >
          {key.owner ? `${key.owner} · ` : ""}
          {key.sectionName ? `Section ${key.sectionName} · ` : ""}
          {key.programName} · Test {key.testNumber} · Class {key.classLevel}
        </p>
      ))}
    </div>
  ) : (
    <p className="text-[11px] font-medium text-red-700">{checked.message}</p>
  );

  async function readPhoto(
    source: Blob,
    corners?: SheetQuad,
    forcedRoll?: string,
    forcedSchoolId?: string,
    forcedName?: string,
    forcedSectionId?: string,
    placement?: { classLevel?: number; programCode?: string },
  ) {
    const file = await asJpegFile(source);
    const form = new FormData();
    form.append("file", file);
    if (testId.trim()) form.append("testId", testId.trim());
    if (examPattern) form.append("examPattern", examPattern);
    const roll = rollInput(forcedRoll ?? "");
    if (forcedName?.trim()) {
      form.append("rollNo", normalizeRollNo(roll));
      form.append("studentName", forcedName.trim());
    } else if (roll.length === ROLL_LENGTH) {
      form.append("rollNo", roll);
    }
    if (forcedSchoolId) form.append("schoolId", forcedSchoolId);
    if (forcedSectionId) form.append("sectionId", forcedSectionId);
    if (placement?.classLevel) form.append("classLevel", String(placement.classLevel));
    if (placement?.programCode) form.append("programCode", placement.programCode);
    if (corners) form.append("corners", JSON.stringify(corners.map((p) => [p.x, p.y])));
    return scanAction(form);
  }

  function rememberRollFailure(
    source: Blob,
    corners: SheetQuad | undefined,
    result: PreviewScanFailure,
  ) {
    if (!canRecoverRoll(result.message) && !(result.matches && result.matches.length > 1)) return;
    retryRef.current = { source, corners, previewId: result.previewId };
    setRollError(result.message);
    setRollMatches(result.matches ?? []);
    setRollHint(result.rollNo ?? "");
  }

  async function submit(source: Blob, corners?: SheetQuad) {
    if (!(await verifyTestId())) return;
    setBusy(true);
    setStatus("Reading sheet…");
    setRollError(null);
    setRollMatches([]);
    setRollHint("");
    try {
      const result = await readPhoto(source, corners);
      if (!result.ok) {
        toast.error(result.message);
        rememberRollFailure(source, corners, result);
        return;
      }
      retryRef.current = null;
      setRollError(null);
      setRollMatches([]);
      setRollHint("");
      onScanned(result.result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this sheet. Try again.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function saveFailedWithRoll(
    typedRoll: string,
    schoolId?: string,
    studentName?: string,
    sectionId?: string,
    placement?: { classLevel?: number; programCode?: string },
  ) {
    const pending = retryRef.current;
    if (!pending) return;
    const typed = rollInput(typedRoll);
    const walkIn = Boolean(studentName?.trim());
    if (!walkIn && typed.length !== ROLL_LENGTH) {
      toast.error("Enter the 7-digit registration number, then save.");
      return;
    }
    if (walkIn && typed.length > 0 && typed.length !== ROLL_LENGTH) {
      toast.error("Registration number must be 7 digits, or empty with a name");
      return;
    }
    if (!(await verifyTestId())) return;
    setBusy(true);
    setStatus(studentName?.trim() ? "Saving walk-in…" : "Saving with registration…");
    try {
      const batchPlace = majorityWalkInFromBatch();
      const identity = {
        rollNo: walkIn ? normalizeRollNo(typed) : typed,
        studentName: studentName?.trim() || undefined,
        schoolId: schoolId || batchPlace.schoolId || undefined,
        sectionId: sectionId || undefined,
        classLevel: placement?.classLevel ?? batchPlace.classLevel,
        programCode: placement?.programCode ?? batchPlace.programCode,
      };
      // Answers already scored at scan — bind only (no bubble re-read).
      const result = pending.previewId
        ? await bindPendingIdentityAction(portal, pending.previewId, identity)
        : await readPhoto(
            pending.source,
            undefined,
            typed,
            identity.schoolId,
            studentName,
            sectionId,
            {
              classLevel: identity.classLevel,
              programCode: identity.programCode,
            },
          );
      if (!result.ok) {
        toast.error(result.message);
        // Keep recovery open so they can pick another student or fix the number.
        rememberRollFailure(pending.source, pending.corners, {
          ...result,
          previewId: result.previewId ?? pending.previewId,
        });
        return;
      }
      retryRef.current = null;
      setRollError(null);
      setRollMatches([]);
      setRollHint("");
      onScanned(result.result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this sheet. Try again.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  function failedRollPanel() {
    if (!rollError || !canRecoverRoll(rollError)) return null;
    return (
      <OmrRollRecovery
        portal={portal}
        message={rollError}
        busy={busy}
        initialMatches={rollMatches}
        initialRollNo={rollHint}
        onSaveWithRoll={(roll, schoolId, studentName, sectionId, placement) =>
          void saveFailedWithRoll(roll, schoolId, studentName, sectionId, placement)
        }
      />
    );
  }

  async function submitPdf(file: File) {
    const forcedTestId = testId.trim();
    if (!forcedTestId) {
      toast.error("Enter the test ID from the answer key before uploading the PDF.");
      return;
    }
    const keys = await verifyTestId();
    if (!keys) return;
    const testNumber = keys[0]?.testNumber;
    if (testNumber != null && !fileNameHasTestNumber(file.name, testNumber)) {
      toast.error(`Rejected: file name must include Test ${testNumber}`, {
        description: `This test ID is Test ${testNumber}. Upload a PDF whose name contains ${testNumber} by itself (e.g. “v school ${testNumber}.pdf” or “schoolsrk${testNumber}.pdf”). Your file “${file.name}” does not match — a longer number like ${testNumber}6, a different number, or no number is not accepted.`,
      });
      return;
    }
    setBusy(true);
    setStatus("Uploading PDF…");
    try {
      const auth = await getOmrUploadAuthAction(portal);
      if (!auth.ok) {
        toast.error(auth.message);
        return;
      }
      const { batchId, pageCount, examPattern: resolvedPattern } = await registerOmrPdfDirect(
        auth.uploadUrl,
        auth.token,
        file,
        forcedTestId,
        examPattern,
      );
      if (pageCount < 1) {
        toast.error("This PDF has no pages.");
        return;
      }
      toast.message(
        `Reading ${pageCount} student sheet${pageCount === 1 ? "" : "s"} · Test ID ${forcedTestId}`,
        { description: "Reading carries on in the background. Review sheets as they appear." },
      );
      await startPdfJob(
        portal,
        {
          batchId,
          fileName: file.name,
          testId: forcedTestId,
          examPattern: examPattern || resolvedPattern || "MPCB",
          pageCount,
          done: 0,
          finished: false,
        },
        keys.map((key) => ({
          programName: key.programName,
          classLevel: key.classLevel,
          testNumber: key.testNumber,
          sectionName: key.sectionName,
        })),
      );
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
          examPattern: examPattern || undefined,
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
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="space-y-1.5">
            <Label htmlFor="scan-test-desktop" className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Test ID
            </Label>
            <Input
              id="scan-test-desktop"
              inputMode="numeric"
              autoComplete="off"
              maxLength={TEST_ID_MAX_LENGTH}
              value={testId}
              disabled={busy}
              placeholder="6–7 digits, as on the OMR"
              className="h-11 rounded-xl px-3.5 text-base tracking-widest tabular-nums"
              onChange={(event) => onTestId?.(testIdInput(event.currentTarget.value))}
            />
            {testHint}
          </div>
          {patternField("scan-pattern-desktop")}
          {failedRollPanel()}
        </div>
        <label
          aria-disabled={!testReady || busy}
          onClick={(event) => {
            if (busy || testReady) return;
            event.preventDefault();
            toast.error(
              checked && !checked.ok
                ? checked.message
                : !patternReady
                  ? "Choose the exam pattern (MPCB, PCB, or MPC)."
                  : "Enter a valid test ID first, then upload.",
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
            {busy
              ? status || "Working…"
              : testReady
                ? "Upload OMR photos or a PDF"
                : checked?.ok
                  ? "Choose the exam pattern to upload"
                  : "Enter the test ID to upload"}
          </p>
          <p className="text-xs text-neutral-500">
            One sheet, a photo batch, or one PDF with up to 500 student sheets (one page each). Large PDFs are
            read on the server in the background — sheets appear as they finish. JPEG, PNG, HEIC, or PDF.
          </p>
        </label>
      </div>
    );
  }

  function openCamera() {
    if (!testComplete) {
      toast.error("Enter the 6-digit test ID from the answer key first.");
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
    if (!patternReady) {
      toast.error("Choose the exam pattern (MPCB, PCB, or MPC).");
      return;
    }
    if (typeof navigator.mediaDevices?.getUserMedia === "function") {
      requestTiltPermission();
      setScannerOpen(true);
    } else cameraRef.current?.click();
  }

  return (
    <div className="space-y-3">
      {scannerOpen ? (
        <DocumentScanner
          onClose={() => setScannerOpen(false)}
          onUnavailable={() => {
            setScannerOpen(false);
            toast.message("Using the phone camera app instead.");
            cameraRef.current?.click();
          }}
          onCapture={(file, cropped) => {
            setScannerOpen(false);
            void submit(file, cropped ? FULL_PAGE_QUAD : undefined);
          }}
        />
      ) : null}
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="space-y-1.5">
          <Label htmlFor="scan-test" className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Test ID
          </Label>
          <Input
            id="scan-test"
            inputMode="numeric"
            autoComplete="off"
            maxLength={TEST_ID_MAX_LENGTH}
            value={testId}
            disabled={busy}
            placeholder="6–7 digits, as on the OMR"
            className="h-11 rounded-xl px-3.5 text-base tracking-widest tabular-nums"
            onChange={(event) => onTestId?.(testIdInput(event.target.value))}
          />
          {testHint}
        </div>
        {patternField("scan-pattern")}
        {failedRollPanel()}
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
        <p className="text-sm font-semibold text-neutral-900">
          {busy
            ? status || "Reading the answers…"
            : testReady
              ? "Scan OMR"
              : checked?.ok
                ? "Choose exam pattern"
                : "Scan OMR"}
        </p>
        {busy ? null : (
          <p className="text-xs text-neutral-500">
            {testReady ? "Tap here to scan the OMR sheet" : "Enter test ID and exam pattern first"}
          </p>
        )}
      </button>
    </div>
  );
}
