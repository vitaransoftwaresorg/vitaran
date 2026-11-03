"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Atom,
  Calculator,
  ChevronDown,
  Download,
  ExternalLink,
  FlaskConical,
  Leaf,
  Microscope,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { classLabel } from "@/utils/format";
import { portalPrograms } from "./portal-programs";
import type { SolutionBook, Subject } from "./solution-books";

const subjectIcons: Record<Subject, LucideIcon> = {
  Mathematics: Calculator,
  Physics: Atom,
  Chemistry: FlaskConical,
  Biology: Leaf,
  Science: Microscope,
};

type ProgramTabsProps = {
  /** Programs to show, in the standard program order. */
  programIds: string[];
  programNames?: Record<string, string>;
  books: Record<string, SolutionBook[]>;
  label: string;
  emptyMessage: string;
};

export function ProgramTabs({
  programIds,
  programNames,
  books: booksByProgram,
  label,
  emptyMessage,
}: ProgramTabsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const visiblePrograms = portalPrograms(programIds, programNames);

  if (visiblePrograms.length === 0) {
    return (
      <p className="rounded-[2rem] border border-brand-200 bg-brand-50 p-6 text-center text-sm font-medium text-brand-700">
        No programs have been assigned to your school yet. Please contact Vitaran.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {visiblePrograms.map((program, i) => {
        const open = openIndex === i;
        const panelId = `program-panel-${i}`;
        const books = booksByProgram[program.title] ?? [];

        return (
          <li
            key={program.title}
            className={cn(
              "overflow-hidden rounded-[2rem] border bg-white transition-all duration-300",
              open
                ? "border-brand-800 shadow-[0_24px_50px_-24px_rgb(25_28_95/0.45)]"
                : "border-brand-200 hover:border-brand-400 hover:shadow-[0_16px_40px_-24px_rgb(25_28_95/0.35)]",
            )}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              aria-controls={panelId}
              className="group flex w-full items-center gap-4 px-5 py-4 text-left select-none sm:px-7 sm:py-5"
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors",
                  open
                    ? "bg-brand-800 text-white"
                    : "bg-brand-50 text-brand-800 group-hover:bg-brand-100",
                )}
              >
                <program.icon className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block text-[11px] font-semibold tracking-[0.18em] text-brand-400 uppercase">
                  {label} · {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-0.5 block text-base font-semibold tracking-wide text-brand-900 sm:text-lg">
                  {program.title}
                </span>
              </span>
              <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 sm:inline">
                {books.length === 0
                  ? "Coming soon"
                  : `${books.length} ${books.length === 1 ? "file" : "files"}`}
              </span>
              <ChevronDown
                className={cn(
                  "size-5 shrink-0 text-brand-500 transition-transform duration-300",
                  open && "rotate-180 text-brand-800",
                )}
              />
            </button>

            <div
              id={panelId}
              className={cn(
                "grid transition-all duration-300",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0">
                <div className="border-t border-brand-100 px-5 py-6 sm:px-7">
                  {books.length === 0 ? (
                    <p className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-700">
                      {emptyMessage}
                    </p>
                  ) : (
                    <BookBrowser books={books} />
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BookBrowser({ books }: { books: SolutionBook[] }) {
  const volumes = [
    ...new Set(books.map((b) => b.volume).filter((v) => v !== undefined)),
  ];
  const [volume, setVolume] = useState(volumes[0]);

  const visible = books.filter((b) => b.volume === volume);
  const subjects = [...new Set(visible.map((b) => b.subject))];

  return (
    <div>
      {volumes.length > 1 && (
        <div
          role="tablist"
          aria-label="Volume"
          className="mb-5 inline-flex rounded-full bg-brand-50 p-1"
        >
          {volumes.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={volume === v}
              onClick={() => setVolume(v)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                volume === v
                  ? "bg-brand-800 text-white shadow"
                  : "text-brand-700 hover:text-brand-900",
              )}
            >
              Volume {v}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {subjects.map((subject) => {
          const Icon = subjectIcons[subject];
          return (
            <div
              key={subject}
              className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4"
            >
              <p className="flex items-center gap-2 font-semibold text-brand-900">
                <span className="flex size-8 items-center justify-center rounded-lg bg-brand-800 text-white">
                  <Icon className="size-4" />
                </span>
                {subject}
              </p>
              <ul className="mt-3 space-y-1.5">
                {visible
                  .filter((b) => b.subject === subject)
                  .map((book) => (
                    <li key={book.href}>
                      <Link
                        href={book.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        prefetch={false}
                        className="group flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-medium text-brand-800 ring-1 ring-brand-100 transition-all hover:bg-brand-800 hover:text-white hover:ring-brand-800 active:scale-[0.98]"
                      >
                        <span>{classLabel(book.grade)}</span>
                        {book.external ? (
                          <ExternalLink className="size-3.5 opacity-60 group-hover:opacity-100" />
                        ) : (
                          <Download className="size-3.5 opacity-60 group-hover:opacity-100" />
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>

      {books.some((b) => b.external) && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="size-3" />
          Opens in Google Drive
        </p>
      )}
    </div>
  );
}
