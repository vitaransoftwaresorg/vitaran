import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Clock, Contact, Pencil, School } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CredentialMailBar } from "@/features/auth/credential-mail-bar";
import { subjectLabel } from "@/features/schools/constants";
import { TEACHER_STATUS_LABELS } from "@/features/teachers/constants";
import { getAdminTeacher, listAdminClassTeacherSlots } from "@/services/teachers";
import { formatDateTime } from "@/utils/format";
import { capitalizeWords } from "@/features/schools/schema";

export const metadata: Metadata = { title: "Teacher Details" };

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

function Chip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-18 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-center">
      <p className="text-[9px] font-semibold tracking-wider text-white/50 uppercase">{label}</p>
      <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export default async function AdminTeacherDetailsPage({
  params,
}: PageProps<"/admin/teachers/[id]">) {
  const { id } = await params;
  const teacher = await getAdminTeacher(id);
  if (!teacher) notFound();

  const classTeacherSlots = await listAdminClassTeacherSlots(teacher.schoolId);
  const mySections = classTeacherSlots.filter((slot) => slot.teacherId === teacher.id);
  const programs = [...new Set(teacher.assignments.map((row) => row.programName))];

  return (
    <div className="space-y-3">
      <header className="flex flex-col gap-4 rounded-xl border border-brand-700 bg-linear-to-r from-brand-800 to-brand-950 px-5 py-4 text-white shadow-[0_10px_30px_-12px_rgb(25_28_95/0.55)] xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
            Teacher profile
          </p>
          <h1 className="mt-0.5 truncate text-xl font-bold sm:text-2xl">{teacher.name}</h1>
          <p className="mt-1 truncate text-sm text-white/70">{teacher.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip label="Status" value={TEACHER_STATUS_LABELS[teacher.status]} />
          <Chip label="School" value={teacher.school.code} />
          <Chip label="Programs" value={programs.length} />
          <Chip label="Assignments" value={teacher.assignments.length} />
          <Link
            href={`/admin/teachers/${teacher.id}/edit`}
            className={cn(
              buttonVariants({ size: "sm" }),
              "border border-white/20 bg-white/10 text-white hover:bg-white/20",
            )}
          >
            <Pencil className="size-3.5" />
            Edit
          </Link>
        </div>
      </header>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <Panel title="Teacher details" icon={<Contact />}>
            <Field label="Full name">{teacher.name}</Field>
            <Field label="Status">{TEACHER_STATUS_LABELS[teacher.status]}</Field>
            <Field label="Email">{teacher.email}</Field>
            <Field label="Phone">{teacher.phone}</Field>
          </Panel>

          <Panel title="School" icon={<School />}>
            <Field label="School name" span={2}>
              <Link
                href={`/admin/schools/${teacher.school.id}`}
                className="text-brand-800 underline-offset-4 hover:underline"
              >
                {teacher.school.name}
              </Link>
            </Field>
            <Field label="School ID">{teacher.school.code}</Field>
            <Field label="Type">{teacher.school.type}</Field>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Assignments" icon={<BookOpen />}>
            <Field label="Classes & subjects" span={3}>
              {teacher.assignments.length === 0 ? null : (
                <ul className="mt-1 space-y-1.5">
                  {teacher.assignments.map((item) => (
                    <li
                      key={`${item.programId}-${item.classLevel}-${item.subject}`}
                      className="rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-1.5 text-sm"
                    >
                      <span className="font-semibold text-neutral-950">{item.programName}</span>
                      <span className="text-neutral-400"> · </span>
                      Class {item.classLevel}
                      <span className="text-neutral-400"> · </span>
                      {subjectLabel(item.subject)}
                    </li>
                  ))}
                </ul>
              )}
            </Field>
            <Field label="Class teacher of" span={3}>
              {mySections.length === 0 ? null : (
                <ul className="mt-1 space-y-1.5">
                  {mySections.map((slot) => (
                    <li
                      key={
                        slot.kind === "section"
                          ? slot.sectionId
                          : `class:${slot.programId}:${slot.classLevel}`
                      }
                      className="rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-1.5 text-sm"
                    >
                      {slot.kind === "section"
                        ? `Class ${slot.classLevel}-${slot.sectionName}`
                        : `Class ${slot.classLevel}`}
                      <span className="text-neutral-400"> · </span>
                      {capitalizeWords(slot.programName)}
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </Panel>

          <Panel title="Record" icon={<Clock />}>
            <Field label="Created">{formatDateTime(teacher.createdAt)}</Field>
            <Field label="Last updated">{formatDateTime(teacher.updatedAt)}</Field>
          </Panel>
        </div>
      </div>

      <CredentialMailBar
        loginEmail={teacher.email}
        loginPhone={teacher.phone}
        password={teacher.password || null}
        setPasswordHref={`/admin/teachers/${teacher.id}/edit`}
        recipientLabel="teacher"
        target={{ kind: "admin-teacher", id: teacher.id }}
      />
    </div>
  );
}
