import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Clock, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { subjectLabel } from "@/features/schools/constants";
import { SchoolTypeBadge } from "@/features/schools/school-type-badge";
import { capitalizeWords } from "@/features/schools/schema";
import { getProgram } from "@/services/programs";
import { formatDateTime } from "@/utils/format";

export const metadata: Metadata = { title: "Program Details" };

const EMPTY = "—";

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
      <h2 className="flex items-center gap-2.5 border-b border-brand-100 bg-brand-50/60 px-4 py-2 text-sm font-semibold text-brand-950">
        <span className="flex size-6 items-center justify-center rounded-md border border-brand-200 bg-white text-brand-700 [&_svg]:size-3.5">
          {icon}
        </span>
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

function Field({ label, span, children }: { label: string; span?: 2 | 3; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", span === 2 && "sm:col-span-2", span === 3 && "col-span-2 sm:col-span-3")}>
      <dt className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-neutral-950">{children ?? EMPTY}</dd>
    </div>
  );
}

export default async function ProgramDetailsPage({
  params,
}: PageProps<"/admin/programs/[id]">) {
  const { id } = await params;
  const program = await getProgram(id);
  if (!program) notFound();

  return (
    <div className="space-y-3">
      <header className="flex flex-col gap-4 rounded-xl border border-brand-700 bg-linear-to-r from-brand-800 to-brand-950 px-5 py-4 text-white shadow-[0_10px_30px_-12px_rgb(25_28_95/0.55)] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
            Catalog program
          </p>
          <h1 className="mt-0.5 truncate text-xl font-bold sm:text-2xl">
            {capitalizeWords(program.name)}
          </h1>
          <p className="mt-1 font-mono text-sm text-white/70">{program.code}</p>
        </div>
        <Link
          href={`/admin/programs/${program.id}/edit`}
          className={cn(
            buttonVariants({ size: "sm" }),
            "border border-white/20 bg-white/10 text-white hover:bg-white/20",
          )}
        >
          <Pencil className="size-3.5" />
          Edit
        </Link>
      </header>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Panel title="Program details" icon={<BookOpen />}>
          <Field label="Name">{capitalizeWords(program.name)}</Field>
          <Field label="Code">{program.code}</Field>
          <Field label="Type">
            <SchoolTypeBadge type={program.type ?? "REGULAR"} size="sm" />
          </Field>
          <Field label="Year">{program.year}</Field>
          <Field label="Classes">
            {program.classFrom}–{program.classTo}
          </Field>
          <Field label="Subjects" span={3}>
            {program.subjects.map((subject) => subjectLabel(subject)).join(", ")}
          </Field>
        </Panel>

        <Panel title="Record" icon={<Clock />}>
          <Field label="Created">{formatDateTime(program.createdAt)}</Field>
          <Field label="Last updated">{formatDateTime(program.updatedAt)}</Field>
        </Panel>
      </div>
    </div>
  );
}
