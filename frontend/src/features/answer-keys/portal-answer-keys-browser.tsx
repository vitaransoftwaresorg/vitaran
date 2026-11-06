"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, KeyRound, ListChecks, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { documentAnswersHref, wasEdited } from "@/features/documents/constants";
import { documentsForProgram, tabProgramIds } from "@/features/documents/school-documents";
import { isRegularCatalog, portalPrograms } from "@/features/teachers-resources/portal-programs";
import { cn } from "@/lib/utils";
import type { PdfDocument } from "@/types/document";
import { classLabel, formatDate } from "@/utils/format";
import { AnswerKeyPdfActions } from "./answer-key-pdf-actions";

type GroupBy = "test" | "class";

type PortalAnswerKeysBrowserProps = {
  programIds: string[];
  programNames?: Record<string, string>;
  /** Customized school — tabs use this name instead of a regular catalog title. */
  ownerLabel?: string;
  documents: PdfDocument[];
  basePath: string;
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

function matches(document: PdfDocument, query: string) {
  const q = query.trim().toLowerCase().replace(/^test\s*(no\.?|id)?\s*/, "");
  if (!q) return true;
  if (document.testId?.toLowerCase().includes(q)) return true;
  return /^\d+$/.test(q) && document.testNumber === Number(q);
}

/** School / teacher answer keys: program tabs, then keys grouped by test or by class. */
export function PortalAnswerKeysBrowser({
  programIds,
  programNames,
  ownerLabel,
  documents,
  basePath,
}: PortalAnswerKeysBrowserProps) {
  const programs = portalPrograms(tabProgramIds(programIds, ownerLabel), programNames).map((program) =>
    ownerLabel && isRegularCatalog(program.id) ? { ...program, title: ownerLabel } : program,
  );
  const [programId, setProgramId] = useState(programs[0]?.id);
  const [classLevel, setClassLevel] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("test");

  if (programs.length === 0) {
    return <Notice>No programs have been assigned to your school yet. Please contact Vitaran.</Notice>;
  }

  const programDocuments = documentsForProgram(documents, programId ?? "", programIds, ownerLabel);
  const classes = [...new Set(programDocuments.map((doc) => doc.classLevel))].sort((a, b) => a - b);
  const activeClass = classLevel != null && classes.includes(classLevel) ? classLevel : null;
  const shown = programDocuments.filter(
    (doc) => (activeClass == null || doc.classLevel === activeClass) && matches(doc, query),
  );

  const groups = new Map<number, PdfDocument[]>();
  for (const doc of shown) {
    const key = groupBy === "test" ? doc.testNumber : doc.classLevel;
    groups.set(key, [...(groups.get(key) ?? []), doc]);
  }
  const ordered = [...groups.entries()]
    .sort(([a], [b]) => (groupBy === "test" ? b - a : a - b))
    .map(([key, docs]) => ({
      key,
      docs: docs.sort((a, b) =>
        groupBy === "test" ? a.classLevel - b.classLevel : b.testNumber - a.testNumber,
      ),
    }));

  return (
    <div className="space-y-5">
      {programs.length > 1 && (
        <div
          role="tablist"
          aria-label="Program"
          className="flex flex-wrap gap-2 rounded-2xl border border-brand-100 bg-white p-1.5"
        >
          {programs.map((program) => {
            const active = program.id === programId;
            const count = documentsForProgram(documents, program.id, programIds, ownerLabel).length;
            return (
              <button
                key={program.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setProgramId(program.id);
                  setClassLevel(null);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                  active ? "bg-brand-900 text-white" : "text-brand-800 hover:bg-brand-50",
                )}
              >
                <program.icon className="hidden size-4 sm:block" />
                {program.title}
                <span
                  className={cn(
                    "hidden rounded-full px-2 py-0.5 text-[11px] tabular-nums sm:inline-flex",
                    active ? "bg-white/15 text-white" : "bg-brand-50 text-brand-700",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {programDocuments.length === 0 ? (
        <Notice>Answer keys for this program will be available here soon.</Notice>
      ) : (
        <>
          <div className="space-y-3 rounded-2xl border border-brand-100 bg-white p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  inputMode="numeric"
                  placeholder="Search by test ID or test number"
                  aria-label="Search answer keys"
                  className="h-10 rounded-xl pr-9 pl-9"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <div
                role="radiogroup"
                aria-label="Group answer keys"
                className="inline-flex shrink-0 rounded-xl border border-brand-100 bg-brand-50/60 p-1"
              >
                {(["test", "class"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={groupBy === value}
                    onClick={() => setGroupBy(value)}
                    className={cn(
                      "flex-1 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors sm:flex-none",
                      groupBy === value ? "bg-white text-brand-900 shadow-sm" : "text-brand-700 hover:text-brand-900",
                    )}
                  >
                    By {value}
                  </button>
                ))}
              </div>
            </div>

            {classes.length > 1 && (
              <div className="flex flex-wrap items-center gap-2" aria-label="Filter by class">
                <FilterChip active={activeClass == null} onClick={() => setClassLevel(null)}>
                  All classes
                </FilterChip>
                {classes.map((level) => (
                  <FilterChip key={level} active={activeClass === level} onClick={() => setClassLevel(level)}>
                    {classLabel(level)}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          {ordered.length === 0 ? (
            <Notice>No answer keys match your search.</Notice>
          ) : (
            <div className="space-y-4">
              {ordered.map(({ key, docs }) => (
                <details
                  key={`${groupBy}-${key}`}
                  open
                  className="group overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-gradient-to-r from-brand-950 to-brand-800 px-4 py-3 text-white sm:px-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="text-base font-bold">
                      {groupBy === "test" ? `Test ${key}` : classLabel(key)}
                    </h3>
                    <ChevronDown className="size-5 text-white/70 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
                    {docs.map((doc) => (
                      <KeyCard key={doc.id} document={doc} basePath={basePath} groupBy={groupBy} />
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KeyCard({
  document,
  basePath,
  groupBy,
}: {
  document: PdfDocument;
  basePath: string;
  groupBy: GroupBy;
}) {
  const answers = document.answerCount ?? 0;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50/30 p-3.5 transition-colors hover:border-brand-300 hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-neutral-950">
            {groupBy === "test" ? classLabel(document.classLevel) : `Test ${document.testNumber}`}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
            <ListChecks className="size-3.5 shrink-0" />
            {answers > 0 ? plural(answers, "answer") : "Answers pending"}
          </p>
        </div>
        {document.testId?.trim() ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900 tabular-nums">
            <span className="font-semibold text-amber-800/80">Test ID</span>
            {document.testId}
          </span>
        ) : null}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-neutral-600">
        <CalendarClock className="size-3.5 shrink-0 text-brand-700" />
        {wasEdited(document) ? "Updated" : "Published"} {formatDate(document.updatedAt)}
      </p>

      <div className="mt-auto flex flex-col gap-2 border-t border-brand-100 pt-3 sm:flex-row">
        <Link
          href={documentAnswersHref(basePath, document.id)}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-900 hover:bg-brand-50"
        >
          <KeyRound className="size-4" />
          View
        </Link>
        <AnswerKeyPdfActions
          basePath={basePath}
          id={document.id}
          disabled={answers === 0}
          className="flex-[2] sm:justify-end [&>a]:flex-1 [&>button]:flex-1"
        />
      </div>
    </li>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-brand-900 bg-brand-900 text-white"
          : "border-brand-200 bg-white text-brand-800 hover:border-brand-400",
      )}
    >
      {children}
    </button>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center text-sm font-medium text-brand-700">
      {children}
    </p>
  );
}
