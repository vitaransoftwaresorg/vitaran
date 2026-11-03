import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Layers, MapPin, School, Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resultUploadHrefFor } from "@/features/results/constants";
import { ResultsTable } from "@/features/results/results-table";
import {
  BOARD_LABELS,
  STATUS_LABELS,
  subjectLabel,
  TYPE_LABELS,
} from "@/features/schools/constants";
import { CredentialMailBar } from "@/features/auth/credential-mail-bar";
import { uniqueSubjectsFromOfferings } from "@/features/schools/offerings";
import { SchoolDetailActions } from "@/features/schools/school-detail-actions";
import { listResultSets } from "@/services/results";
import {
  getAdminSchoolSectionStrength,
  listAdminSchoolSections,
} from "@/services/sections";
import { getSchool } from "@/services/schools";
import { formatDateTime, formatNumber } from "@/utils/format";
import { capitalizeWords } from "@/features/schools/schema";

export const metadata: Metadata = { title: "School Details" };

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

export default async function SchoolDetailsPage({ params }: PageProps<"/admin/schools/[id]">) {
  const { id } = await params;
  const school = await getSchool(id);
  if (!school) notFound();
  const [resultSets, organization, strength] = await Promise.all([
    listResultSets({ schoolId: school.id }),
    listAdminSchoolSections(school.id),
    getAdminSchoolSectionStrength(school.id),
  ]);
  const { wholeClasses, sections } = organization;
  const uploadHref = resultUploadHrefFor(school.id);

  return (
    <div className="space-y-3">
      <header className="rounded-xl border border-brand-700 bg-linear-to-r from-brand-800 to-brand-950 px-5 py-4 text-white shadow-[0_10px_30px_-12px_rgb(25_28_95/0.55)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
              School profile
            </p>
            <h1 className="mt-0.5 truncate text-xl font-bold sm:text-2xl">{school.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {school.addressLine}, {school.city}, {school.state}
          </span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <SchoolDetailActions school={school} inverted />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="Code" value={school.code} />
          <Chip label="Type" value={TYPE_LABELS[school.type]} />
          <Chip
            label="Status"
            value={
              <>
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    school.status === "ACTIVE" ? "bg-white" : "border border-white/50",
                  )}
                />
                {STATUS_LABELS[school.status]}
              </>
            }
          />
          <Chip
            label="Students"
            value={school.studentStrength ? formatNumber(school.studentStrength) : EMPTY}
          />
          <Chip label="Programs" value={school.schoolPrograms.length} />
          <Link
            href={`/admin/schools/${school.id}/students`}
            className="min-w-18 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-center transition-colors hover:bg-white/20"
          >
            <p className="text-[9px] font-semibold tracking-wider text-white/50 uppercase">
              Students
            </p>
            <p className="text-sm font-bold text-white">View</p>
          </Link>
          <Link
            href={`/admin/schools/${school.id}/programs`}
            className="min-w-18 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-center transition-colors hover:bg-white/20"
          >
            <p className="text-[9px] font-semibold tracking-wider text-white/50 uppercase">
              Programs
            </p>
            <p className="text-sm font-bold text-white">View</p>
          </Link>
          <Link
            href={`/admin/teachers?schoolId=${school.id}`}
            className="min-w-18 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-center transition-colors hover:bg-white/20"
          >
            <p className="text-[9px] font-semibold tracking-wider text-white/50 uppercase">
              Teachers
            </p>
            <p className="text-sm font-bold text-white">View</p>
          </Link>
          <Link
            href={`/admin/schools/${school.id}/teachers/new`}
            className="min-w-18 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-center transition-colors hover:bg-white/20"
          >
            <p className="text-[9px] font-semibold tracking-wider text-white/50 uppercase">Add</p>
            <p className="text-sm font-bold text-white">Teacher</p>
          </Link>
        </div>
      </header>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Panel title="School details" icon={<School />}>
          <Field label="School name">{school.name}</Field>
          <Field label="School code">{school.code}</Field>
          <Field label="Board">{BOARD_LABELS[school.board]}</Field>
          <Field label="Type">{TYPE_LABELS[school.type]}</Field>
          <Field label="School email">{school.accountEmail}</Field>
          <Field label="School mobile">{school.accountPhone}</Field>
          <Field label="Student strength">
            {school.studentStrength ? formatNumber(school.studentStrength) : null}
          </Field>
          <Field label="Principal">{school.principalName}</Field>
          <Field label="Programs" span={2}>
            {school.schoolPrograms.length > 0
              ? school.schoolPrograms.map((program) => program.programName).join(", ")
              : null}
          </Field>
          <Field label="Subjects" span={3}>
            {(() => {
              const subjects = uniqueSubjectsFromOfferings(school.schoolPrograms);
              return subjects.length > 0
                ? subjects.map((subject) => subjectLabel(subject)).join(", ")
                : null;
            })()}
          </Field>
          <Field label="Contact name">{school.contactName}</Field>
          <Field label="Contact mobile">{school.contactPhone}</Field>
          <Field label="Contact email">{school.contactEmail}</Field>
        </Panel>

        <div className="space-y-3">
          <Panel title="Address" icon={<MapPin />}>
            <Field label="Address" span={3}>
              {school.addressLine}
            </Field>
            <Field label="City">{school.city}</Field>
            <Field label="State">{school.state}</Field>
            <Field label="Pin code">{school.pincode}</Field>
          </Panel>

          <Panel title="Record" icon={<Clock />}>
            <Field label="Status">{STATUS_LABELS[school.status]}</Field>
            <Field label="Registered">{formatDateTime(school.createdAt)}</Field>
            <Field label="Last updated">{formatDateTime(school.updatedAt)}</Field>
            <Field label="Internal notes" span={3}>
              {school.notes && <span className="whitespace-pre-line">{school.notes}</span>}
            </Field>
          </Panel>
        </div>
      </div>

      <Panel title="Classes & sections" icon={<Layers />}>
        <Field label="Strength used" span={3}>
          {strength.studentStrength == null
            ? `${strength.used} seats (no ceiling)`
            : `${strength.used} / ${strength.studentStrength}`}
        </Field>
        <Field label="Organization" span={3}>
          {wholeClasses.length === 0 && sections.length === 0 ? null : (
            <ul className="mt-1 grid gap-1.5 sm:grid-cols-2">
              {wholeClasses.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/schools/${school.id}/students`}
                    className="block rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-1.5 text-sm transition-colors hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span className="font-semibold text-neutral-950">Class {row.classLevel}</span>
                    <span className="text-neutral-400"> · no section · </span>
                    {capitalizeWords(row.programName)}
                    <span className="text-neutral-400"> · </span>
                    {row.studentCount} seats
                  </Link>
                </li>
              ))}
              {sections.map((section) => (
                <li key={section.id}>
                  <Link
                    href={`/admin/schools/${school.id}/students`}
                    className="block rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-1.5 text-sm transition-colors hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span className="font-semibold text-neutral-950">
                      Class {section.classLevel}-{section.name}
                    </span>
                    <span className="text-neutral-400"> · </span>
                    {capitalizeWords(section.programName)}
                    <span className="text-neutral-400"> · </span>
                    {section.studentCount} seats
                    {section.classTeacher ? (
                      <>
                        <span className="text-neutral-400"> · </span>
                        CT {capitalizeWords(section.classTeacher.name)}
                      </>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Field>
      </Panel>

      <ResultsTable
        resultSets={resultSets}
        uploadHref={uploadHref}
        title="Results"
        showSchool={false}
        headerAction={
          resultSets.length > 0 && (
            <Link
              href={uploadHref}
              className={buttonVariants({ size: "sm", className: "bg-brand-900 text-white hover:bg-brand-800" })}
            >
              <Upload />
              Upload results
            </Link>
          )
        }
      />

      <CredentialMailBar
        loginEmail={school.accountEmail ?? ""}
        loginPhone={school.accountPhone}
        password={school.password}
        setPasswordHref={`/admin/schools/${school.id}/edit`}
        recipientLabel="school"
        target={{ kind: "school", id: school.id }}
      />
    </div>
  );
}
