"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, XCircle } from "lucide-react";
import { documentAnswersHref } from "@/features/documents/constants";
import { programLabel } from "@/features/schools/constants";
import type { TestIdAvailability } from "@/types/answer-key";
import { checkAnswerKeyTestIdAction } from "./actions";
import { ANSWER_KEYS_PATH } from "./constants";
import { TEST_ID_LENGTH, TEST_ID_PATTERN } from "./test-id";

type CheckResult = { value: string } & (({ ok: true } & TestIdAvailability) | { ok: false; message: string });

export type TestIdCheck =
  | { state: "empty" | "typing" | "checking" }
  | { state: "available" }
  | { state: "taken"; usedBy: NonNullable<TestIdAvailability["usedBy"]> }
  | { state: "error"; message: string };

/**
 * Checks a test ID against existing answer keys as soon as all 6 digits are in.
 * `exceptId` is the key being edited, so its own ID is not reported as taken.
 */
export function useTestIdCheck(testId: string, exceptId?: string): TestIdCheck {
  const value = testId.trim();
  const complete = TEST_ID_PATTERN.test(value);
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    if (!complete) return;
    let live = true;
    const timer = window.setTimeout(() => {
      void checkAnswerKeyTestIdAction(value, exceptId).then((next) => {
        if (live) setResult({ value, ...next });
      });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [value, complete, exceptId]);

  if (!value) return { state: "empty" };
  if (!complete) return { state: "typing" };
  if (result?.value !== value) return { state: "checking" };
  if (!result.ok) return { state: "error", message: result.message };
  return result.available || !result.usedBy ? { state: "available" } : { state: "taken", usedBy: result.usedBy };
}

export function TestIdStatus({ check, length }: { check: TestIdCheck; length: number }) {
  switch (check.state) {
    case "empty":
      return <p className="text-xs text-neutral-500">Enter the 6-digit test ID printed on the OMR sheets.</p>;
    case "typing":
      return (
        <p className="text-xs text-neutral-500 tabular-nums">
          Enter all 6 digits ({length}/{TEST_ID_LENGTH})
        </p>
      );
    case "checking":
      return (
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Loader2 className="size-3.5 animate-spin" />
          Checking…
        </p>
      );
    case "available":
      return null;
    case "error":
      return <p className="text-xs font-medium text-red-700">{check.message}</p>;
    case "taken": {
      const { usedBy } = check;
      const where = [
        programLabel(usedBy.program),
        `Class ${usedBy.classLevel}`,
        `Test ${usedBy.testNumber}`,
        usedBy.school,
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        <p className="flex items-start gap-1.5 text-xs font-medium text-red-700">
          <XCircle className="mt-px size-3.5 shrink-0" />
          <span>
            Already used by{" "}
            <Link href={documentAnswersHref(ANSWER_KEYS_PATH, usedBy.id)} className="font-semibold underline">
              {where}
            </Link>
            . Use a different test ID.
          </span>
        </p>
      );
    }
  }
}
