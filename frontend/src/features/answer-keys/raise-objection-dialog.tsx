"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Camera, ImagePlus, Loader2, MessageSquareWarning, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AnswerOption, KeyAnswer } from "@/types/answer-key";
import { isBonusKey, keyOptions } from "@/types/answer-key";
import type { ProposedObjectionAnswer } from "@/types/answer-key-objection";
import { raisePortalObjectionAction } from "./objection-actions";

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

type RaiseObjectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "school" | "teacher";
  answerKeyId: string;
  /** When set from a question row, the dialog is locked to that question. */
  questionNumber?: number | null;
  /** Published key for this question — shown as “present options”. */
  currentAnswer?: KeyAnswer | null;
  onRaised?: () => void;
};

function formatKey(answer: KeyAnswer | null | undefined) {
  if (!answer) return "Not set";
  if (answer === "ADD") return "ADD marks";
  return answer;
}

function composeProposed(
  options: AnswerOption[],
  bonus: boolean,
  none: boolean,
): ProposedObjectionAnswer | null {
  if (none) return "NONE";
  if (bonus) return "ADD";
  if (options.length === 0) return null;
  if (options.length === 1) return options[0]!;
  return [...options].sort().join("/") as ProposedObjectionAnswer;
}

function objectionPlaceholder(
  options: AnswerOption[],
  bonus: boolean,
  none: boolean,
  published: KeyAnswer | null | undefined,
) {
  const publishedLabel = !published
    ? "not set"
    : published === "ADD"
      ? "ADD marks"
      : published;
  if (none) {
    return `Why none of the options (published ${publishedLabel}) should be correct…`;
  }
  if (bonus) {
    return `Why this question should give ADD marks instead of ${publishedLabel}…`;
  }
  if (options.length > 0) {
    const claim = [...options].sort().join("/");
    return `Why ${claim} should be correct instead of ${publishedLabel}…`;
  }
  return "Select what you think is correct, then explain why…";
}

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Shrinks phone photos to a 1600px JPEG before upload; falls back to the original file. */
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function RaiseObjectionDialog({
  open,
  onOpenChange,
  role,
  answerKeyId,
  questionNumber: lockedQuestion = null,
  currentAnswer = null,
  onRaised,
}: RaiseObjectionDialogProps) {
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<AnswerOption[]>([]);
  const [bonus, setBonus] = useState(false);
  const [none, setNone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Attach an image (photo or screenshot).");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("Image is too large (max 10 MB).");
      return;
    }
    setError(null);
    setImage(file);
  }
  const questionLocked = lockedQuestion != null;
  const presentOptions = keyOptions(currentAnswer ?? undefined);
  const presentBonus = isBonusKey(currentAnswer ?? undefined);

  function reset() {
    setMessage("");
    setPicked([]);
    setBonus(false);
    setNone(false);
    setError(null);
    setImage(null);
  }

  function toggleOption(option: AnswerOption) {
    setNone(false);
    setBonus(false);
    if (picked.includes(option)) {
      setPicked(picked.filter((row) => row !== option));
      setError(null);
      return;
    }
    if (picked.length >= 2) {
      setError("You can select at most 2 options as correct.");
      return;
    }
    setPicked([...picked, option]);
    setError(null);
  }

  function toggleBonus() {
    setNone(false);
    setPicked([]);
    setBonus((current) => !current);
    setError(null);
  }

  function toggleNone() {
    setPicked([]);
    setBonus(false);
    setNone((current) => !current);
    setError(null);
  }

  function submit() {
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      setError("Explain the objection (at least 5 characters).");
      return;
    }
    const proposedAnswer = composeProposed(picked, bonus, none);
    if (questionLocked && !proposedAnswer) {
      setError("Select what you think is correct (options, ADD, or no right answer).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("message", trimmed);
      if (lockedQuestion != null) form.set("questionNumber", String(lockedQuestion));
      if (proposedAnswer) form.set("proposedAnswer", proposedAnswer);
      if (image) form.set("image", await shrinkImage(image), "objection.jpg");
      const result = await raisePortalObjectionAction(role, answerKeyId, form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Objection submitted");
      reset();
      onOpenChange(false);
      onRaised?.();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) {
          reset();
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent className="gap-3 sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {questionLocked ? `Object to Q${lockedQuestion}` : "Raise objection"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            See the published key, then select what you believe is correct — up to 2 options, ADD
            marks, or no right answer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3">
          {questionLocked ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                Present key
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {OPTIONS.map((option) => {
                  const on = presentOptions.includes(option);
                  return (
                    <span
                      key={option}
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-md text-xs font-bold",
                        on
                          ? "bg-brand-900 text-white"
                          : "border border-neutral-200 bg-neutral-50 text-neutral-400",
                      )}
                    >
                      {option}
                    </span>
                  );
                })}
                <span
                  className={cn(
                    "inline-flex h-8 items-center rounded-md px-2 text-[11px] font-bold",
                    presentBonus
                      ? "bg-sky-700 text-white"
                      : "border border-neutral-200 bg-neutral-50 text-neutral-400",
                  )}
                >
                  ADD
                </span>
                {!currentAnswer ? (
                  <span className="text-xs font-semibold text-amber-700">Not set</span>
                ) : null}
              </div>
              <p className="text-xs text-neutral-500">
                Published as <span className="font-semibold text-neutral-800">{formatKey(currentAnswer)}</span>
              </p>
            </div>
          ) : null}

          <Field data-invalid={error ? true : undefined}>
            <FieldLabel>What should be correct? *</FieldLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {OPTIONS.map((option) => {
                const on = picked.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={pending}
                    onClick={() => toggleOption(option)}
                    className={cn(
                      "size-9 rounded-md text-sm font-bold",
                      on
                        ? "bg-brand-900 text-white"
                        : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={pending}
                onClick={toggleBonus}
                title="Should give ADD / bonus marks"
                className={cn(
                  "h-9 rounded-md px-2.5 text-xs font-bold",
                  bonus
                    ? "bg-sky-700 text-white"
                    : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                )}
              >
                ADD
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={toggleNone}
                className={cn(
                  "h-9 rounded-md px-2.5 text-xs font-semibold",
                  none
                    ? "bg-amber-700 text-white"
                    : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                )}
              >
                No right answer
              </button>
            </div>
          </Field>

          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="objection-message">Objection *</FieldLabel>
            <Textarea
              id="objection-message"
              value={message}
              onChange={(e) => {
                setMessage(e.currentTarget.value);
                setError(null);
              }}
              rows={2}
              placeholder={objectionPlaceholder(picked, bonus, none, currentAnswer)}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>

          <Field>
            <FieldLabel>Photo (optional)</FieldLabel>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={pickImage}
            />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
            {preview ? (
              <div className="mt-1.5 flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img
                  src={preview}
                  alt="Attached photo"
                  className="h-20 max-w-[8rem] rounded-lg border border-neutral-200 object-contain bg-neutral-50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setImage(null)}
                  className="gap-1.5"
                >
                  <X className="size-3.5" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => cameraRef.current?.click()}
                  className="gap-1.5 sm:hidden"
                >
                  <Camera className="size-4" />
                  Take photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => fileRef.current?.click()}
                  className="gap-1.5"
                >
                  <ImagePlus className="size-4" />
                  Upload image
                </Button>
              </div>
            )}
          </Field>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button type="button" disabled={pending} onClick={submit} className="gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareWarning className="size-4" />}
            Submit objection
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
