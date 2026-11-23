import Link from "next/link";
import { FileText } from "lucide-react";
import { subjectLabel } from "./constants";
import type { SchoolStudentResource } from "@/services/schools";
import { formatFileSize } from "@/features/documents/constants";

type SchoolStudentResourcesPanelProps = {
  resources: SchoolStudentResource[];
  /** Base path for viewing a PDF, e.g. `/school/resources/student`. */
  viewBase: string;
};

/** Uploaded per-class PDFs for a customized school. */
export function SchoolStudentResourcesPanel({
  resources,
  viewBase,
}: SchoolStudentResourcesPanelProps) {
  if (resources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        No student resource PDFs uploaded yet.
      </div>
    );
  }

  const byClass = new Map<number, SchoolStudentResource[]>();
  for (const row of resources) {
    const list = byClass.get(row.classLevel) ?? [];
    list.push(row);
    byClass.set(row.classLevel, list);
  }

  return (
    <div className="space-y-4">
      {[...byClass.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([classLevel, rows]) => (
          <section
            key={classLevel}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
          >
            <header className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-neutral-950">Class {classLevel}</h3>
            </header>
            <ul className="divide-y divide-neutral-100">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`${viewBase}/${row.classLevel}/${encodeURIComponent(row.subject)}`}
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
    </div>
  );
}
