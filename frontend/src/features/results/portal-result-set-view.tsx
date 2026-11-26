"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
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
import { resultSetHref } from "./constants";
import {
  readResultsReturnHref,
  resultsTestFolderHref,
  writeResultsFolderTrail,
} from "./portal-drive-path";

type PortalResultSetViewProps = {
  resultSet: ResultSet;
  sheet: ResultSheet;
  basePath: string;
  scans?: ClassScan[];
  showDownload?: boolean;
  showSchool?: boolean;
  actions?: ReactNode;
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
 * Result sheet: student name/reg open the profile in place (stay on Results).
 * Class roster is prefetched so opens are instant (no loading banner).
 */
export function PortalResultSetView({
  resultSet,
  sheet,
  basePath,
  scans,
  showDownload = true,
  showSchool = false,
  actions,
  portal,
}: PortalResultSetViewProps) {
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const byRoll = useRef(new Map<string, StudentDetail>());
  const setDrivePath = useSetDrivePathCrumbs();
  const testFolderHref = resultsTestFolderHref(basePath, resultSet.testNumber);

  const schoolId = resultSet.school.id;

  useEffect(() => {
    let cancelled = false;
    void loadPortalClassStudentsAction(portal, sheet.classLevel, schoolId).then((items) => {
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
  }, [portal, sheet.classLevel, schoolId, resultSet.school]);

  // Keep Test → Class in the top trail so Back / Test crumb returns to the class list.
  useEffect(() => {
    const classHref = resultSetHref(basePath, resultSet.id, sheet.classLevel);
    const crumbs = [
      { label: `Test ${resultSet.testNumber}`, href: testFolderHref },
      { label: sheet.classLabel || sheet.label || `Class ${sheet.classLevel}`, href: classHref },
    ];
    writeResultsFolderTrail(testFolderHref, [{ label: `Test ${resultSet.testNumber}`, href: testFolderHref }]);
    setDrivePath?.(crumbs);
  }, [
    basePath,
    resultSet.id,
    resultSet.testNumber,
    sheet.classLabel,
    sheet.classLevel,
    sheet.label,
    setDrivePath,
    testFolderHref,
  ]);

  const closeStudent = useCallback(() => setStudent(null), []);
  const backToClassList = useCallback(() => {
    router.push(readResultsReturnHref() || testFolderHref);
  }, [router, testFolderHref]);
  // Student open → close profile; otherwise Back returns to this test’s class list.
  useRegisterInPageBack(student ? closeStudent : backToClassList);

  const openStudent = (roll: string) => {
    const key = foldRoll(roll);
    const cached = byRoll.current.get(key);
    if (cached) {
      setStudent(cached);
      return;
    }

    // Rare miss (roster still loading / student not in class filter) — fetch without a loading banner.
    void loadPortalStudentByRollAction(portal, roll, schoolId).then((detail) => {
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
      showSchool={showSchool || portal === "admin"}
      actions={actions}
      onStudentClick={openStudent}
      blockUnpublishedClasses={portal !== "admin"}
    />
  );
}
