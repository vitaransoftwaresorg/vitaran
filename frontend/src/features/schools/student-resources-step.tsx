"use client";

import { useState } from "react";
import { Check, FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { subjectLabel, subjectsForClassLevel } from "./constants";
import { resourceFieldName } from "./student-resource-fields";

const CLASS_LEVELS = Array.from({ length: 10 }, (_, index) => index + 1);

type StudentResourcesStepProps = {
  /** When set, only these classes are shown; otherwise classes 1–10. */
  classLevels?: number[];
};

/** Optional PDF upload grid for customized school registration (classes 1–10). */
export function StudentResourcesStep({ classLevels }: StudentResourcesStepProps) {
  const levels =
    classLevels && classLevels.length > 0
      ? [...new Set(classLevels.filter((level) => level >= 1 && level <= 10))].sort((a, b) => a - b)
      : CLASS_LEVELS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-950">Student resources</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Upload a PDF for each class and subject (optional). You can add or replace these later.
        </p>
      </div>

      {levels.map((classLevel) => {
        const subjects = subjectsForClassLevel(classLevel);
        return (
          <section
            key={classLevel}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/60"
          >
            <header className="border-b border-neutral-200 bg-white px-4 py-2.5">
              <h3 className="text-sm font-semibold text-neutral-950">Class {classLevel}</h3>
            </header>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {subjects.map((subject) => (
                <ResourceUploadCell
                  key={`${classLevel}-${subject}`}
                  classLevel={classLevel}
                  subject={subject}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ResourceUploadCell({ classLevel, subject }: { classLevel: number; subject: string }) {
  const name = resourceFieldName(classLevel, subject);
  const [fileName, setFileName] = useState<string | null>(null);
  const uploaded = Boolean(fileName);

  return (
    <label
      className={cn(
        "group relative flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed px-3 py-3 transition has-[:focus-visible]:ring-2",
        uploaded
          ? "border-emerald-500 bg-emerald-50 has-[:focus-visible]:border-emerald-600 has-[:focus-visible]:ring-emerald-200"
          : "border-neutral-300 bg-white hover:border-brand-400 hover:bg-brand-50/40 has-[:focus-visible]:border-brand-500 has-[:focus-visible]:ring-brand-200",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-sm font-medium",
            uploaded ? "text-emerald-900" : "text-neutral-900",
          )}
        >
          {subjectLabel(subject)}
        </span>
        {uploaded ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Upload className="size-3.5 text-neutral-400 group-hover:text-brand-700" />
        )}
      </div>
      <input
        type="file"
        name={name}
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          setFileName(file?.name ?? null);
        }}
      />
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 truncate text-xs",
          uploaded ? "font-medium text-emerald-700" : "text-neutral-500",
        )}
      >
        <FileText className="size-3.5 shrink-0" />
        {fileName ?? "Choose PDF"}
      </span>
      {uploaded ? (
        <button
          type="button"
          className="absolute top-2 right-2 rounded p-0.5 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800"
          aria-label={`Clear ${subjectLabel(subject)} PDF`}
          onClick={(event) => {
            event.preventDefault();
            const input = event.currentTarget.parentElement?.querySelector(
              'input[type="file"]',
            ) as HTMLInputElement | null;
            if (input) input.value = "";
            setFileName(null);
          }}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </label>
  );
}
