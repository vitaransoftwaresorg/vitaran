"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ScanPortal } from "@/services/scans";
import { lookupOmrStudentByRollAction, type OmrStudentMatch } from "./omr-student-actions";
import {
  canRecoverRoll,
  isAmbiguousRollError,
  isDuplicateRollError,
  isStudentMismatchError,
  ROLL_LENGTH,
  rollInput,
} from "./roll-helpers";

type OmrRollRecoveryProps = {
  portal: ScanPortal;
  message: string;
  busy?: boolean;
  schoolId?: string;
  /** Unique id when several recovery forms are on the page (one per duplicate sheet). */
  inputId?: string;
  /** Matches already known from the scan error (same reg at multiple schools). */
  initialMatches?: OmrStudentMatch[];
  initialRollNo?: string;
  onSaveWithRoll: (rollNo: string, schoolId?: string) => void | Promise<void>;
};

function matchLabel(student: OmrStudentMatch) {
  const classLabel = `Class ${student.classLevel}${
    student.sectionName ? `-${student.sectionName}` : ""
  }`;
  const program = student.programName ? ` · ${student.programName}` : "";
  return `${student.name} · ${classLabel}${program} · ${student.schoolName}`;
}

/** Manual registration when bubbles could not be read or a duplicate roll was found. */
export function OmrRollRecovery({
  portal,
  message,
  busy = false,
  schoolId,
  inputId = "omr-recovery-roll",
  initialMatches = [],
  initialRollNo = "",
  onSaveWithRoll,
}: OmrRollRecoveryProps) {
  const recoverable = canRecoverRoll(message);
  const duplicate = isDuplicateRollError(message);
  const mismatch = isStudentMismatchError(message);
  const duplicateRoll =
    message.match(/duplicate registration number\s+(\d+)/i)?.[1] ??
    (initialRollNo.trim() ? rollInput(initialRollNo) : "");
  const ambiguous = isAmbiguousRollError(message) || initialMatches.length > 1;
  // Duplicate / class-program mismatch: leave empty so they type a different reg.
  const seedRoll = duplicate || mismatch ? "" : initialRollNo;
  const [rollNo, setRollNo] = useState(() => rollInput(seedRoll));
  const [matches, setMatches] = useState<OmrStudentMatch[]>(initialMatches);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialMatches.length === 1 ? initialMatches[0]!.id : null,
  );
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const initialKey = `${seedRoll}:${initialMatches.map((row) => row.id).join(",")}`;

  useEffect(() => {
    setRollNo(rollInput(seedRoll));
    setMatches(duplicate || mismatch ? [] : initialMatches);
    setSelectedId(
      !duplicate && !mismatch && initialMatches.length === 1 ? initialMatches[0]!.id : null,
    );
    setLookupError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the scan error / seed list changes
  }, [message, initialKey, duplicate, mismatch]);

  useEffect(() => {
    const roll = rollInput(rollNo);
    if (roll.length !== ROLL_LENGTH) {
      if (initialMatches.length === 0) {
        setMatches([]);
        setSelectedId(null);
        setLookupError(null);
      }
      return;
    }
    // Keep server-provided duplicates until the examiner changes the typed roll.
    if (
      initialMatches.length > 1 &&
      rollInput(initialRollNo) === roll &&
      initialMatches.every((row) => rollInput(row.rollNo) === roll)
    ) {
      setMatches(initialMatches);
      setLookingUp(false);
      setLookupError(null);
      return;
    }
    let live = true;
    setLookingUp(true);
    setLookupError(null);
    const timer = setTimeout(() => {
      void lookupOmrStudentByRollAction(portal, roll, schoolId).then((result) => {
        if (!live) return;
        setLookingUp(false);
        if (result.ok) {
          setMatches(result.students);
          setSelectedId(result.students.length === 1 ? result.students[0]!.id : null);
          setLookupError(null);
        } else {
          setMatches([]);
          setSelectedId(null);
          setLookupError(result.message);
        }
      });
    }, 280);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialMatches via initialKey
  }, [rollNo, portal, schoolId, initialKey]);

  if (!recoverable) return null;

  const rollComplete = rollInput(rollNo).length === ROLL_LENGTH;
  const selected = matches.find((row) => row.id === selectedId) ?? null;
  const canSave =
    Boolean(selected) || (matches.length === 1 && rollComplete && !lookingUp && !lookupError);

  async function save() {
    const roll = rollInput(rollNo);
    if (roll.length !== ROLL_LENGTH) {
      toast.error("Enter the 7-digit registration number");
      return;
    }
    const pick = selected ?? (matches.length === 1 ? matches[0]! : null);
    if (!pick) {
      if (matches.length > 1) {
        toast.error(`Pick one of the ${matches.length} students with this registration`);
        return;
      }
      toast.error(lookupError || "No student found");
      return;
    }
    await onSaveWithRoll(pick.rollNo, pick.schoolId);
  }

  const prompt = ambiguous
    ? `Same reg at ${matches.length || "several"} schools — pick or enter another`
    : duplicate
      ? duplicateRoll
        ? `Duplicate ${duplicateRoll} — enter correct reg`
        : "Duplicate — enter correct reg"
      : mismatch
        ? "Wrong student — enter correct reg"
        : "Enter registration number";

  return (
    <div className="space-y-1 text-amber-950">
      <div className="flex w-full items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          {prompt}
        </label>
        <Input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          maxLength={ROLL_LENGTH}
          value={rollNo}
          disabled={busy}
          placeholder="Enter Reg Number"
          aria-label={prompt}
          className="h-7 w-[40%] max-w-[40%] min-w-0 shrink-0 rounded-md border border-amber-200 bg-white px-2 text-xs tracking-widest tabular-nums"
          onChange={(event) => setRollNo(rollInput(event.currentTarget.value))}
        />
        <Button
          type="button"
          size="sm"
          className="h-7 shrink-0 px-2.5 text-xs"
          disabled={busy || !canSave || lookingUp}
          onClick={() => void save()}
        >
          {busy || lookingUp ? <Loader2 className="size-3 animate-spin" /> : null}
          Save
        </Button>
      </div>
      {lookingUp && rollComplete ? (
        <p className="text-[11px] text-amber-900/60">Looking up…</p>
      ) : matches.length > 1 ? (
        <ul className="max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-amber-200/80 bg-white/80 p-0.5">
          {matches.map((student) => {
            const active = student.id === selectedId;
            return (
              <li key={student.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSelectedId(student.id);
                    setRollNo(rollInput(student.rollNo));
                  }}
                  className={cn(
                    "w-full rounded-md px-2 py-1 text-left text-xs transition",
                    active
                      ? "bg-emerald-100 font-medium text-emerald-950 ring-1 ring-emerald-300"
                      : "text-amber-950 hover:bg-amber-100/80",
                  )}
                >
                  {matchLabel(student)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : matches.length === 1 ? (
        <p className="truncate text-[11px] font-medium text-emerald-900">{matchLabel(matches[0]!)}</p>
      ) : lookupError && rollComplete ? (
        <p className="text-[11px] text-amber-900/80">{shortLookupError(lookupError)}</p>
      ) : null}
    </div>
  );
}

function shortLookupError(message: string) {
  if (/no student/i.test(message)) return "No student with this registration";
  if (/pick a school/i.test(message)) return "School required for lookup";
  if (/matches \d+ students/i.test(message)) return message;
  return message.length > 60 ? `${message.slice(0, 57)}…` : message;
}
