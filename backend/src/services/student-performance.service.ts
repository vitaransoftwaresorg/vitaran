import { prisma } from "../config/database.js";
import * as programRepository from "../repositories/program.repository.js";
import type { CellValue } from "../utils/excel.js";
import { columnRole, foldRoll, maxFromLabel, numberCell, recomputeSheet } from "../utils/result-columns.js";

export type StudentTestResult = {
  resultSetId: string;
  testNumber: number;
  testId: string | null;
  programName: string;
  classLevel: number;
  published: boolean;
  date: string;
  subjects: Array<{ label: string; marks: number | null; max: number | null; percentage: number | null }>;
  total: number | null;
  totalMax: number | null;
  percentage: number | null;
  classRank: number | null;
  sectionRank: number | null;
};

const subjectLabel = (column: string) => column.replace(/\s*\(.*\)\s*$/, "").trim().toUpperCase();
const percentOf = (marks: number | null, max: number | null) =>
  marks != null && max ? Math.round((marks / max) * 10000) / 100 : null;

/** Every saved test for one student (matched by registration number), in test order. */
export async function studentTestResults(
  student: { schoolId: string; rollNo: string },
  options: { publishedOnly: boolean },
): Promise<StudentTestResult[]> {
  const roll = foldRoll(student.rollNo);
  const sets = await prisma.resultSet.findMany({
    where: { schoolId: student.schoolId, ...(options.publishedOnly ? { published: true } : {}) },
    select: {
      id: true,
      testId: true,
      testNumber: true,
      programCode: true,
      programName: true,
      published: true,
      publishedAt: true,
      createdAt: true,
      sheets: {
        select: {
          classLevel: true,
          columns: true,
          rows: { select: { values: true }, orderBy: { position: "asc" } },
        },
      },
    },
  });

  const programNames = new Map<string, string>();
  const programName = async (code: string | null, custom: string | null) => {
    if (custom) return custom;
    if (!code) return "";
    if (!programNames.has(code)) {
      programNames.set(code, (await programRepository.findProgramByCode(code))?.name ?? code);
    }
    return programNames.get(code)!;
  };

  const results: StudentTestResult[] = [];
  for (const set of sets) {
    for (const sheet of set.sheets) {
      const columns = Array.isArray(sheet.columns) ? (sheet.columns as string[]) : [];
      const roles = columns.map(columnRole);
      const rollCol = roles.indexOf("roll");
      if (rollCol < 0) continue;
      const rows = recomputeSheet(
        columns,
        sheet.rows.map((row) => (Array.isArray(row.values) ? (row.values as CellValue[]) : [])),
        sheet.classLevel,
      );
      const row = rows.find((candidate) => foldRoll(candidate[rollCol]) === roll);
      if (!row) continue;

      const at = (role: NonNullable<ReturnType<typeof columnRole>>) => roles.indexOf(role);
      const subjectCols = roles.flatMap((role, index) => (role === "subject" ? [index] : []));
      const subjects = subjectCols.map((index) => {
        const marks = numberCell(row[index]);
        const max = maxFromLabel(columns[index]!);
        return { label: subjectLabel(columns[index]!), marks, max, percentage: percentOf(marks, max) };
      });
      const total = numberCell(row[at("total")]);
      if (total == null && subjects.every((subject) => subject.marks == null)) continue;

      const totalCol = at("total");
      const totalMax =
        (totalCol >= 0 ? maxFromLabel(columns[totalCol]!) : null) ??
        (subjects.reduce((sum, subject) => sum + (subject.max ?? 0), 0) || null);
      results.push({
        resultSetId: set.id,
        testNumber: set.testNumber,
        testId: /^T-\d+$/i.test(set.testId) ? null : set.testId,
        programName: await programName(set.programCode, set.programName),
        classLevel: sheet.classLevel,
        published: set.published,
        date: (set.publishedAt ?? set.createdAt).toISOString(),
        subjects,
        total,
        totalMax,
        percentage: numberCell(row[at("percentage")]) ?? percentOf(total, totalMax),
        classRank: numberCell(row[at("classRank")]),
        sectionRank: numberCell(row[at("sectionRank")]),
      });
    }
  }

  return results.sort((a, b) => a.testNumber - b.testNumber || a.date.localeCompare(b.date));
}
