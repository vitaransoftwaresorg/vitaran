"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subjectLabel } from "@/features/schools/constants";
import { commitScanAction, previewScanAction } from "./actions";
import { ScanCamera } from "./camera";
import type { ScanPortal } from "@/services/scans";
import type { OmScan, ScanPreview } from "@/types/scan";

export function ScanBoard({ portal, initial }: { portal: ScanPortal; initial: OmScan[] }) {
  const [scans, setScans] = useState(initial);
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [queued, setQueued] = useState(0);
  const [cameraKey, setCameraKey] = useState(0);
  const [rollNo, setRollNo] = useState("");
  const [testId, setTestId] = useState("");
  const [saving, startSaving] = useTransition();
  const restRef = useRef<File[]>([]);

  function onScanned(result: ScanPreview) {
    setPreview(result);
  }

  function onQueued(files: File[]) {
    restRef.current = files;
    setQueued(files.length);
  }

  async function readNext(): Promise<boolean> {
    while (restRef.current.length) {
      const next = restRef.current.shift();
      setQueued(restRef.current.length);
      if (!next) break;
      const form = new FormData();
      form.append("file", next);
      const result = await previewScanAction(portal, form);
      if (result.ok) {
        setPreview(result.result);
        return true;
      }
      toast.error(result.message);
    }
    setPreview(null);
    setCameraKey((key) => key + 1);
    return false;
  }

  function scanAgain() {
    startSaving(async () => {
      await readNext();
    });
  }

  function save() {
    if (!preview) return;
    startSaving(async () => {
      const result = await commitScanAction(portal, preview.previewId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setScans((prev) => [result.scan, ...prev.filter((row) => row.id !== result.scan.id)]);
      toast.success(`Saved ${result.scan.student.name} · ${result.scan.total}/${result.scan.maxTotal}`);
      setRollNo("");
      await readNext();
    });
  }

  const scan = preview?.scan;

  return (
    <div className={preview ? "space-y-4" : "grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"}>
      {!preview ? (
        <ScanCamera
          key={cameraKey}
          onScanned={onScanned}
          onQueued={onQueued}
          scanAction={(form) => previewScanAction(portal, form)}
          rollNo={rollNo}
          testId={testId}
          onRollNo={setRollNo}
          onTestId={setTestId}
        />
      ) : null}

      <div className="space-y-4">
        {scan ? (
          <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {scan.sheetImage ? (
              <img
                src={scan.sheetImage}
                alt="Scanned OMR sheet"
                className="max-h-[48rem] w-full rounded-xl border border-neutral-200 object-contain bg-neutral-50"
              />
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">
                  Check then save{queued ? ` · ${queued} more in the batch` : ""}
                </p>
                <h2 className="text-xl font-bold text-neutral-950">{scan.student.name}</h2>
                <p className="text-sm text-neutral-600">
                  Registration no {scan.student.rollNo} · {scan.student.schoolName} · {scan.student.programName} ·
                  Class {scan.student.classLevel}
                  {scan.student.sectionName ? `-${scan.student.sectionName}` : ""} · Test ID {scan.testId}
                  {scan.examDate ? ` · ${scan.examDate}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">Score vs key</p>
                <p className="text-3xl font-bold tabular-nums text-brand-900">
                  {scan.total}
                  <span className="text-base font-semibold text-neutral-500">/{scan.maxTotal}</span>
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <Stat label="Match key" value={scan.correct} />
              <Stat label="Different from key" value={scan.wrong} />
              <Stat label="Blank" value={scan.blank} />
            </dl>
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {scan.subjectScores.map((row) => (
                <li key={`${row.subject}-${row.from}`} className="flex items-center justify-between px-4 py-2.5">
                  <p className="text-sm font-semibold">{subjectLabel(row.subject)}</p>
                  <p className="text-sm font-bold tabular-nums">
                    {row.total}/{row.maxTotal}
                  </p>
                </li>
              ))}
            </ul>
            <AnswerGrid answers={scan.answers ?? {}} keyAnswers={scan.keyAnswers} />
            {scan.flags.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Un-attempted ({scan.flags.length})</p>
                <p className="mt-1">{scan.flags.map((flag) => `Q${flag.question}`).join(", ")}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Check />}
                OK, save
              </Button>
              <Button type="button" variant="outline" onClick={scanAgain} disabled={saving}>
                <RotateCcw />
                Scan again
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            On a phone, enter the registration number and test ID, tap Scan OMR, then check the 100 answers and
            save. On a computer, upload a photo.
          </p>
        )}

        {scans.length > 0 && (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            {scans.slice(0, 8).map((row) => (
              <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-neutral-900">{row.student.name}</p>
                  <p className="text-xs text-neutral-500">
                    {row.student.rollNo} · Test ID {row.testId}
                  </p>
                </div>
                <p className="font-bold tabular-nums">
                  {row.total}/{row.maxTotal}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
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
}: {
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  keyAnswers?: Record<string, string>;
}) {
  const cells = Array.from({ length: 20 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => col * 20 + row + 1),
  ).flat();
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <p className="mb-1 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Read vs answer key</p>
      <p className="mb-2 text-[10px] text-neutral-500">
        Same 5 columns as the sheet. The letter is what we read. Green matches the key, red is wrong (wrong option, or more than one bubble when the key is a single answer), amber is blank.
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
          const marked = answers[String(question)] ?? [];
          const expected = keyAnswers?.[String(question)];
          const blank = marked.length === 0;
          const match = matchesKey(marked, expected);
          const tone =
            match === true ? "text-emerald-800" : match === false && !blank ? "text-red-800" : blank ? "text-amber-800" : "text-neutral-900";
          return (
            <li key={question} className={tone}>
              {question}. {blank ? "—" : marked.join("")}
              {match === false && expected ? <span className="text-[10px] text-neutral-400"> {expected}</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
