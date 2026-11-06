"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subjectLabel } from "@/features/schools/constants";
import { commitScanAction } from "./actions";
import { getScanBatch, removeScanBatchAt, subscribeScanBatch } from "./batch-store";
import type { ScanPortal } from "@/services/scans";

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
  const [saving, startSaving] = useTransition();

  useEffect(() => subscribeScanBatch(() => setBatch(getScanBatch())), []);

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

  function goBack() {
    router.push(base);
  }

  function saveOne() {
    if (!active) return;
    startSaving(async () => {
      const result = await commitScanAction(portal, active.previewId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        `Saved ${result.scan.student.name} · ${result.scan.total}/${result.scan.maxTotal}`,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={goBack}>
          <ArrowLeft />
          Back to list
        </Button>
        <p className="text-sm text-neutral-600">
          Sheet {resolvedIndex + 1} of {batch.length}
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">Check then save</p>
            <h1 className="text-2xl font-bold text-neutral-950">{scan.student.name}</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Registration no {scan.student.rollNo} · {scan.student.schoolName} · {scan.student.programName} ·
              Class {scan.student.classLevel}-{scan.student.sectionName?.trim() || "A"} · Test ID {scan.testId}
              {scan.examDate ? ` · ${scan.examDate}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">Score vs key</p>
            <p className="text-4xl font-bold tabular-nums text-brand-900">
              {scan.total}
              <span className="text-lg font-semibold text-neutral-500">/{scan.maxTotal}</span>
            </p>
          </div>
        </header>

        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2">
            {scan.sheetImage ? (
              <img
                src={scan.sheetImage}
                alt="Scanned OMR sheet"
                className="mx-auto max-h-[70vh] w-full object-contain"
              />
            ) : (
              <p className="p-8 text-center text-sm text-neutral-500">No sheet image</p>
            )}
          </div>

          <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <Stat label="Correct" value={scan.correct} />
              <Stat label="Wrong" value={scan.wrong} />
              <Stat label="Un-attempted" value={scan.blank} />
            </dl>
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {scan.subjectScores.map((row) => (
                <li key={`${row.subject}-${row.from}`} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{subjectLabel(row.subject)}</p>
                    <p className="text-sm font-bold tabular-nums">
                      {row.total}/{row.maxTotal}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold tabular-nums">
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                      Correct {row.correct}
                    </span>
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">Wrong {row.wrong}</span>
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
                {batch.length > 1 ? "Save this sheet" : "OK, save"}
              </Button>
              <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
                <RotateCcw />
                Back to list
              </Button>
            </div>
          </div>
        </div>
      </section>
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

function matchesKey(marked: Array<"A" | "B" | "C" | "D">, expected?: string) {
  if (!expected) return null;
  if (expected === "ADD") return marked.length > 0;
  const wanted = expected.split("/").filter((part) => part === "A" || part === "B" || part === "C" || part === "D");
  if (marked.length === 0 || wanted.length === 0) return false;
  if (wanted.length === 1) return marked.length === 1 && marked[0] === wanted[0];
  return [...marked].sort().join("") === [...wanted].sort().join("");
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
  const onPaper = (question: number) =>
    ranges.length === 0 || ranges.some((range) => question >= range.from && question <= range.to);
  const cells = Array.from({ length: 20 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => col * 20 + row + 1),
  ).flat();
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <p className="mb-1 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Read vs answer key</p>
      <p className="mb-2 text-[10px] text-neutral-500">
        Same 5 columns as the sheet. Green matches the key, red is wrong, amber is blank.
      </p>
      <div className="mb-1 grid grid-cols-5 gap-x-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
        <span>1–20</span>
        <span>21–40</span>
        <span>41–60</span>
        <span>61–80</span>
        <span>81–100</span>
      </div>
      <ol className="grid grid-cols-5 gap-x-2 gap-y-1 font-mono text-xs">
        {cells.map((question) => {
          if (!onPaper(question)) {
            return (
              <li key={question} className="text-neutral-300" title="Not part of this test">
                {question}. ·
              </li>
            );
          }
          const marked = answers[String(question)] ?? [];
          const expected = keyAnswers?.[String(question)];
          const blank = marked.length === 0;
          const match = matchesKey(marked, expected);
          const tone =
            match === true
              ? "text-emerald-800"
              : match === false && !blank
                ? "text-red-800"
                : blank
                  ? "text-amber-800"
                  : "text-neutral-900";
          return (
            <li key={question} className={tone}>
              {question}. {blank ? "—" : marked.join("")}
              {match === false && expected ? (
                <span className="text-[10px] text-neutral-400"> {expected}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
