import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { CellValue } from "../utils/excel.js";

/** Uploads write a set, its sheets and every student row; Neon round trips need some headroom. */
const WRITE_TIMEOUT_MS = 30_000;

export const resultSetSummarySelect = {
  id: true,
  programCode: true,
  programName: true,
  testId: true,
  testNumber: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  school: { select: { id: true, name: true, code: true, type: true } },
  sheets: {
    select: { classLevel: true, rowCount: true, fileName: true, fileSize: true, updatedAt: true },
    orderBy: { classLevel: "asc" },
  },
} satisfies Prisma.ResultSetSelect;

export type ResultSetSummary = Prisma.ResultSetGetPayload<{ select: typeof resultSetSummarySelect }>;

export type ResultSetMeta = {
  schoolId: string;
  programCode: string | null;
  programName: string | null;
  programKey: string;
  testId: string;
  testNumber: number;
};

export type NewResultSheet = {
  classLevel: number;
  fileName: string;
  fileSize: number;
  data: Uint8Array<ArrayBuffer>;
  caption: string[];
  columns: string[];
  rows: CellValue[][];
};

async function insertSheet(tx: Prisma.TransactionClient, resultSetId: string, sheet: NewResultSheet) {
  const { rows, ...rest } = sheet;
  const { id } = await tx.resultSheet.create({
    data: { ...rest, resultSetId, rowCount: rows.length },
    select: { id: true },
  });
  await tx.resultRow.createMany({
    data: rows.map((values, index) => ({ sheetId: id, position: index + 1, values })),
  });
}

export function findResultSets(where: Prisma.ResultSetWhereInput, limit?: number) {
  return prisma.resultSet.findMany({
    where,
    select: resultSetSummarySelect,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/** Publishing isn't an edit, so `updatedAt` is kept as it was. Returns null when the set is gone. */
export async function setResultSetPublished(id: string, published: boolean) {
  const current = await prisma.resultSet.findUnique({ where: { id }, select: { updatedAt: true } });
  if (!current) return null;
  return prisma.resultSet.update({
    where: { id },
    data: { published, publishedAt: published ? new Date() : null, updatedAt: current.updatedAt },
    select: resultSetSummarySelect,
  });
}

export function countResultSets(where?: Prisma.ResultSetWhereInput) {
  return prisma.resultSet.count({ where });
}

export function findResultSet(where: Prisma.ResultSetWhereInput) {
  return prisma.resultSet.findFirst({ where, select: resultSetSummarySelect });
}

export function findResultSheet(where: Prisma.ResultSheetWhereInput) {
  return prisma.resultSheet.findFirst({
    where,
    select: {
      classLevel: true,
      caption: true,
      columns: true,
      rowCount: true,
      fileName: true,
      fileSize: true,
      updatedAt: true,
      rows: { select: { values: true }, orderBy: { position: "asc" } },
    },
  });
}

export function findResultSheetFile(where: Prisma.ResultSheetWhereInput) {
  return prisma.resultSheet.findFirst({ where, select: { fileName: true, data: true } });
}

export function createResultSet(meta: ResultSetMeta, sheets: NewResultSheet[]) {
  return prisma.$transaction(
    async (tx) => {
      const { id } = await tx.resultSet.create({ data: meta, select: { id: true } });
      for (const sheet of sheets) await insertSheet(tx, id, sheet);
      return tx.resultSet.findUniqueOrThrow({ where: { id }, select: resultSetSummarySelect });
    },
    { timeout: WRITE_TIMEOUT_MS },
  );
}

/**
 * Replaces the given sheets and deletes `removeClasses`. `assertNotEmpty` runs before commit,
 * so a set is never left without classes.
 */
export function updateResultSet(
  id: string,
  meta: ResultSetMeta,
  sheets: NewResultSheet[],
  removeClasses: number[],
  assertNotEmpty: (sheetCount: number) => void,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.resultSet.update({ where: { id }, data: { ...meta, updatedAt: new Date() } });

      const replaced = [...new Set([...removeClasses, ...sheets.map((sheet) => sheet.classLevel)])];
      if (replaced.length > 0) {
        await tx.resultSheet.deleteMany({ where: { resultSetId: id, classLevel: { in: replaced } } });
      }
      for (const sheet of sheets) await insertSheet(tx, id, sheet);

      assertNotEmpty(await tx.resultSheet.count({ where: { resultSetId: id } }));
      return tx.resultSet.findUniqueOrThrow({ where: { id }, select: resultSetSummarySelect });
    },
    { timeout: WRITE_TIMEOUT_MS },
  );
}

export function deleteResultSet(id: string) {
  return prisma.resultSet.delete({ where: { id }, select: { schoolId: true, published: true } });
}
