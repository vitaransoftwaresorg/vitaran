import Link from "next/link";
import { FileText } from "lucide-react";
import { capitalizeWords } from "./schema";
import { subjectLabel } from "./constants";
import type { SchoolStudentResource } from "@/services/schools";
import { formatFileSize } from "@/features/documents/constants";

type SchoolStudentResourcesPanelProps = {
  resources: SchoolStudentResource[];
  /** Base path for viewing a PDF, e.g. `/school/resources/student`. */
  viewBase: string;
  programNames?: Record<string, string>;
};

/** Uploaded per-program PDFs for a customized school (teacher resources). */
export function SchoolStudentResourcesPanel({
  resources,
  viewBase,
  programNames = {},
}: SchoolStudentResourcesPanelProps) {
  if (resources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        No teacher resources yet. Register at least one class for a program to see its uploaded
        PDFs here.
      </div>
    );
  }

  const byProgram = new Map<string, Map<number, SchoolStudentResource[]>>();
  for (const row of resources) {
    const byClass = byProgram.get(row.programCode) ?? new Map<number, SchoolStudentResource[]>();
    const list = byClass.get(row.classLevel) ?? [];
    list.push(row);
    byClass.set(row.classLevel, list);
    byProgram.set(row.programCode, byClass);
  }

  return (
    <div className="space-y-6">
      {[...byProgram.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([programCode, byClass]) => (
          <section key={programCode} className="space-y-3">
            <h2 className="text-sm font-semibold text-brand-900">
              {capitalizeWords(programNames[programCode] || programCode)}
            </h2>
            {[...byClass.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([classLevel, rows]) => (
                <section
                  key={`${programCode}-${classLevel}`}
                  className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
                >
                  <header className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
                    <h3 className="text-sm font-semibold text-neutral-950">Class {classLevel}</h3>
                  </header>
                  <ul className="divide-y divide-neutral-100">
                    {rows.map((row) => (
                      <li key={row.id}>
                        <Link
                          href={`${viewBase}/${encodeURIComponent(row.programCode)}/${row.classLevel}/${encodeURIComponent(row.subject)}`}
                          target="_blank"
                          className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-brand-50/50"
                        >
                          <FileText className="size-4 shrink-0 text-brand-700" />
                          <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                            {subjectLabel(row.subject)}
                          </span>
                          <span className="shrink-0 text-xs text-neutral-500">
                            {formatFileSize(row.fileSize)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </section>
        ))}
    </div>
  );
}
