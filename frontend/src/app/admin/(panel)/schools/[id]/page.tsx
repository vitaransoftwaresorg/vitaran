import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, GraduationCap, Layers, MapPin, School, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BOARD_LABELS,
  STATUS_LABELS,
  subjectLabel,
  TYPE_LABELS,
} from "@/features/schools/constants";
import { CredentialMailBar } from "@/features/auth/credential-mail-bar";
import { uniqueSubjectsFromOfferings } from "@/features/schools/offerings";
import { SchoolDetailActions } from "@/features/schools/school-detail-actions";
import { STUDENTS_PATH } from "@/features/students/school-roster";
import {
  getAdminSchoolSectionStrength,
  listAdminSchoolSections,
} from "@/services/sections";
import { getSchool } from "@/services/schools";
import { listAdminClassTeacherSlots } from "@/services/teachers";
import { formatDateTime, formatNumber } from "@/utils/format";
import { capitalizeWords } from "@/features/schools/schema";

const linkBtn =
  "inline-flex items-center gap-1.5 font-medium text-brand-900 transition-colors hover:text-brand-700 hover:underline";

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
  const [organization, strength, classTeacherSlots] = await Promise.all([
    listAdminSchoolSections(school.id),
    getAdminSchoolSectionStrength(school.id),
    listAdminClassTeacherSlots(school.id),
  ]);
  const { wholeClasses, sections } = organization;
  const classCtByKey = new Map(
    classTeacherSlots
      .filter((slot) => slot.kind === "class")
      .map((slot) => [`${slot.programId}:${slot.classLevel}`, slot] as const),
  );
  const classRows = [
    ...wholeClasses.map((row) => {
      const ct = classCtByKey.get(`${row.programId}:${row.classLevel}`);
      return {
        key: `w-${row.id}`,
        classLevel: row.classLevel,
        section: "A",
        programName: row.programName,
        seats: row.studentCount,
        teacherId: ct?.teacherId ?? null,
        teacherName: ct?.teacherName ?? null,
      };
    }),
    ...sections.map((section) => ({
      key: `s-${section.id}`,
      classLevel: section.classLevel,
      section: section.name,
      programName: section.programName,
      seats: section.studentCount,
      teacherId: section.classTeacher?.teacherId ?? null,
      teacherName: section.classTeacher?.name ?? null,
    })),
  ].sort(
    (a, b) =>
      a.classLevel - b.classLevel ||
      a.section.localeCompare(b.section) ||
      a.programName.localeCompare(b.programName),
  );
  const studentsHref = `${STUDENTS_PATH}?${new URLSearchParams({ school: school.id })}`;
  const teachersHref = `/admin/teachers?school=${school.id}`;
  const seatsUsedLabel =
    strength.studentStrength == null
      ? `${formatNumber(strength.used)} seats assigned`
      : `${formatNumber(strength.used)} / ${formatNumber(strength.studentStrength)} seats`;

  const schoolId = school.id;
  function classStudentsHref(classLevel: number, section: string) {
    return `${STUDENTS_PATH}?${new URLSearchParams({
      school: schoolId,
      class: String(classLevel),
      section,
    })}`;
  }

  return (
    <div className="space-y-3">
      <header className="rounded-xl border border-brand-700 bg-linear-to-r from-brand-800 to-brand-950 px-5 py-4 text-white shadow-[0_10px_30px_-12px_rgb(25_28_95/0.55)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {school.hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- auth-proxied school logo
              <img
                src={`/admin/schools/${school.id}/logo?v=${encodeURIComponent(school.updatedAt)}`}
                alt={`${school.name} logo`}
                className="size-14 shrink-0 rounded-xl border border-white/20 bg-white object-contain p-1"
              />
            ) : null}
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
            href={`/admin/teachers?school=${school.id}`}
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

      <section className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/60 px-4 py-2.5">
          <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-950">
            <span className="flex size-6 items-center justify-center rounded-md border border-brand-200 bg-white text-brand-700 [&_svg]:size-3.5">
              <Layers />
            </span>
            Classes & sections
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-medium text-neutral-600 tabular-nums">{seatsUsedLabel}</span>
            <Link
              href={studentsHref}
              className="font-semibold text-brand-900 transition-colors hover:text-brand-700"
            >
              View students
            </Link>
          </div>
        </div>

        {classRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            No classes set up yet. Add classes from the school portal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-brand-100 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Section</th>
                  <th className="px-4 py-2.5">Program</th>
                  <th className="px-4 py-2.5 text-right">Seats</th>
                  <th className="px-4 py-2.5">Students</th>
                  <th className="px-4 py-2.5">Class teacher</th>
                  <th className="px-4 py-2.5">Teachers</th>
                </tr>
              </thead>
              <tbody>
                {classRows.map((row) => {
                  const studentsLink = classStudentsHref(row.classLevel, row.section);
                  return (
                    <tr
                      key={row.key}
                      className="border-b border-neutral-100 last:border-0 hover:bg-brand-50/40"
                    >
                      <td className="px-4 py-3 font-semibold text-neutral-950">
                        Class {row.classLevel}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{row.section}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {capitalizeWords(row.programName)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900 tabular-nums">
                        {formatNumber(row.seats)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={studentsLink} className={linkBtn}>
                          <GraduationCap className="size-3.5 shrink-0" strokeWidth={2} />
                          Students
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {row.teacherId ? (
                          <Link
                            href={`/admin/teachers/${row.teacherId}`}
                            className={linkBtn}
                          >
                            <UserRound className="size-3.5 shrink-0" strokeWidth={2} />
                            {capitalizeWords(row.teacherName ?? "Class teacher")}
                          </Link>
                        ) : (
                          <span className="text-neutral-400">{EMPTY}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={teachersHref} className={linkBtn}>
                          <UserRound className="size-3.5 shrink-0" strokeWidth={2} />
                          Teachers
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
