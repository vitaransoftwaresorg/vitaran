import { Router } from "express";
import {
  createProgram,
  deleteProgram,
  getCodeAvailability,
  getProgram,
  listPrograms,
  updateProgram,
} from "../controllers/program.controller.js";
import { requireAdmin } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createProgramSchema,
  programCodeAvailabilityQuerySchema,
  programIdParamsSchema,
  updateProgramSchema,
} from "../schemas/program.schema.js";

export const programRouter = Router();

/** Public catalog for school/teacher forms (read-only). */
export const programCatalogRouter = Router();
programCatalogRouter.get("/", listPrograms);
programCatalogRouter.get("/:id", validate(programIdParamsSchema, "params"), getProgram);

programRouter.use(requireAdmin);
programRouter.get("/", listPrograms);
programRouter.get(
  "/code-availability",
  validate(programCodeAvailabilityQuerySchema, "query"),
  getCodeAvailability,
);
programRouter.post("/", validate(createProgramSchema), createProgram);
programRouter.get("/:id", validate(programIdParamsSchema, "params"), getProgram);
programRouter.patch(
  "/:id",
  validate(programIdParamsSchema, "params"),
  validate(updateProgramSchema),
  updateProgram,
);
programRouter.delete("/:id", validate(programIdParamsSchema, "params"), deleteProgram);
