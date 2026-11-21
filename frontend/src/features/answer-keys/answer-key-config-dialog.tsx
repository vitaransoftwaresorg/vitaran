"use client";

import { useEffect, useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANSWER_KEY_QUESTION_TYPES,
  type AnswerKeyQuestionType,
  type KeyTypeRange,
} from "@/types/answer-key";

type DraftRow = {
  key: string;
  from: string;
  to: string;
  type: AnswerKeyQuestionType;
  correctMarks: string;
  wrongMarks: string;
  error?: string;
};

type AnswerKeyConfigDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxQuestion: number;
  value: KeyTypeRange[];
  /** Prefill for new ranges (key-level Correct / Wrong). */
  defaultCorrectMarks: number;
  defaultWrongMarks: number;
  onSave: (ranges: KeyTypeRange[]) => void;
};

function emptyRow(correctMarks: number, wrongMarks: number): DraftRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from: "",
    to: "",
    type: "normal",
    correctMarks: String(correctMarks),
    wrongMarks: String(wrongMarks),
  };
}

function toDraft(
  ranges: KeyTypeRange[],
  defaultCorrectMarks: number,
  defaultWrongMarks: number,
): DraftRow[] {
  if (ranges.length === 0) return [emptyRow(defaultCorrectMarks, defaultWrongMarks)];
  return ranges.map((range) => ({
    key: `${range.from}-${range.to}-${range.type}-${Math.random().toString(36).slice(2, 6)}`,
    from: String(range.from),
    to: String(range.to),
    type: range.type,
    correctMarks: String(range.correctMarks),
    wrongMarks: String(range.wrongMarks),
  }));
}

function parseMarks(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100) return null;
  return n;
}

export function AnswerKeyConfigDialog({
  open,
  onOpenChange,
  maxQuestion,
  value,
  defaultCorrectMarks,
  defaultWrongMarks,
  onSave,
}: AnswerKeyConfigDialogProps) {
  const [rows, setRows] = useState<DraftRow[]>(() =>
    toDraft(value, defaultCorrectMarks, defaultWrongMarks),
  );
  const typeItems = ANSWER_KEY_QUESTION_TYPES.map((item) => ({
    value: item.value,
    label: item.label,
  }));

  useEffect(() => {
    if (open) setRows(toDraft(value, defaultCorrectMarks, defaultWrongMarks));
  }, [open, value, defaultCorrectMarks, defaultWrongMarks]);

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch, error: undefined } : row)),
    );
  }

  function apply() {
    const next: KeyTypeRange[] = [];
    let hasError = false;
    const withErrors = rows.map((row) => {
      const blank = !row.from.trim() && !row.to.trim();
      if (blank) return row;

      const from = Number(row.from);
      const to = Number(row.to);
      const correctMarks = parseMarks(row.correctMarks);
      const wrongMarks = parseMarks(row.wrongMarks);
      if (!Number.isInteger(from) || from < 1 || from > maxQuestion) {
        hasError = true;
        return { ...row, error: `From must be 1–${maxQuestion}` };
      }
      if (!Number.isInteger(to) || to < 1 || to > maxQuestion) {
        hasError = true;
        return { ...row, error: `To must be 1–${maxQuestion}` };
      }
      if (to < from) {
        hasError = true;
        return { ...row, error: "To must be ≥ From" };
      }
      if (correctMarks == null) {
        hasError = true;
        return { ...row, error: "Correct marks must be 0–100" };
      }
      if (wrongMarks == null) {
        hasError = true;
        return { ...row, error: "Wrong marks must be 0–100" };
      }
      next.push({ from, to, type: row.type, correctMarks, wrongMarks });
      return row;
    });

    if (hasError) {
      setRows(withErrors);
      return;
    }

    next.sort((a, b) => a.from - b.from || a.to - b.to);
    onSave(next);
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] gap-3 sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Settings2 className="size-4 shrink-0" />
            Answer key configuration
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto py-1">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                  Range {index + 1}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={rows.length <= 1}
                  onClick={() =>
                    setRows((current) =>
                      current.length <= 1 ? current : current.filter((item) => item.key !== row.key),
                    )
                  }
                  aria-label="Remove range"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={row.error ? true : undefined}>
                  <FieldLabel>From</FieldLabel>
                  <Input
                    inputMode="numeric"
                    value={row.from}
                    className="h-9 tabular-nums"
                    onChange={(event) =>
                      updateRow(row.key, {
                        from: event.currentTarget.value.replace(/\D/g, "").slice(0, 3),
                      })
                    }
                  />
                </Field>
                <Field data-invalid={row.error ? true : undefined}>
                  <FieldLabel>To</FieldLabel>
                  <Input
                    inputMode="numeric"
                    value={row.to}
                    className="h-9 tabular-nums"
                    onChange={(event) =>
                      updateRow(row.key, {
                        to: event.currentTarget.value.replace(/\D/g, "").slice(0, 3),
                      })
                    }
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select
                  value={row.type}
                  items={typeItems}
                  onValueChange={(next) => {
                    if (next == null) return;
                    updateRow(row.key, { type: next as AnswerKeyQuestionType });
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANSWER_KEY_QUESTION_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={row.error ? true : undefined}>
                  <FieldLabel>Correct</FieldLabel>
                  <Input
                    inputMode="numeric"
                    value={row.correctMarks}
                    className="h-9 tabular-nums"
                    onChange={(event) =>
                      updateRow(row.key, {
                        correctMarks: event.currentTarget.value.replace(/\D/g, "").slice(0, 3),
                      })
                    }
                  />
                </Field>
                <Field data-invalid={row.error ? true : undefined}>
                  <FieldLabel>Wrong</FieldLabel>
                  <Input
                    inputMode="numeric"
                    value={row.wrongMarks}
                    className="h-9 tabular-nums"
                    onChange={(event) =>
                      updateRow(row.key, {
                        wrongMarks: event.currentTarget.value.replace(/\D/g, "").slice(0, 3),
                      })
                    }
                  />
                </Field>
              </div>

              {row.error ? <FieldError>{row.error}</FieldError> : null}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              setRows((current) => [
                ...current,
                emptyRow(defaultCorrectMarks, defaultWrongMarks),
              ])
            }
          >
            <Plus className="size-3.5" />
            Add range
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={apply}>Save configuration</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
