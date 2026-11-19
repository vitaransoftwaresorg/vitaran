"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRegisterInPageBack } from "@/components/layout/in-page-back";
import { Button } from "@/components/ui/button";
import { subjectLabel } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import { commitScanAction } from "./actions";
import { fetchOriginalSheetDirect, fetchPreviewSheetDirect } from "./client-upload";
import { getOmrUploadAuthAction } from "./upload-auth";
import {
  clearScanBatch,
  getPdfJob,
  getScanBatch,
  removeScanBatchAt,
  subscribeScanBatch,
} from "./batch-store";
import type { ScanPortal } from "@/services/scans";
import { formatMarks } from "@/types/scan";

const BASE: Record<ScanPortal, string> = {
  admin: "/admin/omr-scan",
  school: "/school/omr-scan",
  teacher: "/teacher/omr-scan",
};

export function ScanReviewPage({ portal }: { portal: ScanPortal }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const base = BASE[portal];
  const [batch, setBatch] = useState(() => getScanBatch());
  const [pdfJob, setPdfJob] = useState(() => getPdfJob());
  const [saving, startSaving] = useTransition();

  useEffect(
    () =>
      subscribeScanBatch(() => {
        setBatch(getScanBatch());
        setPdfJob(getPdfJob());
      }),
    [],
  );

  const raw = Number(searchParams.get("i") ?? "0");
  const index = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  const active = batch[index] ?? batch[0] ?? null;
  const scan = active?.scan ?? null;
  const resolvedIndex = active ? Math.min(index, batch.length - 1) : 0;

  useEffect(() => {
    if (!batch.length) {
      router.replace(base);
      return;
    }
    if (index >= batch.length) {
      router.replace(`${base}/review?i=${batch.length - 1}`);
    }
  }, [batch, index, router, base]);

  // A PDF still being read can have one sheet so far; it is still a batch.
  const single = batch.length === 1 && !pdfJob;

  const goBack = useCallback(() => {
    if (single) clearScanBatch();
    router.push(base);
  }, [single, router, base]);
  useRegisterInPageBack(goBack);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= batch.length) return;
      router.replace(`${base}/review?i=${next}`, { scroll: false });
    },
    [batch.length, router, base],
  );

  // Left / right arrow keys move between sheets too (not while typing in a field).
  useEffect(() => {
    if (single) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]") || saving) return;
      if (event.key === "ArrowLeft") goTo(resolvedIndex - 1);
      if (event.key === "ArrowRight") goTo(resolvedIndex + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [single, saving, goTo, resolvedIndex]);

  function saveOne() {
    if (!active) return;
    startSaving(async () => {
      const result = await commitScanAction(portal, active.previewId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        `Saved ${result.scan.student.name} · ${formatMarks(result.scan.total)}/${formatMarks(result.scan.maxTotal)}`,
      );
      const remaining = removeScanBatchAt(resolvedIndex);
      router.refresh();
      if (!remaining.length) {
        router.push(base);
        return;
      }
      const nextIndex = Math.min(resolvedIndex, remaining.length - 1);
      router.replace(`${base}/review?i=${nextIndex}`);
    });
  }

  if (!scan) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        No sheet to review.{" "}
        <Link href={base} className="font-semibold text-brand-800 underline-offset-2 hover:underline">
          Back to OMR Scan
        </Link>
      </div>
    );
  }

  // Partial credit only exists for multi-correct MCQ keys (e.g. B/C).
  const showPartial = keyHasMultiCorrect(scan.keyAnswers);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">Check then save</p>
            <p className="mt-1 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">Student Name</p>
            <h1 className="text-2xl font-bold text-neutral-950">{scan.student.name}</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Registration no {scan.student.rollNo} · {scan.student.schoolName} · {scan.student.programName} ·
              Class {scan.student.classLevel}-{scan.student.sectionName?.trim() || "A"} · Test No{" "}
              {scan.testNumber} · Test ID {scan.testId}
              {scan.examDate ? ` · ${scan.examDate}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">Score vs Total</p>
            <p className="text-4xl font-bold tabular-nums text-brand-900">
              {formatMarks(scan.total)}
              <span className="text-lg font-semibold text-neutral-500">/{formatMarks(scan.maxTotal)}</span>
            </p>
          </div>
        </header>

        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {active ? (
            <SheetImage key={active.previewId} portal={portal} previewId={active.previewId} marked={scan.sheetImage} />
          ) : null}

          <div className="space-y-4">
            <dl
              className={cn(
                "grid grid-cols-2 gap-2 text-center text-sm",
                showPartial ? "sm:grid-cols-4" : "sm:grid-cols-3",
              )}
            >
              <Stat label="Correct" value={scan.correct} />
              {showPartial ? <Stat label="Partial" value={scan.partial ?? 0} /> : null}
              <Stat label="Wrong" value={scan.wrong} />
              <Stat label="Un-attempted" value={scan.blank} />
            </dl>
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {scan.subjectScores.map((row) => (
                <li key={`${row.subject}-${row.from}`} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{subjectLabel(row.subject)}</p>
                    <p className="text-sm font-bold tabular-nums">
                      {formatMarks(row.total)}/{formatMarks(row.maxTotal)}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold tabular-nums">
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                      Correct {row.correct}
                    </span>
                    {showPartial ? (
                      <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-yellow-800">
                        Partial {row.partial ?? 0}
                      </span>
                    ) : null}
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                      Wrong {row.wrong}
                    </span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">
                      Un-attempted {row.blank}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <AnswerGrid answers={scan.answers ?? {}} keyAnswers={scan.keyAnswers} ranges={scan.subjectScores} />
            <FlagGroups flags={scan.flags} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" onClick={saveOne} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Check />}
                {single ? "OK, save" : "Save this sheet"}
              </Button>
              {single ? (
                <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
                  <Camera />
                  Scan again
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9"
                    aria-label="Previous sheet"
                    disabled={saving || resolvedIndex === 0}
                    onClick={() => goTo(resolvedIndex - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9"
                    aria-label="Next sheet"
                    disabled={saving || resolvedIndex >= batch.length - 1}
                    onClick={() => goTo(resolvedIndex + 1)}
                  >
                    <ChevronRight />
                  </Button>
                  <span className="self-center text-sm text-neutral-600 tabular-nums">
                    Sheet {resolvedIndex + 1} of {batch.length}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Original uploads fetched once per sheet; kept while the batch is open. */
const originals = new Map<string, string>();

/** Marked sheet (answers checked against the key) or the photo / PDF page exactly as uploaded. */
function SheetImage({ portal, previewId, marked }: { portal: ScanPortal; previewId: string; marked?: string }) {
  const [view, setView] = useState<"marked" | "original">("marked");
  const [markedUrl, setMarkedUrl] = useState(marked ?? null);
  const [original, setOriginal] = useState(() => originals.get(previewId) ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (marked) {
      setMarkedUrl(marked);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const auth = await getOmrUploadAuthAction(portal);
        if (!auth.ok || cancelled) return;
        const url = await fetchPreviewSheetDirect(auth.previewsUrl, auth.token, previewId, "preview");
        if (!cancelled) setMarkedUrl(url);
      } catch {
        // Placeholder stays until user retries via Original/Evaluated.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portal, previewId, marked]);

  async function showOriginal() {
    setView("original");
    if (original) return;
    setLoading(true);
    try {
      const auth = await getOmrUploadAuthAction(portal);
      if (!auth.ok) throw new Error(auth.message);
      const url = await fetchOriginalSheetDirect(auth.previewsUrl, auth.token, previewId);
      originals.set(previewId, url);
      setOriginal(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the original OMR.");
      setView("marked");
    } finally {
      setLoading(false);
    }
  }

  const src = view === "original" ? original : markedUrl;
  const tab = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
      active ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-800",
    );
  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg bg-neutral-200/70 p-0.5">
          <button type="button" className={tab(view === "marked")} onClick={() => setView("marked")}>
            Evaluated
          </button>
          <button type="button" className={tab(view === "original")} onClick={() => void showOriginal()}>
            Original OMR
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-brand-700" />
        </div>
      ) : src ? (
        <img
          src={src}
          alt={view === "original" ? "Original OMR sheet" : "Evaluated OMR sheet"}
          className="mx-auto max-h-[70vh] w-full object-contain"
        />
      ) : (
        <p className="p-8 text-center text-sm text-neutral-500">No sheet image</p>
      )}
    </div>
  );
}

function FlagGroups({ flags }: { flags: Array<{ question: number; reason: string }> }) {
  const faint = flags.filter((flag) => flag.reason.startsWith("Faint mark"));
  const multi = flags.filter((flag) => flag.reason.startsWith("More than one"));
  const blank = flags.filter((flag) => flag.reason === "Un-attempted");
  const other = flags.filter((flag) => !faint.includes(flag) && !multi.includes(flag) && !blank.includes(flag));
  if (!flags.length) return null;
  return (
    <div className="space-y-2">
      {faint.length > 0 ? (
        <div className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <p className="font-semibold">Faint marks — check on the sheet ({faint.length})</p>
          <p className="mt-1">{faint.map((flag) => flag.reason.replace("Faint mark on ", `Q${flag.question} `).replace(" — please check", "")).join(", ")}</p>
        </div>
      ) : null}
      {multi.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">More than one option filled ({multi.length})</p>
          <p className="mt-1">{multi.map((flag) => `Q${flag.question}`).join(", ")}</p>
        </div>
      ) : null}
      {blank.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Un-attempted ({blank.length})</p>
          <p className="mt-1">{blank.map((flag) => `Q${flag.question}`).join(", ")}</p>
        </div>
      ) : null}
      {other.length > 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          <p className="font-semibold">Needs review ({other.length})</p>
          <p className="mt-1">{other.map((flag) => `Q${flag.question}: ${flag.reason}`).join(", ")}</p>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}

type AnswerTone = "correct" | "wrong" | "partial" | "blank" | "plain";

function keyHasMultiCorrect(keyAnswers?: Record<string, string>) {
  if (!keyAnswers) return false;
  return Object.values(keyAnswers).some((answer) => {
    if (!answer || answer === "ADD") return false;
    const options = answer.split("/").filter((part) => part === "A" || part === "B" || part === "C" || part === "D");
    return options.length > 1;
  });
}

function answerTone(marked: Array<"A" | "B" | "C" | "D">, expected?: string): AnswerTone {
  if (!expected) return marked.length === 0 ? "blank" : "plain";
  if (marked.length === 0) return "blank";
  if (expected === "ADD") return "correct";
  const wanted = expected.split("/").filter((part) => part === "A" || part === "B" || part === "C" || part === "D");
  if (wanted.length === 0) return "plain";
  // Equal share per key option; wrong options add 0 and do not cancel correct ones.
  const hit = wanted.filter((option) => marked.includes(option)).length;
  if (hit === wanted.length) return "correct";
  if (hit > 0 && wanted.length > 1) return "partial";
  return "wrong";
}

function AnswerGrid({
  answers,
  keyAnswers,
  ranges,
}: {
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  keyAnswers?: Record<string, string>;
  ranges: Array<{ from: number; to: number }>;
}) {
  const showPartial = keyHasMultiCorrect(keyAnswers);
  const onPaper = (question: number) =>
    ranges.length === 0 || ranges.some((range) => question >= range.from && question <= range.to);
  /** Same 9-column integrated table as portal answer keys (column-major). */
  const columns = 9;
  const questions = Array.from({ length: 100 }, (_, index) => index + 1).filter(onPaper);
  const rows = Math.max(1, Math.ceil(Math.max(questions.length, 1) / columns));
  const cellAt = (row: number, col: number) => {
    const index = col * rows + row;
    if (index >= questions.length) return null;
    return questions[index]!;
  };
  return (
    <div className="overflow-hidden rounded-xl border border-brand-200 bg-white">
      <header className="border-b border-brand-100 bg-brand-50/60 px-3 py-2.5">
        <p className="text-sm font-bold text-brand-950">Read vs answer key</p>
        <p className="text-xs text-neutral-500">
          {showPartial
            ? "Green = correct, yellow = partial, red = wrong, amber = blank. Multi-correct keys split marks equally per option."
            : "Green = correct, red = wrong, amber = blank."}
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row}>
                {Array.from({ length: columns }, (_, col) => {
                  const question = cellAt(row, col);
                  if (question == null) {
                    return (
                      <td key={col} className="border border-neutral-300 px-2 py-1.5" />
                    );
                  }
                  const marked = answers[String(question)] ?? [];
                  const expected = keyAnswers?.[String(question)];
                  const tone = answerTone(marked, expected);
                  const toneClass =
                    tone === "correct"
                      ? "text-emerald-800"
                      : tone === "partial"
                        ? "text-yellow-700"
                        : tone === "wrong"
                          ? "text-red-800"
                          : tone === "blank"
                            ? "text-amber-800"
                            : "text-neutral-900";
                  return (
                    <td
                      key={col}
                      className={cn(
                        "border border-neutral-300 px-2 py-1.5 text-center align-middle tabular-nums",
                        toneClass,
                      )}
                    >
                      <span className="inline-flex items-baseline justify-center gap-1.5">
                        <span className="text-xs font-semibold opacity-70">{question}</span>
                        <span className="text-sm font-bold">
                          {tone === "blank" ? "—" : marked.join("")}
                        </span>
                        {(tone === "wrong" || tone === "partial") && expected ? (
                          <span className="text-[10px] font-semibold text-neutral-400">{expected}</span>
                        ) : null}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
