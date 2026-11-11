"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconRowActions } from "@/components/shared/icon-row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { subjectLabel, TYPE_LABELS } from "@/features/schools/constants";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import { capitalizeWords } from "@/features/schools/schema";
import type { LearningProgram } from "@/types/program";
import { deleteProgramAction } from "./actions";

function byTypeThenName(programs: LearningProgram[]) {
  const regular = programs.filter((program) => (program.type ?? "REGULAR") !== "CUSTOMIZED");
  const customized = programs.filter((program) => program.type === "CUSTOMIZED");
  return { regular, customized };
}

export function ProgramsTable({ programs }: { programs: LearningProgram[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { regular, customized } = byTypeThenName(programs);

  if (programs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
        <p className="text-sm font-semibold text-neutral-950">No programs yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          Create the first catalog program schools can enrol in.
        </p>
      </div>
    );
  }

  const renderRow = (program: LearningProgram) => (
    <TableRow key={program.id} className="border-brand-100/70 hover:bg-brand-50/40">
      <TableCell className="py-3.5 pl-5">
        <Link href={`/admin/programs/${program.id}`} className="group block min-w-0">
          <p className="font-semibold text-neutral-950 group-hover:text-brand-800 group-hover:underline">
            {capitalizeWords(program.name)}
          </p>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">{program.code}</p>
        </Link>
      </TableCell>
      <TableCell>
        <SchoolTypeBadge type={program.type ?? "REGULAR"} size="sm" />
      </TableCell>
      <TableCell className="tabular-nums text-neutral-800">{program.year}</TableCell>
      <TableCell className="tabular-nums text-neutral-800">
        {program.classFrom}–{program.classTo}
      </TableCell>
      <TableCell className="hidden max-w-72 md:table-cell">
        <span className="line-clamp-2 text-sm text-neutral-600">
          {program.subjects.map((subject) => subjectLabel(subject)).join(", ")}
        </span>
      </TableCell>
      <TableCell className="pr-5 text-right">
        <IconRowActions
          viewHref={`/admin/programs/${program.id}`}
          editHref={`/admin/programs/${program.id}/edit`}
          label={program.name}
          deleteDisabled={pending}
          onDelete={() => {
            if (!confirm(`Delete “${program.name}”? Schools using it cannot be deleted.`)) {
              return;
            }
            startTransition(async () => {
              const result = await deleteProgramAction(program.id);
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success("Program deleted");
              router.refresh();
            });
          }}
        />
      </TableCell>
    </TableRow>
  );

  const section = (type: keyof typeof TYPE_LABELS, rows: LearningProgram[]) =>
    rows.length === 0 ? null : (
      <>
        <TableRow className="border-brand-100 bg-neutral-50 hover:bg-neutral-50">
          <TableCell
            colSpan={6}
            className="py-2 pl-5 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase"
          >
            {TYPE_LABELS[type]}
          </TableCell>
        </TableRow>
        {rows.map(renderRow)}
      </>
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_12px_32px_-20px_rgb(25_28_95/0.35)]">
      <Table>
        <TableHeader>
          <TableRow className="border-brand-100 bg-brand-50/60 hover:bg-brand-50/60">
            <TableHead className="pl-5 text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
              Program
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
              Type
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
              Year
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
              Classes
            </TableHead>
            <TableHead className="hidden text-[11px] font-semibold tracking-wider text-brand-700 uppercase md:table-cell">
              Subjects
            </TableHead>
            <TableHead className="w-32 pr-5 text-right text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {section("REGULAR", regular)}
          {section("CUSTOMIZED", customized)}
        </TableBody>
      </Table>
    </div>
  );
}
