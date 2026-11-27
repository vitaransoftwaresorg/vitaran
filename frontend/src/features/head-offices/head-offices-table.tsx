"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconRowActions } from "@/components/shared/icon-row-actions";
import { matchesSearch, TableSearch } from "@/components/shared/table-search";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rememberAdminNavLabel } from "@/features/admin/nav-labels";
import { useResetOnScopeChange } from "@/hooks/use-reset-on-scope-change";
import type { HeadOfficeListItem } from "@/types/head-office";
import { deleteHeadOfficeAction } from "./actions";

export function HeadOfficesTable({ offices }: { offices: HeadOfficeListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  useResetOnScopeChange(`head-offices:${offices.length}:${offices[0]?.id ?? ""}`, () =>
    setQuery(""),
  );

  const filtered = useMemo(
    () =>
      offices.filter((office) =>
        matchesSearch(
          query,
          office.name,
          office.code,
          office.contactName,
          office.contactEmail,
          office.city,
          office.state,
        ),
      ),
    [offices, query],
  );

  if (offices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
        <p className="text-sm font-semibold text-neutral-950">No head offices yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          Add the first office and attach schools from the school list.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/40 px-3 py-2.5 sm:px-5">
        <p className="text-xs font-medium text-neutral-500 tabular-nums">
          {filtered.length === offices.length
            ? `${offices.length} office${offices.length === 1 ? "" : "s"}`
            : `${filtered.length} of ${offices.length} offices`}
        </p>
        <TableSearch value={query} onChange={setQuery} placeholder="Search offices" />
      </div>
      {filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-500">No matching offices.</p>
      ) : (
        <div className="overflow-x-auto overflow-y-clip">
          <Table>
            <TableHeader>
              <TableRow className="border-brand-100 bg-brand-50/60 hover:bg-brand-50/60">
                <TableHead className="pl-5 text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  Office
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  Contact
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  Location
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  Schools
                </TableHead>
                <TableHead className="w-32 pr-5 text-right text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((office) => (
                <TableRow key={office.id} className="border-brand-100/70 hover:bg-brand-50/40">
                  <TableCell className="py-3.5 pl-5">
                    <Link
                      href={`/admin/head-offices/${office.id}`}
                      className="group block min-w-0"
                      onClick={() => rememberAdminNavLabel("office", office.id, office.name)}
                    >
                      <p className="font-semibold text-neutral-950 group-hover:text-brand-800 group-hover:underline">
                        {office.name}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-neutral-500">{office.code}</p>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-neutral-800">{office.contactName}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{office.contactPhone}</p>
                  </TableCell>
                  <TableCell className="text-sm text-neutral-800">
                    {office.city}, {office.state}
                  </TableCell>
                  <TableCell className="tabular-nums text-neutral-800">
                    {office.schoolCount}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <IconRowActions
                      viewHref={`/admin/head-offices/${office.id}`}
                      editHref={`/admin/head-offices/${office.id}/edit`}
                      label={office.name}
                      deleteDisabled={pending}
                      onDelete={() => {
                        if (!confirm(`Delete “${office.name}”? Schools stay registered.`)) {
                          return;
                        }
                        startTransition(async () => {
                          const result = await deleteHeadOfficeAction(office.id);
                          if (!result.ok) {
                            toast.error(result.message);
                            return;
                          }
                          toast.success("Head office deleted");
                          router.refresh();
                        });
                      }}
                    />
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
