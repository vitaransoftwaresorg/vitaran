"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useLiveContent } from "@/features/live/use-live-content";
import type { AnswerKeyDetail } from "@/types/answer-key";
import type { AnswerKeyObjection } from "@/types/answer-key-objection";
import { AnswerKeyPdfActions } from "./answer-key-pdf-actions";
import { AnswerKeyPortalView } from "./answer-key-portal-view";
import { SCHOOL_ANSWER_KEYS_PATH, TEACHER_ANSWER_KEYS_PATH } from "./constants";
import { listPortalObjectionsAction } from "./objection-actions";
import { loadSchoolAnswerKeyAction, loadTeacherAnswerKeyAction } from "./portal-answer-keys-action";
import { RaiseObjectionDialog } from "./raise-objection-dialog";

type LiveAnswerKeyViewerProps = {
  role: "school" | "teacher";
  answerKey: AnswerKeyDetail;
};

/** School / teacher — read-only key view with per-question objections. */
export function LiveAnswerKeyViewer({ role, answerKey }: LiveAnswerKeyViewerProps) {
  const [current, setCurrent] = useState(answerKey);
  const [objections, setObjections] = useState<AnswerKeyObjection[]>([]);
  const [raiseQuestion, setRaiseQuestion] = useState<number | null>(null);
  const [, startReload] = useTransition();

  const apply = useCallback((next: AnswerKeyDetail) => {
    setCurrent((prev) => {
      if (prev.updatedAt === next.updatedAt) return prev;
      toast.message("Answer key updated");
      return next;
    });
  }, []);

  const reloadObjections = useCallback(() => {
    startReload(async () => {
      setObjections(await listPortalObjectionsAction(role, answerKey.id));
    });
  }, [answerKey.id, role]);

  const reload = useCallback(() => {
    startReload(async () => {
      const next =
        role === "school"
          ? await loadSchoolAnswerKeyAction(answerKey.id)
          : await loadTeacherAnswerKeyAction(answerKey.id);
      if (next) apply(next);
    });
  }, [apply, answerKey.id, role]);

  useLiveContent("answer-keys", reload);
  useLiveContent("objections", reloadObjections);

  useEffect(() => {
    setCurrent(answerKey);
  }, [answerKey]);

  useEffect(() => {
    reloadObjections();
  }, [reloadObjections]);

  const openCount = objections.filter((row) => row.status === "OPEN").length;
  const questionCount =
    current.subjectRanges.length > 0
      ? current.subjectRanges.reduce(
          (sum, range) => sum + Math.max(0, range.to - range.from + 1),
          0,
        )
      : Object.keys(current.answers).length;

  const meta = [
    { label: "Test", value: String(current.testNumber) },
    ...(current.testId ? [{ label: "Test ID", value: current.testId }] : []),
    { label: "Class", value: String(current.classLevel) },
    { label: "Questions", value: String(questionCount) },
    { label: "Correct", value: `+${current.correctMarks}` },
    { label: "Wrong", value: `−${current.wrongMarks}` },
  ];

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-brand-200 bg-white px-3 py-3 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)] sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
              Answer key
            </p>
            {openCount > 0 ? (
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                {openCount} open
              </span>
            ) : null}
          </div>
          <AnswerKeyPdfActions
            basePath={role === "school" ? SCHOOL_ANSWER_KEYS_PATH : TEACHER_ANSWER_KEYS_PATH}
            id={current.id}
            disabled={Object.keys(current.answers).length === 0}
            className="w-full sm:w-auto"
          />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
          {meta.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                {item.label}
              </dt>
              <dd className="truncate text-sm font-bold text-neutral-950 tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <AnswerKeyPortalView
        key={current.updatedAt}
        answerKey={current}
        role={role}
        objections={objections}
        onRaiseObjection={setRaiseQuestion}
      />

      <RaiseObjectionDialog
        key={raiseQuestion ?? "closed"}
        open={raiseQuestion != null}
        onOpenChange={(open) => {
          if (!open) setRaiseQuestion(null);
        }}
        role={role}
        answerKeyId={answerKey.id}
        questionNumber={raiseQuestion}
        currentAnswer={
          raiseQuestion != null ? current.answers[String(raiseQuestion)] ?? null : null
        }
        onRaised={reloadObjections}
      />
    </div>
  );
}
