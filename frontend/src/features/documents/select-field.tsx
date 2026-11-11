"use client";

import { useState } from "react";
import { FieldError } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectItemOption = { value: string; label: string; hint?: string };

type SelectFieldProps = {
  name: string;
  label: string;
  items: SelectItemOption[];
  placeholder?: string;
  /** Controlled value. Prefer this when the selection can change after mount. */
  value?: string;
  /** Initial value for uncontrolled usage. Ignored when `value` is set. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  errors?: string[];
};

export function SelectField({
  name,
  label,
  items,
  placeholder,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled,
  className,
  errors,
}: SelectFieldProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : uncontrolled;
  const invalid = errors?.length ? true : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={name} className="text-[13px] font-medium text-neutral-800">
        {label} <span className="text-brand-600">*</span>
      </label>
      <Select
        name={name}
        items={items}
        disabled={disabled}
        value={value || null}
        onValueChange={(next: string | null) => {
          if (!next) return;
          if (!controlled) setUncontrolled(next);
          onValueChange?.(next);
        }}
      >
        <SelectTrigger
          id={name}
          aria-invalid={invalid}
          className="w-full rounded-lg border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-xs transition-[border-color,box-shadow] hover:border-brand-300 focus-visible:border-brand-600 focus-visible:ring-brand-600/15 data-popup-open:border-brand-600 data-popup-open:ring-3 data-popup-open:ring-brand-600/15 data-[size=default]:h-11"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          sideOffset={6}
          className="max-h-72 rounded-xl p-1.5 shadow-[0_16px_40px_-12px_rgb(25_28_95/0.28)] ring-brand-100"
        >
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="rounded-lg py-2 pr-8 pl-2.5 text-neutral-800 focus:bg-brand-50 focus:text-brand-900 data-selected:bg-brand-50 data-selected:font-semibold data-selected:text-brand-900"
            >
              {item.label}
              {item.hint && <span className="ml-auto text-xs font-normal text-neutral-400">{item.hint}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {invalid && <FieldError>{errors?.[0]}</FieldError>}
    </div>
  );
}
