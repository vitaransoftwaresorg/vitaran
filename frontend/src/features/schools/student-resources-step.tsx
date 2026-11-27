"use client";

import { useMemo, useState } from "react";
import { Check, FileText, Upload, X } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SchoolOption } from "@/types/school";
import { capitalizeWords } from "./schema";
import { subjectLabel, subjectsForClassLevel } from "./constants";
import { CUSTOM_PROGRAM_TOKEN, resourceFieldName } from "./student-resource-fields";

export const RESOURCE_SOURCE_OWN = "__none__";
export const RESOURCE_SOURCE_HEAD_OFFICE = "__head_office__";

type ProgramSlot = {
  /** Catalog/custom code, or CUSTOM for draft customized program. */
  programCode: string;
  programName: string;
  classLevels: number[];
};

type StudentResourcesStepProps = {
  programs: ProgramSlot[];
  /** Other customized schools available as resource sources. */
  sourceSchools?: SchoolOption[];
  /** Current selection: own, head-office token, or another school id. */
  sourceSchoolId?: string;
  onSourceSchoolChange?: (schoolId: string | null) => void;
  /** Head office chosen on step 1 — shown as a default resource option. */
  headOffice?: { id: string; name: string } | null;
};

/** Optional PDF upload grid for customized school registration (by program → class → subject). */
export function StudentResourcesStep({
  programs,
  sourceSchools = [],
  sourceSchoolId = RESOURCE_SOURCE_OWN,
  onSourceSchoolChange,
  headOffice = null,
}: StudentResourcesStepProps) {
  const sortedSourceSchools = useMemo(
    () => [...sourceSchools].sort((a, b) => a.name.localeCompare(b.name)),
    [sourceSchools],
  );
  const hasSourcePicker = Boolean(headOffice) || sortedSourceSchools.length > 0;
  const selected = sourceSchoolId || RESOURCE_SOURCE_OWN;
  const sourceItems = useMemo(() => {
    const items = [{ value: RESOURCE_SOURCE_OWN, label: "This school's own PDFs" }];
    if (headOffice) {
      items.push({ value: RESOURCE_SOURCE_HEAD_OFFICE, label: headOffice.name });
    }
    for (const school of sortedSourceSchools) {
      items.push({ value: school.id, label: school.name });
    }
    return items;
  }, [headOffice, sortedSourceSchools]);
  const uploadingOwn = selected === RESOURCE_SOURCE_OWN;
  /** Form field only accepts a school uuid or none — head office is via headOfficeId. */
  const formSourceValue =
    selected === RESOURCE_SOURCE_OWN || selected === RESOURCE_SOURCE_HEAD_OFFICE
      ? RESOURCE_SOURCE_OWN
      : selected;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-950">Teacher resources</h2>
      </div>

      {hasSourcePicker ? (
        <Field className="max-w-xl">
          <FieldLabel htmlFor="teacherResourceSourceSchoolId">Resource source</FieldLabel>
          <input type="hidden" name="teacherResourceSourceSchoolId" value={formSourceValue} />
          <Select
            items={sourceItems}
            value={selected}
            onValueChange={(next) => {
              if (!next) return;
              onSourceSchoolChange?.(next === RESOURCE_SOURCE_OWN ? null : next);
            }}
          >
            <SelectTrigger
              id="teacherResourceSourceSchoolId"
              className="h-10 w-full rounded-lg border-neutral-200 bg-white px-3 text-left shadow-none"
            >
              <SelectValue placeholder="Select resource source" />
            </SelectTrigger>
            <SelectContent
              align="start"
              alignItemWithTrigger={false}
              className="min-w-[var(--anchor-width)] max-w-[min(28rem,calc(100vw-2rem))]"
            >
              <SelectGroup>
                <SelectLabel>Upload</SelectLabel>
                <SelectItem value={RESOURCE_SOURCE_OWN} className="py-2">
                  This school&apos;s own PDFs
                </SelectItem>
              </SelectGroup>
              {headOffice ? (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Head office</SelectLabel>
                    <SelectItem value={RESOURCE_SOURCE_HEAD_OFFICE} className="py-2">
                      <span className="truncate">{headOffice.name}</span>
                    </SelectItem>
                  </SelectGroup>
                </>
              ) : null}
              {sortedSourceSchools.length > 0 ? (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Reuse from school</SelectLabel>
                    {sortedSourceSchools.map((school) => (
                      <SelectItem key={school.id} value={school.id} className="py-2">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="truncate">{school.name}</span>
                          <span className="shrink-0 text-xs text-neutral-500">{school.code}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              ) : null}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="teacherResourceSourceSchoolId" value={RESOURCE_SOURCE_OWN} />
      )}

      {uploadingOwn ? (
        programs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
            Add at least one program with classes before uploading teacher resources.
          </div>
        ) : (
          programs.map((program) => {
            const levels = [
              ...new Set(program.classLevels.filter((level) => level >= 1 && level <= 10)),
            ].sort((a, b) => a - b);
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
          })
        )
      ) : null}
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
          "Choose PDF"
        )}
      </span>
    </label>
  );
}
