"use client";

import { useState } from "react";
import { Check, FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { capitalizeWords } from "./schema";
import { subjectLabel, subjectsForClassLevel } from "./constants";
import { CUSTOM_PROGRAM_TOKEN, resourceFieldName } from "./student-resource-fields";

type ProgramSlot = {
  /** Catalog/custom code, or CUSTOM for draft customized program. */
  programCode: string;
  programName: string;
  classLevels: number[];
};

type StudentResourcesStepProps = {
  programs: ProgramSlot[];
};

/** Optional PDF upload grid for customized school registration (by program → class → subject). */
export function StudentResourcesStep({ programs }: StudentResourcesStepProps) {
  if (programs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        Add at least one program with classes before uploading teacher resources.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-950">Teacher resources</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Upload a PDF for each program, class, and subject (optional). Schools only see a
          program&apos;s resources after at least one class is registered for that program.
          Manage these later under Admin → Teacher Resources → Customized.
        </p>
      </div>

      {programs.map((program) => {
        const levels = [...new Set(program.classLevels.filter((level) => level >= 1 && level <= 10))]
          .sort((a, b) => a - b);
        if (levels.length === 0) return null;
        return (
          <section key={program.programCode} className="space-y-3">
            <h3 className="text-sm font-semibold text-brand-900">
              {capitalizeWords(program.programName) || program.programCode}
            </h3>
            {levels.map((classLevel) => {
              const subjects = subjectsForClassLevel(classLevel);
              return (
                <section
                  key={`${program.programCode}-${classLevel}`}
                  className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/60"
                >
                  <header className="border-b border-neutral-200 bg-white px-4 py-2.5">
                    <h4 className="text-sm font-semibold text-neutral-950">Class {classLevel}</h4>
                  </header>
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {subjects.map((subject) => (
                      <ResourceUploadCell
                        key={`${program.programCode}-${classLevel}-${subject}`}
                        programCode={program.programCode}
                        classLevel={classLevel}
                        subject={subject}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function ResourceUploadCell({
  programCode,
  classLevel,
  subject,
}: {
  programCode: string;
  classLevel: number;
  subject: string;
}) {
  const name = resourceFieldName(programCode || CUSTOM_PROGRAM_TOKEN, classLevel, subject);
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
          uploaded ? "text-emerald-800" : "text-neutral-500",
        )}
      >
        {uploaded ? (
          <>
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{fileName}</span>
            <button
              type="button"
              className="ml-auto rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
              onClick={(event) => {
                event.preventDefault();
                const input = event.currentTarget
                  .closest("label")
                  ?.querySelector<HTMLInputElement>('input[type="file"]');
                if (input) input.value = "";
                setFileName(null);
              }}
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : (
          "PDF optional"
        )}
      </span>
    </label>
  );
}
