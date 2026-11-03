"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, Download, Eye, FileText, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  customProgramIds,
  isRegularCatalog,
  portalPrograms,
} from "@/features/teachers-resources/portal-programs";
import type { PdfDocument } from "@/types/document";
import { classLabel, formatDateTime } from "@/utils/format";
import {
  documentAnswersHref,
  documentDownloadHref,
  documentFileHref,
  formatFileSize,
  wasEdited,
} from "./constants";

type SchoolDocumentsProps = {
  /** Programs assigned to the signed-in school. */
  programIds: string[];
  /** Catalog names so customized programs are not stuck as a code. */
  programNames?: Record<string, string>;
  /** Customized school name — used instead of Advanced / Integrated tab titles. */
  ownerLabel?: string;
  documents: PdfDocument[];
  /** Lowercase, e.g. "answer key". */
  noun: string;
  /** Site section that serves the PDFs, e.g. `/results`. */
  basePath: string;
  /** Hide the Test ID badge on small screens (teacher portal). */
  hideIdBadgeOnMobile?: boolean;
};

function tabProgramIds(programIds: string[], ownerLabel?: string) {
  if (!ownerLabel) return programIds;
  const custom = customProgramIds(programIds);
  return custom.length > 0 ? custom : programIds.slice(0, 1);
}

function documentsForProgram(
  documents: PdfDocument[],
  programId: string,
  programIds: string[],
  ownerLabel?: string,
) {
  const custom = customProgramIds(programIds);
  return documents.filter((document) => {
    if (document.program === programId) return true;
    if (custom[0] === programId && isRegularCatalog(document.program)) return true;
    if (ownerLabel && custom.length === 0) return true;
    return false;
  });
}

/** What a signed-in school sees: program tabs, then each class with its tests. */
export function SchoolDocuments({
  programIds,
  programNames,
  ownerLabel,
  documents,
  noun,
  basePath,
  hideIdBadgeOnMobile = false,
}: SchoolDocumentsProps) {
  const visiblePrograms = portalPrograms(tabProgramIds(programIds, ownerLabel), programNames).map(
    (program) =>
      ownerLabel && isRegularCatalog(program.id) ? { ...program, title: ownerLabel } : program,
  );
  const [programId, setProgramId] = useState(visiblePrograms[0]?.id);
  const [classLevel, setClassLevel] = useState<number | null>(null);
  const plural = (count: number) => `${count} ${count === 1 ? noun : `${noun}s`}`;

  if (visiblePrograms.length === 0) {
    return (
      <Notice>No programs have been assigned to your school yet. Please contact Vitaran.</Notice>
    );
  }

  const activeProgram = visiblePrograms.find((program) => program.id === programId);
  const programDocuments = documentsForProgram(documents, programId ?? "", programIds, ownerLabel);
  const classes = [...new Set(programDocuments.map((document) => document.classLevel))].sort(
    (a, b) => a - b,
  );
  const shownClasses = classLevel && classes.includes(classLevel) ? [classLevel] : classes;

  return (
    <div className="space-y-6">
      {visiblePrograms.length > 1 && (
        <div
          role="tablist"
          aria-label="Program"
          className="flex flex-wrap gap-2 rounded-2xl border border-brand-100 bg-white p-1.5"
        >
          {visiblePrograms.map((program) => {
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

      {activeProgram && (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-brand-100 pb-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-500 uppercase">Program</p>
            <h2 className="mt-1 text-2xl font-bold text-neutral-950">{activeProgram.title}</h2>
          </div>
          <p className="text-sm text-neutral-500">
            <span className="font-semibold text-neutral-900">{plural(programDocuments.length)}</span>{" "}
            across <span className="font-semibold text-neutral-900">{classes.length}</span>{" "}
            {classes.length === 1 ? "class" : "classes"}
          </p>
        </div>
      )}

      {programDocuments.length === 0 ? (
        <Notice>{`${noun.charAt(0).toUpperCase()}${noun.slice(1)}s for this program will be available here soon.`}</Notice>
      ) : (
        <>
          {classes.length > 1 && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Filter by class">
              <FilterChip active={classLevel === null} onClick={() => setClassLevel(null)}>
                All classes
              </FilterChip>
              {classes.map((level) => (
                <FilterChip key={level} active={classLevel === level} onClick={() => setClassLevel(level)}>
                  {classLabel(level)}
                </FilterChip>
              ))}
            </div>
          )}

          <div className="space-y-5">
            {shownClasses.map((level) => {
              const classDocuments = programDocuments.filter((document) => document.classLevel === level);
              return (
                <section
                  key={level}
                  className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]"
                >
                  <header className="flex items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/60 px-5 py-3.5 sm:px-6">
                    <h3 className="text-lg font-bold text-neutral-950">{classLabel(level)}</h3>
                    <span className="hidden rounded-full border border-brand-100 bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-800 sm:inline-flex">
                      {plural(classDocuments.length)}
                    </span>
                  </header>
                  <ul className="divide-y divide-brand-100/70">
                    {classDocuments.map((document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                        noun={noun}
                        basePath={basePath}
                        hideIdBadgeOnMobile={hideIdBadgeOnMobile}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DocumentRow({
  document,
  noun,
  basePath,
  hideIdBadgeOnMobile,
}: {
  document: PdfDocument;
  noun: string;
  basePath: string;
  hideIdBadgeOnMobile: boolean;
}) {
  return (
    <li className="grid gap-4 px-5 py-4 transition-colors hover:bg-brand-50/40 sm:px-6 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-center md:gap-6">
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={cn(
            "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-900 text-white",
            hideIdBadgeOnMobile && "hidden sm:flex",
          )}
        >
          <span className="text-[8px] font-semibold tracking-wider text-white/70 uppercase">No</span>
          <span className="text-lg leading-none font-bold tabular-nums">{document.testNumber}</span>
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold text-neutral-950">
            {document.testId?.trim()
              ? `Test ID ${document.testId}`
              : `Test No ${document.testNumber}`}{" "}
            {noun}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">
              {document.fileSize > 0
                ? document.fileName
                : document.answerCount
                  ? `${document.answerCount} answers`
                  : "Answer key"}
            </span>
            {document.fileSize > 0 ? (
              <>
                <span className="text-neutral-300">·</span>
                <span className="shrink-0">{formatFileSize(document.fileSize)}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 md:border-l md:border-brand-100 md:pl-6">
        <CalendarClock className="size-4 shrink-0 text-brand-700" />
        <div>
          <p className="text-xs font-bold text-neutral-950">
            {wasEdited(document) ? "Updated on" : "Published on"}
          </p>
          <p className="text-sm whitespace-nowrap text-neutral-600 tabular-nums">
            {formatDateTime(document.updatedAt)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={documentAnswersHref(basePath, document.id)}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3.5 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-900 hover:bg-brand-50 md:flex-none"
        >
          <ListChecks className="size-4" />
          View key
        </Link>
        {document.fileSize > 0 ? (
          <>
            <Link
              href={documentFileHref(basePath, document.id)}
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3.5 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-900 hover:bg-brand-50 md:flex-none"
            >
              <Eye className="size-4" />
              PDF
            </Link>
            <Link
              href={documentDownloadHref(basePath, document.id)}
              download={document.fileName}
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-900 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:scale-[0.98] md:flex-none"
            >
              <Download className="size-4" />
              Download
            </Link>
          </>
        ) : null}
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
