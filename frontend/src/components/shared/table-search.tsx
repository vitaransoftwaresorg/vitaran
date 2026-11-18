"use client";

import { Search } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type TableSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/** Compact search field used above data tables. */
export function TableSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: TableSearchProps) {
  return (
    <InputGroup className={cn("h-9 w-full bg-white sm:w-64", className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </InputGroup>
  );
}

export function foldSearch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchesSearch(query: string, ...parts: Array<string | number | null | undefined>) {
  const needle = foldSearch(query);
  if (!needle) return true;
  return parts.some((part) => foldSearch(String(part ?? "")).includes(needle));
}
