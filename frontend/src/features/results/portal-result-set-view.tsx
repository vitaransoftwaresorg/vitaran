"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRegisterInPageBack } from "@/components/layout/in-page-back";
import { ResultSetView } from "@/features/results/result-set-view";
import {
  loadPortalClassStudentsAction,
  loadPortalStudentByRollAction,
  type PortalStudentPortal,
} from "@/features/students/actions";
import { StudentDetailView } from "@/features/students/student-detail-view";
import type { ResultSet, ResultSheet } from "@/types/result";
import type { ClassScan } from "@/types/scan";
import type { Student, StudentDetail } from "@/types/student";

type PortalResultSetViewProps = {
  resultSet: ResultSet;
  sheet: ResultSheet;
  basePath: string;
  scans?: ClassScan[];
  showDownload?: boolean;
  portal: PortalStudentPortal;
};

const foldRoll = (value: string) => value.trim().toLowerCase();

function toDetail(row: Student, school: ResultSet["school"]): StudentDetail {
  return {
    ...row,
    school: { id: school.id, name: school.name, code: school.code },
  };
}

/**
 * School/teacher result sheet: student name/reg open the profile in place.
 * Class roster is prefetched so opens are instant (no loading banner).
 */
export function PortalResultSetView({
  resultSet,
  sheet,
  basePath,
  scans,
  showDownload = true,
  portal,
}: PortalResultSetViewProps) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const byRoll = useRef(new Map<string, StudentDetail>());

  useEffect(() => {
    let cancelled = false;
    void loadPortalClassStudentsAction(portal, sheet.classLevel).then((items) => {
      if (cancelled) return;
      const next = new Map<string, StudentDetail>();
      for (const row of items) {
        next.set(foldRoll(row.rollNo), toDetail(row, resultSet.school));
      }
      byRoll.current = next;
    });
    return () => {
      cancelled = true;
    };
  }, [portal, sheet.classLevel, resultSet.school]);

  const closeStudent = useCallback(() => setStudent(null), []);
  useRegisterInPageBack(student ? closeStudent : null);

  const openStudent = (roll: string) => {
    const key = foldRoll(roll);
    const cached = byRoll.current.get(key);
    if (cached) {
      setStudent(cached);
      return;
    }

    // Rare miss (roster still loading / student not in class filter) — fetch without a loading banner.
    void loadPortalStudentByRollAction(portal, roll).then((detail) => {
      if (!detail) {
        toast.error("Student not found for that registration number.");
        return;
      }
      byRoll.current.set(key, detail);
      setStudent(detail);
    });
  };

  if (student) {
    return (
      <StudentDetailView
        student={student}
        showActions={false}
        performancePortal={portal}
        portal={portal}
      />
    );
  }

  return (
    <ResultSetView
      resultSet={resultSet}
      sheet={sheet}
      scans={scans}
      basePath={basePath}
      showDownload={showDownload}
      onStudentClick={openStudent}
      blockUnpublishedClasses
    />
  );
}
