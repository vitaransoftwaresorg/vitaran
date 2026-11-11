"use client";

import { useCallback, useMemo, useState } from "react";
import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { LearningProgram } from "@/types/program";
import { encodeOffering, parseOfferingToken } from "./offerings";
import { capitalizeWords } from "./schema";

type ProgramOfferingsFieldProps = {
  catalog: LearningProgram[];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
};

function classLevels(program: LearningProgram) {
  return Array.from(
    { length: program.classTo - program.classFrom + 1 },
    (_, index) => program.classFrom + index,
  );
}

export function ProgramOfferingsField({
  catalog,
  value,
  onChange,
  error,
}: ProgramOfferingsFieldProps) {
  const [selectedIds, setSelectedIds] = useState(() => {
    const open = new Set<string>();
    for (const token of value) {
      const parsed = parseOfferingToken(token);
      if (parsed) open.add(parsed.programId);
    }
    return open;
  });

  const emit = useCallback(
    (next: string[]) => {
      queueMicrotask(() => onChange(next));
    },
    [onChange],
  );

  const selectedPrograms = useMemo(
    () => catalog.filter((program) => selectedIds.has(program.id)),
    [catalog, selectedIds],
  );

  const classActive = (programId: string, classLevel: number) =>
    value.some((token) => {
      const parsed = parseOfferingToken(token);
      return parsed?.programId === programId && parsed.classLevel === classLevel;
    });

  const toggleProgram = (program: LearningProgram, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(program.id);
      else next.delete(program.id);
      return next;
    });
    if (!checked) {
      emit(value.filter((token) => !token.startsWith(`${program.id}:`)));
    }
  };

  const toggleClass = (program: LearningProgram, classLevel: number, checked: boolean) => {
    const withoutClass = value.filter((token) => {
      const parsed = parseOfferingToken(token);
      return !(parsed && parsed.programId === program.id && parsed.classLevel === classLevel);
    });

    if (!checked) {
      emit(withoutClass);
      return;
    }

    const subjects = program.subjects.length > 0 ? program.subjects : [];
    if (subjects.length === 0) {
      emit(withoutClass);
      return;
    }

    emit([
      ...withoutClass,
      ...subjects.map((subject) => encodeOffering(program.id, classLevel, subject)),
    ]);
  };

  if (catalog.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Create a matching Regular or Customized program in Admin → Programs before enrolling this school.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Programs
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {catalog.map((program) => {
            const id = `offer-program-${program.id}`;
            return (
              <label key={program.id} htmlFor={id} className="flex cursor-pointer items-center gap-2">
                <input
                  id={id}
                  type="checkbox"
                  className="size-4 rounded border-neutral-300 accent-brand-800"
                  checked={selectedIds.has(program.id)}
                  onChange={(event) => toggleProgram(program, event.target.checked)}
                />
                <span className="text-sm font-medium text-neutral-900">
                  {capitalizeWords(program.name)}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {selectedPrograms.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {selectedPrograms.map((program) => {
            const levels = classLevels(program);
            return (
              <div
                key={program.id}
                className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
              >
                <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2">
                  <h4 className="truncate text-sm font-bold text-neutral-950">
                    {capitalizeWords(program.name)}
                  </h4>
                </div>
                <ul className="divide-y divide-neutral-100">
                  {levels.map((classLevel) => {
                    const id = `offer-class-${program.id}-${classLevel}`;
                    const active = classActive(program.id, classLevel);
                    return (
                      <li key={classLevel}>
                        <label
                          htmlFor={id}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-2 px-3 py-2",
                            active ? "bg-brand-50/60" : "hover:bg-neutral-50",
                          )}
                        >
                          <span className="text-sm font-medium text-neutral-900">
                            Class {classLevel}
                          </span>
                          <input
                            id={id}
                            type="checkbox"
                            className="size-3.5 rounded border-neutral-300 accent-brand-800"
                            checked={active}
                            onChange={(event) =>
                              toggleClass(program, classLevel, event.target.checked)
                            }
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {selectedPrograms.length === 0 && (
        <p className="text-sm text-neutral-500">Check one or more programs to assign classes.</p>
      )}

      {value.map((token) => (
        <input key={token} type="hidden" name="offerings" value={token} />
      ))}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
