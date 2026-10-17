"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { capitalizeWords } from "@/features/schools/schema";
import { cn } from "@/lib/utils";
import type { SchoolClassRow } from "@/types/teacher";
import { loadSchoolClassesAction } from "./school-classes-action";

function groupByProgram(classes: SchoolClassRow[]) {
  const groups = new Map<string, { programName: string; rows: SchoolClassRow[] }>();
  for (const row of classes) {
    const existing = groups.get(row.programId);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    groups.set(row.programId, { programName: row.programName, rows: [row] });
  }
  return [...groups.entries()];
}

/** Always loads classes from the API so disable/enable shows up without a hard refresh. */
export function SchoolClassesBoard() {
  const [classes, setClasses] = useState<SchoolClassRow[] | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      setClasses(await loadSchoolClassesAction());
    });
  }, []);

  useEffect(() => {
    reload();

    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  if (classes === null) {
    return (
      <>
        <PageHeader
          title="Classes"
          description="Assign a class teacher for each class."
        />
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
          Loading classes…
        </div>
      </>
    );
  }

  const groups = groupByProgram(classes);

  return (
    <>
      <PageHeader
        title="Classes"
        count={classes.length}
        description="Assign a class teacher for each class."
      />

      {classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
          No classes yet. Ask admin to enrol programs and classes for this school.
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
            pending && "opacity-70 transition-opacity",
          )}
        >
          {groups.map(([programId, group]) => (
            <div
              key={programId}
              className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
            >
              <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2">
                <h3 className="truncate text-sm font-bold tracking-tight text-neutral-950">
                  {capitalizeWords(group.programName)}
                </h3>
              </div>
              <ul className="divide-y divide-neutral-100">
                {group.rows.map((row) => (
                  <li
                    key={`${row.programId}-${row.classLevel}`}
                    className="flex items-center gap-2 px-3 py-1.5"
                  >
                    <span className="w-16 shrink-0 text-sm font-semibold text-neutral-950">
                      Class {row.classLevel}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        row.classTeacher
                          ? "font-medium text-neutral-600"
                          : "font-medium text-neutral-400",
                      )}
                    >
                      {row.classTeacher
                        ? capitalizeWords(row.classTeacher.name)
                        : "Not assigned"}
                    </span>
                    <Link
                      href={`/school/classes/${programId}/${row.classLevel}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "h-7 shrink-0 px-2",
                      )}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
