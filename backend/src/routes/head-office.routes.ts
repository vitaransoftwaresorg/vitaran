import { Router } from "express";
import {
  createHeadOffice,
  deleteHeadOffice,
  getCodeAvailability,
  getEmailAvailability,
  getHeadOffice,
  getNextOfficeCode,
  listHeadOffices,
  updateHeadOffice,
} from "../controllers/head-office.controller.js";
import { requireAdmin } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createHeadOfficeSchema,
  headOfficeCodeAvailabilityQuerySchema,
  headOfficeEmailAvailabilityQuerySchema,
  headOfficeIdParamsSchema,
  updateHeadOfficeSchema,
} from "../schemas/head-office.schema.js";

export const headOfficeRouter = Router();

headOfficeRouter.use(requireAdmin);
headOfficeRouter.get("/", listHeadOffices);
headOfficeRouter.get("/next-code", getNextOfficeCode);
headOfficeRouter.get(
  "/code-availability",
  validate(headOfficeCodeAvailabilityQuerySchema, "query"),
  getCodeAvailability,
);
headOfficeRouter.get(
  "/email-availability",
  validate(headOfficeEmailAvailabilityQuerySchema, "query"),
  getEmailAvailability,
);
headOfficeRouter.post("/", validate(createHeadOfficeSchema), createHeadOffice);
headOfficeRouter.get("/:id", validate(headOfficeIdParamsSchema, "params"), getHeadOffice);
headOfficeRouter.patch(
  "/:id",
  validate(headOfficeIdParamsSchema, "params"),
  validate(updateHeadOfficeSchema),
  updateHeadOffice,
);
headOfficeRouter.delete("/:id", validate(headOfficeIdParamsSchema, "params"), deleteHeadOffice);
