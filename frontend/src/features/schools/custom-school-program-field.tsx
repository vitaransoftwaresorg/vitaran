"use client";

import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const CLASS_LEVELS = Array.from({ length: 12 }, (_, index) => index + 1);

type CustomSchoolProgramFieldProps = {
  name: string;
  classes: string[];
  onClassesChange: (next: string[]) => void;
  errors?: {
    customProgramName?: string;
    customClasses?: string;
  };
};

export function CustomSchoolProgramField({
  name,
  classes,
  onClassesChange,
  errors,
}: CustomSchoolProgramFieldProps) {
  const toggleClass = (classLevel: number, checked: boolean) => {
    const value = String(classLevel);
    if (checked) {
      onClassesChange(classes.includes(value) ? classes : [...classes, value]);
      return;
    }
    onClassesChange(classes.filter((item) => item !== value));
  };

  return (
    <div className="space-y-5">
      <input type="hidden" name="customProgramName" value={name.trim() || "Custom Program"} />

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Classes *
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {CLASS_LEVELS.map((level) => {
            const value = String(level);
            const id = `custom-class-${level}`;
            const active = classes.includes(value);
            return (
              <label key={level} htmlFor={id} className="flex cursor-pointer items-center gap-2">
                <input
                  id={id}
                  type="checkbox"
                  name="customClasses"
                  value={value}
                  className="size-4 rounded border-neutral-300 accent-brand-800"
                  checked={active}
                  onChange={(event) => toggleClass(level, event.target.checked)}
                />
                <span className={cn("text-sm font-medium", active ? "text-neutral-950" : "text-neutral-700")}>
                  Class {level}
                </span>
              </label>
            );
          })}
        </div>
        {errors?.customClasses && (
          <FieldError className="mt-2">{errors.customClasses}</FieldError>
        )}
      </div>
    </div>
  );
}
