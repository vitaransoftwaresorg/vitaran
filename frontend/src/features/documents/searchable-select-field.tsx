"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SelectItemOption } from "./select-field";

type SearchableSelectFieldProps = {
  name: string;
  label: string;
  items: SelectItemOption[];
  placeholder?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  errors?: string[];
};

export function SearchableSelectField({
  name,
  label,
  items,
  placeholder = "Select…",
  defaultValue,
  onValueChange,
  disabled,
  errors,
}: SearchableSelectFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const invalid = errors?.length ? true : undefined;

  const selected = items.find((item) => item.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.hint?.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const pick = (next: string) => {
    setValue(next);
    onValueChange?.(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-col gap-2">
      <input type="hidden" name={name} value={value} />
      <label className="text-[13px] font-medium text-neutral-800">
        {label} <span className="text-brand-600">*</span>
      </label>
      <button
        type="button"
        disabled={disabled}
        aria-invalid={invalid}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 text-left text-sm shadow-xs transition-[border-color,box-shadow] hover:border-brand-300 focus-visible:border-brand-600 focus-visible:ring-3 focus-visible:ring-brand-600/15 disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-destructive",
          open && "border-brand-600 ring-3 ring-brand-600/15",
        )}
      >
        <span className={cn("truncate", !selected && "text-neutral-400")}>
          {selected ? (
            <>
              {selected.label}
              {selected.hint && (
                <span className="ml-2 font-mono text-xs text-neutral-400">{selected.hint}</span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_16px_40px_-12px_rgb(25_28_95/0.28)]">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
            <Search className="size-4 text-neutral-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search schools…"
              className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
              autoFocus
            />
          </div>
          <ul className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-neutral-500">No schools found.</li>
            ) : (
              filtered.map((item) => {
                const active = item.value === value;
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      onClick={() => pick(item.value)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-brand-50 font-semibold text-brand-900"
                          : "text-neutral-800 hover:bg-brand-50/70",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && (
                        <span className="shrink-0 font-mono text-xs text-neutral-400">{item.hint}</span>
                      )}
                      {active && <Check className="size-4 shrink-0 text-brand-800" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
      {invalid && <FieldError>{errors?.[0]}</FieldError>}
    </div>
  );
}
