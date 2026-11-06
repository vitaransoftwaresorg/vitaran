import { Router } from "express";
import {
  getAdminSettings,
  getPublicSettings,
  updateAdminSettings,
} from "../controllers/settings.controller.js";
import { requireAdmin } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { updateAppSettingsSchema } from "../schemas/settings.schema.js";

/** Public maintenance flag for school/teacher portals. */
export const publicSettingsRouter = Router();
publicSettingsRouter.get("/", getPublicSettings);

/** Admin platform settings. */
export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAdmin);
adminSettingsRouter.get("/", getAdminSettings);
adminSettingsRouter.patch("/", validate(updateAppSettingsSchema), updateAdminSettings);
