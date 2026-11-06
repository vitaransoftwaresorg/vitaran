import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassResultsBoard } from "@/features/results/class-results-board";
import { RESULTS_PATH } from "@/features/results/constants";
import type { DrivePath } from "@/features/results/drive-path";
import { isRegularProgramCode, resultProgramFields } from "@/features/results/school-program";
import { listAdminPrograms } from "@/services/programs";
import { listAdminClassScans } from "@/services/scans";
import { getClassResultTemplate, getResultSheet, listResultSets } from "@/services/results";
import { listSchoolOptions } from "@/services/schools";
import { listAdminSchoolStudents } from "@/services/students";

export const metadata: Metadata = { title: "Enter results" };

const FALLBACK_COLUMNS = [
  "RollNo",
  "CandidateName",
  "CLASS",
  "MATHS (100M)",
  "PHYSICS (100M)",
  "CHEMISTRY (100M)",
  "BIOLOGY (100M)",
  "Total Marks (400M)",
  "Percentage",
  "Section Rank",
  "Class Rank",
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminResultEnterPage({
  searchParams,
}: PageProps<"/admin/results/enter">) {
  const query = await searchParams;
  const schoolId = first(query.school);
  const program = first(query.program)?.trim() || undefined;
  const testNumber = Number(first(query.test));
  const classLevel = Number(first(query.class));

  if (
    !schoolId ||
    !UUID.test(schoolId) ||
    !Number.isInteger(testNumber) ||
    testNumber < 1 ||
    testNumber > 18 ||
    !Number.isInteger(classLevel) ||
    classLevel < 1 ||
    classLevel > 12
  ) {
    notFound();
  }

  const [schools, programs, resultSets] = await Promise.all([
    listSchoolOptions(),
    listAdminPrograms(),
    listResultSets({ schoolId, testNumber, limit: 100 }),
  ]);

  const school = schools.find((item) => item.id === schoolId);
  if (!school) notFound();

  // Customized schools never bind to a regular catalog program.
  const programFields = resultProgramFields(school, programs, program);
  const effectiveProgram =
    programFields.program ??
    (school.type === "CUSTOMIZED" && program && isRegularProgramCode(program, programs)
      ? undefined
      : program);

  const programId = effectiveProgram
    ? programs.find((item) => item.code === effectiveProgram)?.id
    : undefined;
  const studentPage = await listAdminSchoolStudents(schoolId, {
    classLevel,
    programId,
    pageSize: 500,
    status: "ACTIVE",
  });

  const resultSet =
    resultSets.find((item) => {
      if (item.school.id !== schoolId || item.testNumber !== testNumber) return false;
      if (school.type === "CUSTOMIZED" && isRegularProgramCode(item.program ?? undefined, programs)) {
        return false;
      }
      if (effectiveProgram) return item.program === effectiveProgram;
      if (programFields.programName) {
        return item.programName === programFields.programName || !item.program;
      }
      return true;
    }) ?? null;

  const [sheet, template, scans] = await Promise.all([
    resultSet?.classes.some((item) => item.classLevel === classLevel)
      ? getResultSheet(resultSet.id, classLevel)
      : null,
    getClassResultTemplate({
      schoolId,
      program: programFields.program,
      programName: programFields.programName,
      testNumber,
      classLevel,
    }).catch(() => ({ columns: FALLBACK_COLUMNS })),
    listAdminClassScans({ schoolId, testNumber, classLevel, program: effectiveProgram }),
  ]);

  const path: DrivePath & { schoolId: string; testNumber: number; classLevel: number } = {
    program: effectiveProgram,
    schoolId,
    testNumber,
    classLevel,
  };

  const backParams = new URLSearchParams();
  backParams.set("school", schoolId);
  backParams.set("test", String(testNumber));
  if (school.type) backParams.set("type", school.type);
  const backHref = `${RESULTS_PATH}?${backParams}`;
  const schoolParams = new URLSearchParams({ school: schoolId });
  if (school.type) schoolParams.set("type", school.type);
  const breadcrumbs = [
    { label: "Results", href: RESULTS_PATH },
    { label: school.name, href: `${RESULTS_PATH}?${schoolParams}` },
    { label: `Test ${testNumber}`, href: backHref },
    { label: `Class ${classLevel}`, href: "" },
  ];

  return (
    <ClassResultsBoard
      key={`${resultSet?.id ?? "new"}:${sheet?.updatedAt ?? "empty"}:${studentPage.items.length}`}
      students={studentPage.items}
      columns={template.columns}
      sheet={sheet}
      resultSet={resultSet}
      school={school}
      programs={programs}
      path={path}
      backHref={backHref}
      breadcrumbs={breadcrumbs}
      scans={scans}
    />
  );
}
