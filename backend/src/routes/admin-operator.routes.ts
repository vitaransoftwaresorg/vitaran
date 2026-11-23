import { Router } from "express";
import {
  createAdminOperator,
  deleteAdminOperator,
  listAdminOperators,
  updateAdminOperator,
} from "../controllers/admin-operator.controller.js";
import { requireAdmin } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createAdminOperatorSchema,
  updateAdminOperatorSchema,
} from "../schemas/admin-operator.schema.js";

export const adminOperatorRouter = Router();
adminOperatorRouter.use(requireAdmin);
adminOperatorRouter.get("/", listAdminOperators);
adminOperatorRouter.post("/", validate(createAdminOperatorSchema), createAdminOperator);
adminOperatorRouter.patch("/:id", validate(updateAdminOperatorSchema), updateAdminOperator);
adminOperatorRouter.delete("/:id", deleteAdminOperator);
