"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { matchesSearch, TableSearch } from "@/components/shared/table-search";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EnterSchoolButton } from "@/features/head-office-portal/enter-school-button";
import { SchoolStatusBadge } from "@/features/schools/school-status-badge";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import type { SchoolSummary } from "@/types/school";

export function HeadOfficeSchoolsTable({ schools }: { schools: SchoolSummary[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      schools.filter((school) =>
        matchesSearch(query, school.name, school.code, school.city, school.state, school.contactName),
      ),
    [schools, query],
  );

  if (schools.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
        <p className="text-sm font-semibold text-neutral-950">No schools yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          Schools attached to this head office by an admin will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/40 px-3 py-2.5 sm:px-5">
        <p className="text-xs font-medium text-neutral-500 tabular-nums">
          {filtered.length === schools.length
            ? `${schools.length} school${schools.length === 1 ? "" : "s"}`
            : `${filtered.length} of ${schools.length} schools`}
        </p>
        <TableSearch value={query} onChange={setQuery} placeholder="Search schools" />
      </div>
      {filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-500">No matching schools.</p>
      ) : (
        <div className="overflow-x-auto overflow-y-clip">
          <Table>
            <TableHeader>
              <TableRow className="border-brand-100 bg-brand-50/60 hover:bg-brand-50/60">
                <TableHead className="pl-5 text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  School
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  Type
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  Location
                </TableHead>
                <TableHead className="pr-5 text-right text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((school) => (
                <TableRow key={school.id} className="border-brand-100/70 hover:bg-brand-50/40">
                  <TableCell className="py-3.5 pl-5">
                    <Link
                      href={`/head-office/schools/${school.id}`}
                      className="group block min-w-0"
                    >
                      <p className="font-semibold text-neutral-950 group-hover:text-brand-800 group-hover:underline">
                        {school.name}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-neutral-500">{school.code}</p>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <SchoolTypeBadge type={school.type} size="sm" />
                  </TableCell>
                  <TableCell>
                    <SchoolStatusBadge status={school.status} />
                  </TableCell>
                  <TableCell className="text-sm text-neutral-800">
                    {school.city}, {school.state}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {school.status === "ACTIVE" ? (
                      <EnterSchoolButton schoolId={school.id} label="Open school" tone="compact" />
                    ) : (
                      <span className="text-xs text-neutral-400">Inactive</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
