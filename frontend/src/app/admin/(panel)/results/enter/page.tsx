import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassResultsBoard } from "@/features/results/class-results-board";
import { RESULTS_PATH } from "@/features/results/constants";
import type { DrivePath } from "@/features/results/drive-path";
import { isRegularProgramCode, resultProgramFields } from "@/features/results/school-program";
import { listSchoolTests } from "@/services/answer-keys";
import { listAdminPrograms } from "@/services/programs";
import { listAdminClassScans } from "@/services/scans";
import { getClassResultTemplate, getResultSheet, listResultSets } from "@/services/results";
import { listSchoolOptions } from "@/services/schools";
import { listAllAdminSchoolStudents } from "@/services/students";
import type { SchoolClassTestRow } from "@/types/answer-key";

export const metadata: Metadata = { title: "Enter results" };

/** Last-resort headers when the API template is unavailable — prefer live OMR pattern from the server. */
const FALLBACK_COLUMNS = [
  "S.No",
  "Reg No",
  "CandidateName",
  "CLASS",
  "PHYSICS (100M)",
  "CHEMISTRY (100M)",
  "BIOLOGY (100M)",
  "Total Marks (300M)",
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

  // Same ACTIVE class roster as Students — not seats/strength, not a results-only list.
  const studentPage = await listAllAdminSchoolStudents(schoolId, {
    classLevel,
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

  const [sheet, template, scans, schoolTests] = await Promise.all([
    resultSet?.classes.some((item) => item.classLevel === classLevel)
      ? getResultSheet(resultSet.id, classLevel)
      : null,
    getClassResultTemplate({
      schoolId,
      program: programFields.program,
      programName: programFields.programName,
      testNumber,
      classLevel,
    }).catch(() => ({ columns: FALLBACK_COLUMNS, testId: undefined as string | undefined })),
    listAdminClassScans({ schoolId, testNumber, classLevel, program: effectiveProgram }),
    listSchoolTests(schoolId).catch(() => ({ tests: [], classSlots: [] })),
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
  const isPlaceholderTestId = (value: string | null | undefined) => {
    const id = value?.trim() ?? "";
    return !id || id === "-" || /^T-\d+$/i.test(id);
  };
  const sectionTestIds: SchoolClassTestRow[] =
    schoolTests.classSlots.find(
      (slot) => slot.testNumber === testNumber && slot.classLevel === classLevel,
    )?.rows ?? [];
  const classTestId = (() => {
    if (sectionTestIds.length === 1 && !isPlaceholderTestId(sectionTestIds[0]?.testId)) {
      return sectionTestIds[0]!.testId;
    }
    if (sectionTestIds.length > 1) {
      // Multiple section IDs — header lists them; save uses the first real one.
      return sectionTestIds.map((row) => row.testId).find((id) => !isPlaceholderTestId(id));
    }
    const fromScans = scans.map((scan) => scan.testId?.trim()).find((id) => id && !isPlaceholderTestId(id));
    if (fromScans) return fromScans;
    const fromTemplate = template.testId?.trim();
    if (fromTemplate && !isPlaceholderTestId(fromTemplate)) return fromTemplate;
    const fromSet = resultSet?.testId?.trim();
    if (fromSet && !isPlaceholderTestId(fromSet)) return fromSet;
    return undefined;
  })();
  const breadcrumbTestLabel =
    sectionTestIds.length > 1
      ? sectionTestIds
          .map((row) =>
            row.sectionName ? `Sec ${row.sectionName} ${row.testId}` : row.testId,
          )
          .join(" · ")
      : classTestId;
  // Folder levels only — "Results and Ranks" already lives in the top navbar.
  const breadcrumbs = [
    { label: school.name, href: `${RESULTS_PATH}?${schoolParams}` },
    {
      label: breadcrumbTestLabel ? `Test ${testNumber} · ${breadcrumbTestLabel}` : `Test ${testNumber}`,
      href: backHref,
    },
    { label: `Class ${classLevel}`, href: `${RESULTS_PATH}/enter?${new URLSearchParams({
      school: schoolId,
      test: String(testNumber),
      class: String(classLevel),
      ...(effectiveProgram ? { program: effectiveProgram } : {}),
    })}` },
  ];

  return (
    <ClassResultsBoard
      key={`${resultSet?.id ?? "new"}:${path.classLevel}:${scans.length}:${scans.at(-1)?.updatedAt ?? ""}:${studentPage.items.length}:${classTestId ?? ""}`}
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
      resolvedTestId={classTestId}
      sectionTestIds={sectionTestIds}
    />
  );
}
