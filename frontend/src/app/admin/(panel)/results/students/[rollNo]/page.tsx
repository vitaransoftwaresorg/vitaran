import { notFound } from "next/navigation";
import { LiveRefresh } from "@/features/live/live-refresh";
import { StudentPerformanceView } from "@/features/results/student-performance-view";

export default async function AdminStudentPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ rollNo: string }>;
  searchParams: Promise<{
    classLevel?: string;
    section?: string;
    programKey?: string;
    schoolId?: string;
  }>;
}) {
  const [{ rollNo: rawRoll }, query] = await Promise.all([params, searchParams]);
  const rollNo = decodeURIComponent(rawRoll);
  const classLevel = Number(query.classLevel);
  if (
    !rollNo ||
    !query.schoolId ||
    !Number.isInteger(classLevel) ||
    classLevel < 1 ||
    classLevel > 12
  ) {
    notFound();
  }

  return (
    <>
      <LiveRefresh kind="results" />
      <StudentPerformanceView
        role="admin"
        rollNo={rollNo}
        classLevel={classLevel}
        section={query.section ?? null}
        programKey={query.programKey ?? null}
        schoolId={query.schoolId}
      />
    </>
  );
}
