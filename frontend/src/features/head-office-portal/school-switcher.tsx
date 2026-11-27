"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Loader2, School, Search } from "lucide-react";
import { toast } from "sonner";
import { matchesSearch } from "@/components/shared/table-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  openHeadOfficeSchoolWorkspaceAction,
  switchHeadOfficeSchoolAction,
} from "@/features/head-office-portal/actions";
import { cn } from "@/lib/utils";
import type { HeadOfficeSchoolOption } from "@/types/head-office-portal";

type SchoolSwitcherProps = {
  schools: HeadOfficeSchoolOption[];
  currentSchoolId?: string | null;
  className?: string;
  /** Already in a school workspace — switch keeps the current section. */
  inWorkspace?: boolean;
};

export function SchoolSwitcher({
  schools,
  currentSchoolId = null,
  className,
  inWorkspace = false,
}: SchoolSwitcherProps) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const active = useMemo(
    () =>
      [...schools]
        .filter((school) => school.status === "ACTIVE")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [schools],
  );

  const current = active.find((school) => school.id === currentSchoolId) ?? null;

  const filtered = useMemo(
    () =>
      active.filter((school) => matchesSearch(query, school.name, school.code)),
    [active, query],
  );

  if (active.length === 0) {
    return (
      <p className={cn("text-xs text-neutral-500", className)}>
        No active schools linked yet.
      </p>
    );
  }

  function pick(schoolId: string) {
    if (schoolId === currentSchoolId) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startTransition(async () => {
      const result = inWorkspace
        ? await switchHeadOfficeSchoolAction(
            schoolId,
            pathname.startsWith("/school") ? pathname : "/school",
          )
        : await openHeadOfficeSchoolWorkspaceAction(schoolId);
      if (result && !result.ok) toast.error(result.message);
    });
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="hidden text-sm font-semibold text-neutral-950 sm:inline">Select School:</span>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
          if (next) {
            requestAnimationFrame(() => searchRef.current?.focus());
          }
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              aria-label="Switch school"
              className="h-8! min-w-0 max-w-[min(100%,20rem)] justify-between gap-2 bg-white px-2.5 font-normal sm:max-w-xs"
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            {pending ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-neutral-400" />
            ) : (
              <School className="size-3.5 shrink-0 text-brand-800" />
            )}
            <span className="min-w-0 truncate text-left">
              {current ? (
                <>
                  <span className="font-medium text-neutral-950">{current.name}</span>
                  <span className="ml-1.5 font-mono text-xs text-neutral-500">{current.code}</span>
                </>
              ) : (
                <span className="text-neutral-500">Select a school</span>
              )}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-neutral-400" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-[min(100vw-2rem,22rem)] min-w-[16rem] p-0"
        >
          <div
            className="border-b border-brand-100 p-2"
            onKeyDown={(event) => event.stopPropagation()}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search by name or code"
                aria-label="Search schools"
                className="h-8 bg-white pl-8!"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-neutral-500">No matching schools</p>
            ) : (
              filtered.map((school) => {
                const selected = school.id === currentSchoolId;
                return (
                  <DropdownMenuItem
                    key={school.id}
                    disabled={pending}
                    onClick={() => pick(school.id)}
                    className={cn(
                      "cursor-pointer gap-2 py-2",
                      selected && "bg-brand-50 font-medium text-brand-950",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-brand-100 bg-white text-brand-800">
                      <School className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-neutral-950">{school.name}</span>
                      <span className="block font-mono text-[11px] text-neutral-500">
                        {school.code}
                      </span>
                    </span>
                    {selected ? <Check className="size-4 shrink-0 text-brand-800" /> : null}
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

          <DropdownMenuSeparator className="my-0" />
          <p className="px-3 py-1.5 text-[11px] text-neutral-500 tabular-nums">
            {query.trim()
              ? `${filtered.length} of ${active.length} schools`
              : `${active.length} school${active.length === 1 ? "" : "s"}`}
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
