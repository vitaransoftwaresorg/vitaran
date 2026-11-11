"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TYPE_LABELS } from "@/features/schools/constants";
import type { ListFilters } from "@/services/list-filters";
import type { SchoolRef } from "@/types/document";
import type { LearningProgram } from "@/types/program";
import { SCHOOL_TYPES, type SchoolType } from "@/types/school";
import { testItems } from "./constants";
import { FILTER_PARAMS, hasListFilters } from "./list-filters";

const ALL = "ALL";

type FilterKey = keyof typeof FILTER_PARAMS;

export type FilterSchool = SchoolRef & { type: SchoolType };

const testOptions = [{ value: ALL, label: "All test nos" }, ...testItems];
const typeOptions = [
  { value: ALL, label: "All types" },
  ...SCHOOL_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] })),
];

type FilterSelectProps = {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  className: string;
};

function FilterSelect({ label, value, items, onChange, className }: FilterSelectProps) {
  const active = value !== ALL;
  return (
    <Select items={items} value={value} onValueChange={(next) => onChange(next as string)}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-9 rounded-lg border-neutral-200 bg-white text-sm text-neutral-700 shadow-none hover:border-brand-300",
          active && "border-brand-300 bg-brand-50 font-medium text-brand-900",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type ListFiltersBarProps = {
  filters: ListFilters;
  schools: FilterSchool[];
  /** When set, shows a catalog program filter (answer keys). */
  programs?: LearningProgram[];
};

/**
 * Filters follow the content model: test series → program → type
 * (and customized school when type is Customized).
 */
export function ListFiltersBar({ filters, schools, programs }: ListFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const showPrograms = Boolean(programs?.length);
  const showSchools = filters.type === "CUSTOMIZED";
  const programOptions = [
    { value: ALL, label: "All programs" },
    ...(programs ?? []).map((program) => ({ value: program.code, label: program.name })),
  ];
  const schoolOptions = [
    { value: ALL, label: "All customized schools" },
    ...schools
      .filter((school) => school.type === "CUSTOMIZED")
      .map((school) => ({ value: school.id, label: school.name })),
  ];

  const update = (updates: Partial<Record<FilterKey, string | null>>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      const param = FILTER_PARAMS[key as FilterKey];
      if (value && value !== ALL) params.set(param, value);
      else params.delete(param);
    }
    params.sort();
    const current = new URLSearchParams(searchParams);
    current.sort();
    if (params.toString() === current.toString()) return;

    startTransition(() => {
      router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
    });
  };

  const changeType = (type: string) => {
    update({ type, ...(type !== "CUSTOMIZED" && { school: null }) });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <FilterSelect
        label="Filter by test"
        value={filters.testNumber ? String(filters.testNumber) : ALL}
        items={testOptions}
        onChange={(test) => update({ test })}
        className="w-32"
      />
      {showPrograms && (
        <FilterSelect
          label="Filter by program"
          value={filters.program ?? ALL}
          items={programOptions}
          onChange={(program) => update({ program })}
          className="min-w-40 max-w-56"
        />
      )}
      <FilterSelect
        label="Filter by school type"
        value={filters.type ?? ALL}
        items={typeOptions}
        onChange={changeType}
        className="w-36"
      />
      {showSchools && (
        <FilterSelect
          label="Filter by customized school"
          value={filters.schoolId ?? ALL}
          items={schoolOptions}
          onChange={(school) => update({ school })}
          className="w-56"
        />
      )}
      {hasListFilters(filters) && (
        <Button
          type="button"
          variant="outline"
          onClick={() => update({ test: null, program: null, type: null, school: null })}
          className="h-9 border-brand-200 bg-white font-semibold text-brand-900 hover:border-brand-900 hover:bg-brand-900 hover:text-white"
        >
          <X className="size-4" />
          Clear filters
        </Button>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-brand-700" aria-label="Updating" />}
    </div>
  );
}
