import { z } from "zod";
import { SchoolType } from "../generated/prisma/enums.js";

export const CLASS_LEVELS = Array.from({ length: 12 }, (_, index) => index + 1);

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

/**
 * Multipart text fields. Regular schools send `program` (catalog code), customized schools send `programName`;
 * the service checks which one applies to the chosen school.
 */
export const resultSetFieldsSchema = z.object({
  schoolId: z.uuid({ error: "Select a school" }),
  program: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(64).optional()),
  programName: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(120).optional()),
  /** Freeform test ID — any non-empty string. */
  testId: z.string().trim().min(1, "Enter the test ID").max(64, "Keep the test ID under 64 characters"),
  /** Ordinal test number. */
  testNumber: z.coerce.number().int().min(1).max(18),
  /** Classes whose sheet should be deleted on update, e.g. "3,7". */
  removeClasses: z
    .preprocess(emptyToUndefined, z.string().optional())
    .transform((value) =>
      value
        ? [...new Set(value.split(",").map(Number))].filter((level) => CLASS_LEVELS.includes(level))
        : [],
    ),
});

export const listResultSetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  testNumber: z.coerce.number().int().min(1).max(18).optional(),
  type: z.enum(SchoolType).optional(),
  schoolId: z.uuid().optional(),
});

export const resultSetIdParamsSchema = z.object({
  id: z.uuid(),
});

export const resultSheetParamsSchema = z.object({
  id: z.uuid(),
  classLevel: z.coerce.number().int().min(1).max(12),
});

const resultCellSchema = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);

/** Admin class table: the sheet's columns and one row of cells per student. */
export const manualResultSheetSchema = resultSetFieldsSchema.omit({ removeClasses: true }).extend({
  classLevel: z.coerce.number().int().min(1).max(12),
  columns: z.array(z.string().trim().min(1).max(120)).min(1).max(60),
  rows: z.array(z.array(resultCellSchema).max(60)).min(1, "Add at least one student").max(2000),
  resultSetId: z.uuid().optional(),
});

export const classResultTemplateQuerySchema = resultSetFieldsSchema
  .pick({ schoolId: true, program: true, programName: true, testNumber: true })
  .extend({ classLevel: z.coerce.number().int().min(1).max(12) });

export type ResultSetFields = z.infer<typeof resultSetFieldsSchema>;
export type ListResultSetsQuery = z.infer<typeof listResultSetsQuerySchema>;
export type ResultSheetParams = z.infer<typeof resultSheetParamsSchema>;
export type ManualResultSheetInput = z.infer<typeof manualResultSheetSchema>;
export type ClassResultTemplateQuery = z.infer<typeof classResultTemplateQuerySchema>;
