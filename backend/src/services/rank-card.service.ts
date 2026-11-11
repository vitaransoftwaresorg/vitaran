import { prisma } from "../config/database.js";
import * as programRepository from "../repositories/program.repository.js";
import * as schoolRepository from "../repositories/school.repository.js";
import type { ResultSheetParams } from "../schemas/result.schema.js";
import { AppError } from "../utils/app-error.js";
import type { CellValue } from "../utils/excel.js";
import {
  columnRole,
  foldRoll,
  maxFromLabel,
  numberCell,
  recomputeSheet,
  subjectColumn,
} from "../utils/result-columns.js";
import { renderClassResultPdf } from "./class-result.pdf.js";
import { getObject } from "./object-storage.js";
import { loadTitleFont, loadVitaranLogo, rankCardsPdf, renderRankCard, type RankCardData } from "./rank-card.render.js";
import type { ContentActor } from "./content-access.js";
import { getResultSet, getResultSheet } from "./result.service.js";
import type { SchoolAccountDto } from "./school.service.js";

type OmrSubjects = Map<number, { right: number; wrong: number; blank: number }>;

const cellText = (value: CellValue | undefined) => (value == null ? "" : String(value).trim());
const safeName = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "rank-card";

/** Saved OMR right / wrong / blank counts per subject column, keyed by roll number. */
async function omrCounts(
  filter: { schoolId: string; testNumber: number; classLevel: number; programCode: string | null },
  columns: string[],
) {
  const scans = await prisma.omScan.findMany({
    where: {
      schoolId: filter.schoolId,
      classLevel: filter.classLevel,
      answerKey: { testNumber: filter.testNumber, ...(filter.programCode ? { programCode: filter.programCode } : {}) },
    },
    select: { rollNo: true, testId: true, subjectScores: true },
  });
  const byRoll = new Map<string, OmrSubjects>();
  for (const scan of scans) {
    const subjects: OmrSubjects = new Map();
    const scores = Array.isArray(scan.subjectScores)
      ? (scan.subjectScores as Array<{ subject: string; correct: number; wrong: number; blank: number }>)
      : [];
    for (const score of scores) {
      if (typeof score?.subject !== "string") continue;
      const column = subjectColumn(columns, score.subject);
      if (column >= 0) subjects.set(column, { right: score.correct, wrong: score.wrong, blank: score.blank });
    }
    byRoll.set(foldRoll(scan.rollNo), subjects);
  }
  return { byRoll, testId: scans[0]?.testId ?? "" };
}

type Viewer = ContentActor | SchoolAccountDto;

async function classCards(params: ResultSheetParams, viewer?: Viewer) {
  const [resultSet, sheet] = await Promise.all([getResultSet(params.id, viewer), getResultSheet(params, viewer)]);
  const columns = sheet.columns;
  const rows = recomputeSheet(columns, sheet.rows as CellValue[][], params.classLevel);
  const roles = columns.map(columnRole);
  const at = (role: NonNullable<ReturnType<typeof columnRole>>) => roles.indexOf(role);
  const subjectCols = roles.flatMap((role, index) => (role === "subject" ? [index] : []));
  const totalCol = at("total");
  const totalMax =
    (totalCol >= 0 ? maxFromLabel(columns[totalCol]!) : null) ??
    (subjectCols.reduce((sum, index) => sum + (maxFromLabel(columns[index]!) ?? 0), 0) || null);
  const programName =
    resultSet.programName ||
    (resultSet.programCode ? (await programRepository.findProgramByCode(resultSet.programCode))?.name : null) ||
    resultSet.programCode ||
    "";
  const [omr, logo, vitaran] = await Promise.all([
    omrCounts(
      {
        schoolId: resultSet.school.id,
        testNumber: resultSet.testNumber,
        classLevel: params.classLevel,
        programCode: resultSet.programCode,
      },
      columns,
    ),
    schoolRepository.findSchoolLogo(resultSet.school.id),
    loadVitaranLogo(),
  ]);

  // Each class has its own answer key, so its saved OMRs name the right test ID; the set's ID
  // (or the "T-<n>" placeholder of manual sets) is only a fallback.
  const testId = omr.testId || (/^T-\d+$/i.test(resultSet.testId) ? "" : resultSet.testId);
  const cards = rows.map((row): RankCardData => {
    const roll = cellText(row[at("roll")]);
    const counts = omr.byRoll.get(foldRoll(roll));
    const classCell = cellText(row[at("class")]);
    const sectionCell = cellText(row[at("section")]);
    return {
      schoolName: resultSet.school.name,
      programName: programName === resultSet.school.name ? `Class ${params.classLevel}` : programName,
      testNumber: resultSet.testNumber,
      testId,
      student: {
        name: cellText(row[at("name")]) || "Student",
        rollNo: roll,
        classLabel: classCell || `${params.classLevel}${sectionCell}`,
      },
      subjects: subjectCols.map((index) => ({
        label: columns[index]!.replace(/\s*\(.*\)\s*$/, "").trim(),
        marks: numberCell(row[index]),
        max: maxFromLabel(columns[index]!),
        ...counts?.get(index),
      })),
      total: numberCell(row[totalCol]),
      totalMax,
      percentage: numberCell(row[at("percentage")]),
      classRank: numberCell(row[at("classRank")]),
      sectionRank: numberCell(row[at("sectionRank")]),
    };
  });
  const logos = {
    vitaran,
    school: logo?.logoData ? await getObject(logo.logoData) : null,
  };
  return { cards, logos, resultSet };
}

/** One student's card (by roll number) or the whole class in rank order; portals only see their own sheet. */
export async function getRankCards(
  params: ResultSheetParams,
  options: { roll?: string; format: "pdf" | "jpg" },
  viewer?: Viewer,
) {
  const { cards, logos, resultSet } = await classCards(params, viewer);
  const withMarks = cards.filter((card) => card.total != null || card.subjects.some((row) => row.marks != null));
  const picked = options.roll
    ? withMarks.filter((card) => foldRoll(card.student.rollNo) === foldRoll(options.roll))
    : withMarks;
  if (!picked.length) {
    throw new AppError(404, options.roll ? "No result saved for this student yet" : "No results saved for this class yet");
  }
  const base = options.roll
    ? `${picked[0]!.student.rollNo}-${picked[0]!.student.name}-Test-${resultSet.testNumber}-rank-card`
    : `Class-${params.classLevel}-Test-${resultSet.testNumber}-rank-cards`;
  if (options.format === "jpg") {
    return { data: await renderRankCard(picked[0]!, logos), fileName: `${safeName(base)}.jpg`, type: "image/jpeg" };
  }
  const images: Buffer[] = [];
  for (const card of picked) images.push(await renderRankCard(card, logos));
  return { data: await rankCardsPdf(images), fileName: `${safeName(base)}.pdf`, type: "application/pdf" };
}

/** The class result in rank order as one printable PDF, for the school notice board. */
export async function getClassResultPdf(params: ResultSheetParams, viewer?: Viewer) {
  const [{ cards, logos, resultSet }, titleFont] = await Promise.all([classCards(params, viewer), loadTitleFont()]);
  const withMarks = cards.filter((card) => card.total != null || card.subjects.some((row) => row.marks != null));
  if (!withMarks.length) throw new AppError(404, "No results saved for this class yet");
  const first = withMarks[0]!;
  const data = await renderClassResultPdf(
    {
      schoolName: first.schoolName,
      programName: first.programName,
      classLevel: params.classLevel,
      testNumber: first.testNumber,
      testId: first.testId,
      subjects: first.subjects.map((subject) => ({ label: subject.label, max: subject.max })),
      totalMax: first.totalMax,
      rows: withMarks.map((card) => ({
        rank: card.classRank,
        sectionRank: card.sectionRank,
        rollNo: card.student.rollNo,
        name: card.student.name,
        classLabel: card.student.classLabel,
        marks: card.subjects.map((subject) => subject.marks),
        total: card.total,
        percentage: card.percentage,
      })),
    },
    { vitaran: logos.vitaran, school: logos.school, titleFont },
  );
  return {
    data,
    fileName: `${safeName(`${first.schoolName}-Class-${params.classLevel}-Test-${resultSet.testNumber}-results`)}.pdf`,
    type: "application/pdf",
  };
}
