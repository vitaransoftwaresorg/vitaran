import { Router, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAdmin, requireSchool, requireTeacher } from "../middleware/authenticate.js";
import { omrScanRateLimit } from "../middleware/rate-limit.js";
import { validate } from "../middleware/validate.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../utils/app-error.js";
import * as scanService from "./service.js";

const IMAGE_MAX = 8 * 1024 * 1024;
const commitSchema = z.object({ previewId: z.uuid() });

const readImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX, files: 1 },
  fileFilter: (_req, file, done) => {
    if (
      !/^image\/(jpeg|jpg|png|webp|heic|heif)/i.test(file.mimetype) &&
      !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.originalname)
    ) {
      done(new AppError(400, "Only JPG, PNG, or HEIC OMR photos"));
      return;
    }
    done(null, true);
  },
}).single("file");

function omrRouter(contextOf: (res: Response) => scanService.ScanContext) {
  const router = Router();
  router.get("/", async (_req, res) => {
    sendSuccess(res, await scanService.listScans(contextOf(res)));
  });
  router.post("/preview", omrScanRateLimit, readImage, async (req, res) => {
    const file = req.file;
    if (!file?.buffer) throw new AppError(400, "Attach an OMR sheet image");
    const body = req.body as { rollNo?: string; testId?: string };
    sendSuccess(
      res,
      await scanService.previewScan(contextOf(res), file.buffer, file.originalname, {
        rollNo: typeof body?.rollNo === "string" ? body.rollNo : "",
        testId: typeof body?.testId === "string" ? body.testId : "",
      }),
    );
  });
  router.post("/commit", validate(commitSchema), async (req, res) => {
    sendSuccess(res, await scanService.commitScan(contextOf(res), (req.body as { previewId: string }).previewId), 201);
  });
  return router;
}

export const adminOmScanRouter = Router();
adminOmScanRouter.use(requireAdmin);
adminOmScanRouter.use(omrRouter(() => ({ kind: "admin" })));

export const schoolOmScanRouter = Router();
schoolOmScanRouter.use(requireSchool);
schoolOmScanRouter.use(omrRouter((res) => ({ kind: "school", school: res.locals.school as SchoolAccountDto })));

export const teacherOmScanRouter = Router();
teacherOmScanRouter.use(requireTeacher);
teacherOmScanRouter.use(omrRouter((res) => ({ kind: "teacher", teacher: res.locals.teacher as TeacherAccountDto })));
