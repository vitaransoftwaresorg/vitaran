import { Prisma } from "../generated/prisma/client.js";
import { SchoolType } from "../generated/prisma/enums.js";
import * as resultRepository from "../repositories/result.repository.js";
import type {
  NewResultSheet,
  ResultSetMeta,
  ResultSetSummary,
} from "../repositories/result.repository.js";
import * as schoolRepository from "../repositories/school.repository.js";
import {
  CLASS_LEVELS,
  classFileField,
  type ClassResultTemplateQuery,
  type ListResultSetsQuery,
  type ManualResultSheetInput,
  type ResultSetFields,
  type ResultSheetParams,
} from "../schemas/result.schema.js";
import { AppError } from "../utils/app-error.js";
import { notifyContentChanged } from "../utils/content-events.js";
import ExcelJS from "exceljs";
import { ExcelParseError, parseResultSheet, type CellValue } from "../utils/excel.js";
import {
  columnRole,
  foldRoll,
  identityCell,
  maxFromLabel,
  numberCell,
  recomputeSheet,
  standardColumns,
  subjectColumn,
} from "../utils/result-columns.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import * as studentRepository from "../repositories/student.repository.js";
import { asSubjectRanges } from "../utils/answer-key-parse.js";
import {
  canonicalizePaperMaxes,
  projectSheetForTeacher,
} from "../utils/result-sheet-scope.js";
import {
  resultSetAccessFilter,
  resultSetVisibleToTeacher,
  resultSheetClassFilter,
  type ContentActor,
} from "./content-access.js";
import { toSchoolRef, type SchoolAccountDto } from "./school.service.js";

const KIND = "results";

export type UploadedFiles = Partial<Record<string, Express.Multer.File[]>>;

type FieldIssue = { path: [string]; message: string };

const fieldError = (status: number, path: string, message: string) =>
  new AppError(status, message, [{ path: [path], message }] satisfies FieldIssue[]);

function toResultSetDto({ school, sheets, createdAt, updatedAt, publishedAt, programCode, ...rest }: ResultSetSummary) {
  return {
    ...rest,
    program: programCode,
    programCode,
    publishedAt: publishedAt?.toISOString() ?? null,
    school: { ...toSchoolRef(school), type: school.type },
    classes: sheets.map(({ updatedAt: sheetUpdatedAt, ...sheet }) => ({
      ...sheet,
      updatedAt: sheetUpdatedAt.toISOString(),
    })),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/** Regular schools pick a catalog program; customized schools use their own customized program only. */
async function resolveMeta({
  schoolId,
  program,
  programName,
  testId,
  testNumber,
}: ResultSetFields): Promise<ResultSetMeta> {
  const school = await schoolRepository.findSchoolById(schoolId);
  if (!school) throw fieldError(400, "schoolId", "Select a school");

  if (program) {
    const enrolled = school.schoolPrograms.find((row) => row.program.code === program);
    if (!enrolled) {
      throw fieldError(400, "program", "This school isn't enrolled in that program");
    }
    if (school.type === SchoolType.CUSTOMIZED && enrolled.program.type === SchoolType.REGULAR) {
      throw fieldError(400, "program", "Customized schools can't use a regular program");
    }
    if (school.type === SchoolType.REGULAR && enrolled.program.type === SchoolType.CUSTOMIZED) {
      throw fieldError(400, "program", "Regular schools can't use a customized program");
    }
    return {
      schoolId,
      programCode: program,
      programName: school.type === SchoolType.CUSTOMIZED ? enrolled.program.name : null,
      programKey: program,
      testId,
      testNumber,
    };
  }

  if (school.type === SchoolType.CUSTOMIZED) {
    if (!programName) throw fieldError(400, "programName", "Enter the program name");
    return {
      schoolId,
      programCode: null,
      programName,
      programKey: `custom:${programName.toLowerCase().replace(/\s+/g, " ")}`,
      testId,
      testNumber,
    };
  }

  throw fieldError(400, "program", "Select a program");
}

/** Parses every uploaded class file, reporting all bad files at once. */
async function readSheets(files: UploadedFiles = {}): Promise<NewResultSheet[]> {
  const sheets: NewResultSheet[] = [];
  const issues: FieldIssue[] = [];

  for (const classLevel of CLASS_LEVELS) {
    const field = classFileField(classLevel);
    const file = files[field]?.[0];
    if (!file || file.size === 0) continue;

    try {
      sheets.push({
        classLevel,
        fileName: file.originalname.slice(0, 255),
        fileSize: file.size,
        data: new Uint8Array(file.buffer),
        ...(await parseResultSheet(file.buffer)),
      });
    } catch (error) {
      if (!(error instanceof ExcelParseError)) throw error;
      issues.push({ path: [field], message: error.message });
    }
  }

  if (issues.length > 0) throw new AppError(400, "Some class files couldn't be read", issues);
  return sheets;
}

function duplicateTest(error: unknown, testNumber: number) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return fieldError(
      409,
      "testNumber",
      `Test ${testNumber} results for this program already exist for this school. Edit them instead.`,
    );
  }
  return error;
}

const requireClasses = (count: number) => {
  if (count === 0) throw fieldError(400, "classes", "Upload at least one class");
};

export async function listResultSets({ limit, testNumber, type, schoolId }: ListResultSetsQuery) {
  const where: Prisma.ResultSetWhereInput = { testNumber, schoolId, ...(type && { school: { type } }) };
  return (await resultRepository.findResultSets(where, limit)).map(toResultSetDto);
}

export async function getResultStats() {
  const [total, published] = await Promise.all([
    resultRepository.countResultSets(),
    resultRepository.countResultSets({ published: true }),
  ]);
  return { total, published };
}

/** Schools only reach their own results, and only once the admin has published them. */
function withActorSheetFilter<T extends { classes: { classLevel: number }[] }>(
  dto: T,
  actor?: ContentActor,
): T {
  const allowed = actor ? resultSheetClassFilter(actor) : null;
  if (!allowed) return dto;
  return { ...dto, classes: dto.classes.filter((sheet) => allowed.includes(sheet.classLevel)) };
}

function toContentActor(actor?: ContentActor | SchoolAccountDto): ContentActor | undefined {
  if (!actor) return undefined;
  if ("kind" in actor) return actor;
  return { kind: "school", school: actor };
}

export async function getResultSet(id: string, actor?: ContentActor | SchoolAccountDto) {
  const contentActor = toContentActor(actor);
  const resultSet = await resultRepository.findResultSet({
    id,
    ...(contentActor && resultSetAccessFilter(contentActor)),
  });
  if (!resultSet) throw new AppError(404, "Result not found");
  if (contentActor?.kind === "teacher" && !resultSetVisibleToTeacher(contentActor.teacher, resultSet)) {
    throw new AppError(404, "Result not found");
  }
  const dto = withActorSheetFilter(toResultSetDto(resultSet), contentActor);
  if (contentActor?.kind === "teacher" && dto.classes.length === 0) {
    throw new AppError(404, "Result not found");
  }
  return dto;
}

export async function uploadResultSet(fields: ResultSetFields, files?: UploadedFiles) {
  const meta = await resolveMeta(fields);
  const sheets = await readSheets(files);
  requireClasses(sheets.length);

  try {
    return toResultSetDto(await resultRepository.createResultSet(meta, sheets));
  } catch (error) {
    throw duplicateTest(error, meta.testNumber);
  }
}

async function sheetToXlsx(classLevel: number, caption: string[], columns: string[], rows: CellValue[][]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Class ${classLevel}`);
  for (const line of caption) worksheet.addRow([line]);
  worksheet.addRow(columns);
  for (const row of rows) worksheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function findClassSheet(meta: ResultSetMeta, classLevel: number, resultSetId?: string) {
  const resultSet = await resultRepository.findResultSet(
    resultSetId
      ? { id: resultSetId }
      : { schoolId: meta.schoolId, programKey: meta.programKey, testNumber: meta.testNumber },
  );
  const sheet = resultSet
    ? await resultRepository.findResultSheet({ resultSetId: resultSet.id, classLevel })
    : null;
  return { resultSet, sheet };
}

const DEFAULT_SUBJECTS = ["MATHEMATICS", "PHYSICS", "CHEMISTRY", "BIOLOGY"].map((subject) => ({
  subject,
  maxMarks: 100,
}));

/** Subjects set for this class in the school setup (falls back to the program's subjects). */
async function classSetupSubjects(meta: ResultSetMeta, classLevel: number) {
  const school = await schoolRepository.findSchoolById(meta.schoolId);
  const programs = school?.schoolPrograms ?? [];
  const enrolled =
    programs.find((row) =>
      meta.programCode ? row.program.code === meta.programCode : row.program.name === meta.programName,
    ) ?? (programs.length === 1 ? programs[0] : undefined);
  const setup = enrolled?.classes.find((row) => row.classLevel === classLevel)?.subjects ?? [];
  return setup.length ? setup : (enrolled?.program.subjects ?? []);
}

/**
 * Subject columns for a class table come from the school's class setup; max marks come from the
 * answer key when it has that subject, else a 25-question paper (100).
 */
async function classSubjects(meta: ResultSetMeta, classLevel: number) {
  const [setup, keyed] = await Promise.all([
    classSetupSubjects(meta, classLevel),
    answerKeySubjects(meta, classLevel),
  ]);
  if (setup.length === 0) return keyed;
  return setup.map((subject) => ({
    subject,
    maxMarks: keyed.find((row) => row.subject === subject)?.maxMarks ?? 100,
  }));
}

/**
 * Subjects and max marks from this class's answer key, else the closest key of the same program
 * (same test, then any test), else the standard four-subject paper.
 */
async function answerKeySubjects(meta: ResultSetMeta, classLevel: number) {
  const keys = meta.programCode
    ? await answerKeyRepository.findAnswerKeys({
        programCode: meta.programCode,
        OR: [{ type: SchoolType.REGULAR }, { schoolId: meta.schoolId }],
      })
    : await answerKeyRepository.findAnswerKeys({ schoolId: meta.schoolId });
  const score = (key: (typeof keys)[number]) =>
    (key.testNumber === meta.testNumber ? 4 : 0) +
    (key.classLevel === classLevel ? 8 : 0) +
    (key.school?.id === meta.schoolId ? 1 : 0) -
    Math.abs(key.classLevel - classLevel) * 0.01;
  const key = keys
    .filter((row) => asSubjectRanges(row.subjectRanges).length > 0)
    .sort((a, b) => score(b) - score(a))[0];
  if (!key) return DEFAULT_SUBJECTS;
  return asSubjectRanges(key.subjectRanges).map((range) => ({
    subject: range.subject,
    maxMarks: range.maxMarks || (range.to - range.from + 1) * key.correctMarks,
  }));
}

const defaultCaption = (classLevel: number, testNumber: number) => [`Class ${classLevel} · Test ${testNumber}`];

async function writeClassSheet(
  meta: ResultSetMeta,
  existingId: string | null,
  classLevel: number,
  caption: string[],
  columns: string[],
  rows: CellValue[][],
  fileName: string,
) {
  const data = await sheetToXlsx(classLevel, caption, columns, rows);
  const sheet: NewResultSheet = {
    classLevel,
    fileName,
    fileSize: data.length,
    data: new Uint8Array(data),
    caption,
    columns,
    rows,
  };
  try {
    const resultSet = existingId
      ? await resultRepository.updateResultSet(existingId, meta, [sheet], [], requireClasses)
      : await resultRepository.createResultSet(meta, [sheet]);
    if (resultSet.published) notifyContentChanged({ kind: KIND, schoolId: resultSet.school.id });
    return resultSet;
  } catch (error) {
    throw duplicateTest(error, meta.testNumber);
  }
}

/**
 * Columns for the admin class table: the saved sheet's columns, or the answer key's subjects when
 * the class has no sheet yet (or only an old totals-only sheet).
 */
export async function getClassResultTemplate(query: ClassResultTemplateQuery) {
  const meta = await resolveMeta({ ...query, testId: "-", removeClasses: [] });
  const { sheet } = await findClassSheet(meta, query.classLevel);
  const saved = (sheet?.columns as string[] | undefined) ?? [];
  const hasSubjects = saved.some((label) => columnRole(label) === "subject");
  if (saved.length && hasSubjects) return { columns: saved };
  return { columns: standardColumns(await classSubjects(meta, query.classLevel)) };
}

function assertWithinMax(columns: string[], rows: CellValue[][]) {
  const nameCol = columns.map(columnRole).indexOf("name");
  columns.forEach((label, index) => {
    const role = columnRole(label);
    if (role !== "subject" && role !== "total") return;
    const text = rows.find((row) => {
      const cell = row[index];
      return cell != null && cell !== "" && numberCell(cell) == null;
    });
    if (text) {
      const who = nameCol >= 0 ? ` for ${String(text[nameCol] ?? "")}` : "";
      throw fieldError(400, "rows", `${label}${who} must be a number`);
    }
    const max = maxFromLabel(label);
    if (max == null) return;
    const over = rows.find((row) => (numberCell(row[index]) ?? 0) > max);
    if (over) {
      const who = nameCol >= 0 ? ` for ${String(over[nameCol] ?? "")}` : "";
      throw fieldError(400, "rows", `${label}${who} is more than the max of ${max}`);
    }
  });
}

/** Saves the admin class table; totals, percentage and ranks are recalculated here. */
export async function saveManualResultSheet(input: ManualResultSheetInput) {
  const meta = await resolveMeta({ ...input, removeClasses: [] });
  const { resultSet, sheet } = await findClassSheet(meta, input.classLevel, input.resultSetId);
  const filled = input.rows.filter((row) => row.some((cell) => cell !== null && cell !== ""));
  assertWithinMax(input.columns, filled);
  const rows = recomputeSheet(input.columns, filled, input.classLevel);
  const caption = sheet?.caption.length ? sheet.caption : defaultCaption(input.classLevel, input.testNumber);
  return toResultSetDto(
    await writeClassSheet(
      meta,
      resultSet?.id ?? null,
      input.classLevel,
      caption,
      input.columns,
      rows,
      `class-${input.classLevel}-results.xlsx`,
    ),
  );
}

export type OmrResultEntry = {
  schoolId: string;
  programCode: string;
  testId: string;
  testNumber: number;
  classLevel: number;
  name: string;
  rollNo: string;
  sectionName: string | null;
  subjects: Array<{ subject: string; total: number; maxTotal: number }>;
  total: number;
  maxTotal: number;
};

/** Adds or replaces one student's OMR score in the class sheet of the matching result set. */
export async function recordOmrResult(entry: OmrResultEntry) {
  const meta = await resolveMeta({
    schoolId: entry.schoolId,
    program: entry.programCode,
    testId: entry.testId,
    testNumber: entry.testNumber,
    removeClasses: [],
  });
  const { resultSet, sheet } = await findClassSheet(meta, entry.classLevel);
  const savedColumns = (sheet?.columns as string[] | undefined) ?? [];
  const columns = savedColumns.length
    ? savedColumns
    : standardColumns(entry.subjects.map((row) => ({ subject: row.subject, maxMarks: row.maxTotal })));
  const roles = columns.map(columnRole);
  const rows = sheet ? sheet.rows.map(({ values }) => values as CellValue[]) : [];

  const rollCol = roles.indexOf("roll");
  const at = rollCol >= 0 ? rows.findIndex((row) => foldRoll(row[rollCol]) === foldRoll(entry.rollNo)) : -1;
  const row: CellValue[] = at >= 0 ? columns.map((_, index) => rows[at]![index] ?? null) : columns.map(() => null);
  roles.forEach((role, index) => {
    const value = identityCell(role, entry);
    if (value !== undefined) row[index] = value;
  });
  let matchedSubjects = 0;
  for (const subject of entry.subjects) {
    const index = subjectColumn(columns, subject.subject);
    if (index < 0) continue;
    row[index] = subject.total;
    matchedSubjects += 1;
  }
  const totalCol = roles.indexOf("total");
  if (totalCol >= 0 && matchedSubjects === 0) row[totalCol] = entry.total;
  if (at >= 0) rows[at] = row;
  else rows.push(row);

  const caption = sheet?.caption.length ? sheet.caption : defaultCaption(entry.classLevel, entry.testNumber);
  return writeClassSheet(
    { ...meta, testId: resultSet?.testId ?? meta.testId },
    resultSet?.id ?? null,
    entry.classLevel,
    caption,
    columns,
    recomputeSheet(columns, rows, entry.classLevel),
    `class-${entry.classLevel}-results.xlsx`,
  );
}

export async function updateResultSet(id: string, fields: ResultSetFields, files?: UploadedFiles) {
  const meta = await resolveMeta(fields);
  const sheets = await readSheets(files);

  let resultSet: ResultSetSummary;
  try {
    resultSet = await resultRepository.updateResultSet(id, meta, sheets, fields.removeClasses, requireClasses);
  } catch (error) {
    throw duplicateTest(error, meta.testNumber);
  }
  // The set may have moved to another school, so tell every school.
  if (resultSet.published) notifyContentChanged({ kind: KIND, schoolId: null });
  return toResultSetDto(resultSet);
}

export async function deleteResultSet(id: string) {
  const { schoolId, published } = await resultRepository.deleteResultSet(id);
  if (published) notifyContentChanged({ kind: KIND, schoolId });
}

const sheetWhere = ({ id, classLevel }: ResultSheetParams, actor?: ContentActor) => ({
  classLevel,
  resultSet: { id, ...(actor && resultSetAccessFilter(actor)) },
});

function assertSheetClassAllowed(classLevel: number, actor?: ContentActor) {
  const allowed = actor ? resultSheetClassFilter(actor) : null;
  if (allowed && !allowed.includes(classLevel)) {
    throw new AppError(404, "Result not found");
  }
}

/** Highest total first; rows without a total keep their order at the end. */
function byRank(columns: string[], rows: CellValue[][]) {
  const totalCol = columns.map(columnRole).indexOf("total");
  if (totalCol < 0) return rows;
  return [...rows].sort(
    (a, b) => (numberCell(b[totalCol]) ?? -Infinity) - (numberCell(a[totalCol]) ?? -Infinity),
  );
}

async function paperRangesForTest(testId: string) {
  const key = await answerKeyRepository.findAnswerKeyByTestId(testId);
  return asSubjectRanges(key?.subjectRanges);
}

export async function getResultSheet(params: ResultSheetParams, actor?: ContentActor | SchoolAccountDto) {
  const contentActor = toContentActor(actor);
  assertSheetClassAllowed(params.classLevel, contentActor);
  const sheet = await resultRepository.findResultSheet(sheetWhere(params, contentActor));
  if (!sheet) throw new AppError(404, "Result not found");

  const resultSet = await resultRepository.findResultSet({
    id: params.id,
    ...(contentActor && resultSetAccessFilter(contentActor)),
  });
  const ranges = resultSet ? await paperRangesForTest(resultSet.testId) : [];

  const { rows, columns, updatedAt, caption, ...rest } = sheet;
  let parsedColumns = columns as string[];
  let parsedRows = byRank(parsedColumns, rows.map(({ values }) => values as CellValue[]));
  let parsedCaption = caption;
  if (contentActor?.kind === "teacher") {
    const roster = await studentRepository.listSchoolRoster(contentActor.teacher.schoolId);
    const scoped = projectSheetForTeacher(parsedColumns, parsedRows, contentActor.teacher, roster);
    parsedColumns = scoped.columns;
    parsedRows = scoped.rows;
    const paper = canonicalizePaperMaxes(parsedColumns, parsedRows, parsedCaption, ranges);
    return {
      ...rest,
      caption: paper.caption,
      columns: paper.columns,
      rows: paper.rows,
      rowCount: paper.rows.length,
      classLabel: scoped.classLabel,
      updatedAt: updatedAt.toISOString(),
    };
  }
  const paper = canonicalizePaperMaxes(parsedColumns, parsedRows, parsedCaption, ranges);
  return {
    ...rest,
    caption: paper.caption,
    columns: paper.columns,
    rows: paper.rows,
    updatedAt: updatedAt.toISOString(),
  };
}

export async function getResultSheetFile(
  params: ResultSheetParams,
  actor?: ContentActor | SchoolAccountDto,
) {
  const contentActor = toContentActor(actor);
  assertSheetClassAllowed(params.classLevel, contentActor);
  const file = await resultRepository.findResultSheetFile(sheetWhere(params, contentActor));
  if (!file) throw new AppError(404, "Result not found");
  return file;
}

export async function listVisibleResultSets(actor: ContentActor) {
  const sets = await resultRepository.findResultSets(resultSetAccessFilter(actor));
  const visible = sets.filter((set) =>
    actor.kind === "school" ? true : resultSetVisibleToTeacher(actor.teacher, set),
  );
  if (actor.kind !== "teacher") {
    return visible.map((set) => withActorSheetFilter(toResultSetDto(set), actor));
  }

  const roster = await studentRepository.listSchoolRoster(actor.teacher.schoolId);
  const dtos = [];
  for (const set of visible) {
    const dto = withActorSheetFilter(toResultSetDto(set), actor);
    const classes = [];
    for (const item of dto.classes) {
      const sheet = await resultRepository.findResultSheet({
        classLevel: item.classLevel,
        resultSet: { id: set.id },
      });
      if (!sheet) continue;
      const scoped = projectSheetForTeacher(
        sheet.columns as string[],
        sheet.rows.map(({ values }) => values as CellValue[]),
        actor.teacher,
        roster,
      );
      if (scoped.rows.length === 0) continue;
      classes.push({ ...item, rowCount: scoped.rows.length, label: scoped.classLabel });
    }
    if (classes.length === 0) continue;
    dtos.push({ ...dto, classes });
  }
  return dtos;
}

export async function countVisibleResultSets(actor: ContentActor) {
  if (actor.kind === "teacher") return (await listVisibleResultSets(actor)).length;
  return resultRepository.countResultSets(resultSetAccessFilter(actor));
}

export async function listSchoolResultSets(school: SchoolAccountDto) {
  return listVisibleResultSets({ kind: "school", school });
}

export async function setResultSetPublished(id: string, published: boolean) {
  const resultSet = await resultRepository.setResultSetPublished(id, published);
  if (!resultSet) throw new AppError(404, "Result not found");
  notifyContentChanged({ kind: KIND, schoolId: resultSet.school.id });
  return toResultSetDto(resultSet);
}
