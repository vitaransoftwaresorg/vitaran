"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { programLabel, soleSchoolForCustomProgram, TYPE_LABELS } from "@/features/schools/constants";
import type { LearningProgram } from "@/types/program";
import { ANSWER_KEYS_PATH } from "./constants";
import { DRIVE_TESTS, type DrivePath, type DriveSchool } from "./drive-path";

const ALL = "ALL";

type AnswerKeysFiltersProps = {
  path: DrivePath;
  programs: LearningProgram[];
  schools: DriveSchool[];
};

function hrefFor(path: DrivePath, programs: LearningProgram[] = []) {
  const params = new URLSearchParams();
  const programType = programs.find((program) => program.code === path.program)?.type;
  const type = programType ?? (path.schoolId ? "CUSTOMIZED" : path.program ? "REGULAR" : undefined);
  if (type) params.set("type", type);
  if (path.program) params.set("program", path.program);
  if (path.schoolId) params.set("school", path.schoolId);
  if (path.testNumber) params.set("test", String(path.testNumber));
  const q = params.toString();
  return q ? `${ANSWER_KEYS_PATH}?${q}` : ANSWER_KEYS_PATH;
}

function FilterSelect({
  label,
  value,
  items,
  onChange,
  className,
  disabled,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const active = value !== ALL;
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as string)}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-9 rounded-lg border-brand-100 bg-white text-sm text-brand-600 shadow-none transition-colors hover:border-brand-200 hover:bg-brand-50/60",
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

export function AnswerKeysFilters({ path, programs, schools }: AnswerKeysFiltersProps) {
  const router = useRouter();
  const selectedProgram = programs.find((program) => program.code === path.program);
  const customProgram = selectedProgram?.type === "CUSTOMIZED";
  const customized = schools.filter((school) => school.type === "CUSTOMIZED");
  const soleSchool = soleSchoolForCustomProgram(selectedProgram, customized);
  const schoolId = path.schoolId ?? soleSchool?.id;

  const programValue = path.program
    ? path.program
    : path.schoolId
      ? `s:${path.schoolId}`
      : ALL;

  const programItems = [
    { value: ALL, label: "All programs" },
    ...programs.map((program) => ({
      value: program.code,
      label: `${programLabel(program.code, program.name)} (${TYPE_LABELS[program.type ?? "REGULAR"]})`,
    })),
    ...customized
      .filter(
        (school) =>
          !programs.some(
            (program) =>
              program.type === "CUSTOMIZED" &&
              (school.programs?.includes(program.code) ||
                soleSchoolForCustomProgram(program, [school])),
          ),
      )
      .map((school) => ({
        value: `s:${school.id}`,
        label: school.name,
      })),
  ];

  const schoolItems = [
    { value: ALL, label: "All schools" },
    ...customized
      .filter((school) => school.programs?.includes(path.program!))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((school) => ({ value: school.id, label: school.name })),
  ];

  const testItems = [
    { value: ALL, label: "All tests" },
    ...DRIVE_TESTS.map((n) => ({ value: String(n), label: `Test ${n}` })),
  ];

  const go = (next: DrivePath) => {
    router.push(hrefFor(next, programs));
  };

  const onProgram = (value: string) => {
    if (value === ALL) {
      go({});
      return;
    }
    if (value.startsWith("s:")) {
      go({
        schoolId: value.slice(2),
        testNumber: path.testNumber,
      });
      return;
    }
    const program = programs.find((item) => item.code === value);
    go({
      program: value,
      schoolId: soleSchoolForCustomProgram(program, customized)?.id,
      testNumber: path.testNumber,
    });
  };

  const onSchool = (value: string) => {
    if (!path.program) return;
    if (value === ALL) {
      go({ program: path.program, testNumber: path.testNumber });
      return;
    }
    go({
      program: path.program,
      schoolId: value,
      testNumber: path.testNumber,
    });
  };

  const onTest = (value: string) => {
    const owner = {
      program: path.program,
      schoolId,
    };
    if (!path.program && !schoolId) return;
    if (customProgram && !schoolId) return;
    if (value === ALL) {
      go({ ...owner });
      return;
    }
    go({
      ...owner,
      testNumber: Number(value),
    });
  };

  const testReady = customProgram ? Boolean(schoolId) : Boolean(path.program || schoolId);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <FilterSelect
        label="Program"
        value={programValue}
        items={programItems}
        onChange={onProgram}
        className="min-w-40 max-w-52"
      />
      {customProgram && !soleSchool ? (
        <FilterSelect
          label="School"
          value={path.schoolId ?? ALL}
          items={schoolItems}
          onChange={onSchool}
          className="min-w-40 max-w-52"
        />
      ) : null}
      <FilterSelect
        label="Test"
        value={path.testNumber ? String(path.testNumber) : ALL}
        items={testItems}
        onChange={onTest}
        disabled={!testReady}
        className="w-32"
      />
    </div>
  );
}
