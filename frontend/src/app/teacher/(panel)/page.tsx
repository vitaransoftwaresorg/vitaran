import { BookOpen, KeyRound, ScanLine, Trophy, Users } from "lucide-react";
import { PageHeader } from "@/features/admin/page-header";
import { ActionBanner, Panel, STAT_GRID, StatCard } from "@/features/admin/dashboard-parts";
import { ChipRow } from "@/features/admin/quick-links";
import { subjectLabel } from "@/features/schools/constants";
import { capitalizeWords } from "@/features/schools/schema";
import { getTeacherDashboard } from "@/services/teachers";
import { cn } from "@/lib/utils";

export default async function TeacherDashboardPage() {
  const stats = await getTeacherDashboard();

  return (
    <>
      <PageHeader
        title={`Hi, ${capitalizeWords(stats.name)}`}
        description={`${stats.schoolName} · ${stats.schoolCode}`}
      />

      <div className={cn(STAT_GRID, "lg:grid-cols-4")}>
        <StatCard
          label="Students"
          value={stats.students}
          hint="In your classes"
          icon={Users}
          href="/teacher/students"
        />
        <StatCard label="Resources" hint="Solution books" icon={BookOpen} href="/teacher/resources" />
        <StatCard
          label="Answer keys"
          value={stats.answerKeys}
          hint="Published"
          icon={KeyRound}
          href="/teacher/answer-keys"
        />
        <StatCard
          label="Results"
          value={stats.results}
          hint="Published"
          icon={Trophy}
          href="/teacher/results"
        />
      </div>

      <div className="mt-4">
        <ActionBanner
          href="/teacher/omr-scan"
          icon={ScanLine}
          title="OMR Scan"
          description="Scan answer sheets with the phone camera or upload a PDF."
          cta="Start scanning"
        />
      </div>

      <Panel compact title="Your teaching" description="Classes and subjects assigned by your school." className="mt-4">
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
      </Panel>
    </>
  );
}
