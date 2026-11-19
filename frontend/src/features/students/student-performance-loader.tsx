"use client";

import { useEffect, useState } from "react";
import type { StudentTestResult } from "@/types/student";
import { loadStudentPerformanceAction } from "./performance-actions";
import type { PerformancePortal } from "./portal";
import { StudentPerformance } from "./student-performance";

/** For in-page student views that have no server-loaded results. */
export function StudentPerformanceLoader({
  portal,
  studentId,
  student,
}: {
  portal: PerformancePortal;
  studentId: string;
  student: { id: string; name: string; rollNo: string; schoolName?: string };
}) {
  const [loaded, setLoaded] = useState<{ id: string; results: StudentTestResult[] } | null>(null);

  useEffect(() => {
    let live = true;
    void loadStudentPerformanceAction(portal, studentId).then((results) => {
      if (live) setLoaded({ id: studentId, results });
    });
    return () => {
      live = false;
    };
  }, [portal, studentId]);

  if (loaded?.id !== studentId) {
    return (
      <div className="rounded-xl border border-dashed border-brand-200 bg-white p-10 text-center text-sm text-neutral-500">
        Loading performance…
      </div>
    );
  }
  return <StudentPerformance results={loaded.results} portal={portal} student={student} />;
}
