import { BookOpen, KeyRound, ScanLine, Trophy, Users } from "lucide-react";
import { PageHeader } from "@/features/admin/page-header";
import { StatCard } from "@/features/admin/dashboard-parts";
import { ChipRow, QuickLinks } from "@/features/admin/quick-links";
import { subjectLabel } from "@/features/schools/constants";
import { capitalizeWords } from "@/features/schools/schema";
import { getTeacherDashboard } from "@/services/teachers";

export default async function TeacherDashboardPage() {
  const stats = await getTeacherDashboard();

  const links = [
    {
      label: "Students",
      href: "/teacher/students",
      icon: Users,
      count: stats.students,
      hint: `${stats.students} in your classes`,
    },
    {
      label: "Resources",
      href: "/teacher/resources",
      icon: BookOpen,
      hint: "Solution books",
    },
    {
      label: "Answer keys",
      href: "/teacher/answer-keys",
      icon: KeyRound,
      count: stats.answerKeys,
      hint: `${stats.answerKeys} published`,
    },
    {
      label: "Results",
      href: "/teacher/results",
      icon: Trophy,
      count: stats.results,
      hint: `${stats.results} published`,
    },
    {
      label: "OMR Scan",
      href: "/teacher/omr-scan",
      icon: ScanLine,
      hint: "Scan a sheet",
    },
  ] as const;

  return (
    <>
      <PageHeader
        title={`Hi, ${capitalizeWords(stats.name)}`}
        description={`${stats.schoolName} · ${stats.schoolCode}`}
      />

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChipRow
            title="Classes"
            items={stats.classLevels.map((level) => `Class ${level}`)}
            empty="No classes assigned yet."
          />
          <ChipRow
            title="Subjects"
            items={stats.subjects.map((subject) => subjectLabel(subject))}
            empty="No subjects assigned yet."
          />
          <ChipRow
            title="Class teacher of"
            items={stats.classTeacherLabels}
            empty="Not a class teacher for any section."
          />
        </div>
      </section>

      <div className="mt-4 md:hidden">
        <QuickLinks items={[...links]} className="grid-cols-2" />
      </div>

      <div className="mt-4 hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
        {links.map((item) => (
          <StatCard
            key={item.href}
            label={item.label}
            value={"count" in item ? item.count : undefined}
            hint={item.hint}
            icon={item.icon}
            href={item.href}
          />
        ))}
      </div>
    </>
  );
}
