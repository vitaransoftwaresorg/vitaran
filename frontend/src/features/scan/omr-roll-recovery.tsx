"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScanPortal } from "@/services/scans";
import { lookupOmrStudentByRollAction, type OmrStudentMatch } from "./omr-student-actions";
import {
  canRecoverRoll,
  isDuplicateRollError,
  ROLL_LENGTH,
  rollInput,
} from "./roll-helpers";

type OmrRollRecoveryProps = {
  portal: ScanPortal;
  message: string;
  busy?: boolean;
  schoolId?: string;
  onSaveWithRoll: (rollNo: string) => void | Promise<void>;
};

/** Manual registration when bubbles could not be read or a duplicate roll was found. */
export function OmrRollRecovery({
  portal,
  message,
  busy = false,
  schoolId,
  onSaveWithRoll,
}: OmrRollRecoveryProps) {
  const recoverable = canRecoverRoll(message);
  const duplicate = isDuplicateRollError(message);
  const [rollNo, setRollNo] = useState("");
  const [match, setMatch] = useState<OmrStudentMatch | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    setRollNo("");
    setMatch(null);
    setLookupError(null);
  }, [message]);

  useEffect(() => {
    const roll = rollInput(rollNo);
    if (roll.length !== ROLL_LENGTH) {
      setMatch(null);
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
          setMatch(result.student);
          setLookupError(null);
        } else {
          setMatch(null);
          setLookupError(result.message);
        }
      });
    }, 280);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [rollNo, portal, schoolId]);

  if (!recoverable) return null;

  const rollComplete = rollInput(rollNo).length === ROLL_LENGTH;

  async function save() {
    const roll = rollInput(rollNo);
    if (roll.length !== ROLL_LENGTH) {
      toast.error("Enter the 7-digit registration number");
      return;
    }
    if (!match) {
      toast.error(lookupError || "No student found");
      return;
    }
    await onSaveWithRoll(roll);
  }

  const classLabel = match
    ? `Class ${match.classLevel}${match.sectionName ? `-${match.sectionName}` : ""}`
    : null;

  return (
    <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-sm text-amber-950">
      <p className="text-xs font-medium text-amber-900/90">
        {duplicate
          ? "Duplicate registration — enter the correct one:"
          : "Couldn’t read registration — enter it:"}
      </p>
      <div className="flex gap-2">
        <Input
          id="omr-recovery-roll"
          inputMode="numeric"
          autoComplete="off"
          maxLength={ROLL_LENGTH}
          value={rollNo}
          disabled={busy}
          placeholder="7-digit reg"
          aria-label="Registration number"
          className="h-9 flex-1 rounded-lg border-amber-200 bg-white px-2.5 text-sm tracking-widest tabular-nums"
          onChange={(event) => setRollNo(rollInput(event.currentTarget.value))}
        />
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0"
          disabled={busy || !match || lookingUp}
          onClick={() => void save()}
        >
          {busy || lookingUp ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save
        </Button>
      </div>
      {lookingUp && rollComplete ? (
        <p className="text-[11px] text-amber-900/60">Looking up…</p>
      ) : match ? (
        <p className="truncate text-xs font-medium text-emerald-900">
          {match.name}
          <span className="font-normal text-emerald-900/70"> · {classLabel}</span>
        </p>
      ) : lookupError && rollComplete ? (
        <p className="text-[11px] text-amber-900/80">{shortLookupError(lookupError)}</p>
      ) : null}
    </div>
  );
}

function shortLookupError(message: string) {
  if (/no student/i.test(message)) return "No student with this registration";
  if (/pick a school/i.test(message)) return "School required for lookup";
  return message.length > 60 ? `${message.slice(0, 57)}…` : message;
}
