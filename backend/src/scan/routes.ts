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
const PDF_MAX = 500 * 1024 * 1024;
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

const readPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PDF_MAX, files: 1 },
  fileFilter: (_req, file, done) => {
    if (
      !/^application\/pdf$/i.test(file.mimetype) &&
      !/\.pdf$/i.test(file.originalname)
    ) {
      done(new AppError(400, "Upload a PDF of OMR sheets"));
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
  /** Store PDF; pages are rendered on demand via /batch-preview. */
  router.post("/split-pdf", omrScanRateLimit, readPdf, async (req, res) => {
    const file = req.file;
    if (!file?.buffer) throw new AppError(400, "Attach a PDF of OMR sheets");
    const fromBody = req.body?.testId;
    const fromQuery = req.query?.testId;
    const fromHeader = req.get("x-test-id");
    const testId = [fromBody, fromQuery, fromHeader]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .find(Boolean) ?? "";
    sendSuccess(
      res,
      await scanService.registerOmrPdf(contextOf(res), file.buffer, file.originalname, { testId }),
    );
  });
  router.post(
    "/batch-preview",
    omrScanRateLimit,
    validate(
      z.object({
        batchId: z.uuid(),
        page: z.coerce.number().int().min(1).max(120),
        rollNo: z.string().trim().max(16).optional(),
        testId: z.string().trim().max(32).optional(),
      }),
    ),
    async (req, res) => {
      const body = req.body as { batchId: string; page: number; rollNo?: string; testId?: string };
      sendSuccess(
        res,
        await scanService.previewOmrPdfPage(contextOf(res), body.batchId, body.page, {
          rollNo: typeof body.rollNo === "string" ? body.rollNo : "",
          testId: typeof body.testId === "string" ? body.testId : "",
        }),
      );
    },
  );
  router.post("/commit", validate(commitSchema), async (req, res) => {
    sendSuccess(res, await scanService.commitScan(contextOf(res), (req.body as { previewId: string }).previewId), 201);
  });
  router.get("/check-test/:testId", async (req, res) => {
    const testId = z.string().trim().regex(/^\d{6}$/, "Test ID must be exactly 6 digits").parse(req.params.testId);
    sendSuccess(res, await scanService.checkTestId(contextOf(res), testId));
  });
  router.get("/class", async (req, res) => {
    sendSuccess(res, await scanService.listClassScans(contextOf(res), classFilterSchema.parse(req.query)));
  });
  router.get("/class/pdf", async (req, res) => {
    const file = await scanService.getClassScansPdf(
      contextOf(res),
      classFilterSchema.parse(req.query),
      kindSchema.parse(req.query.kind),
    );
    sendFile(res, file, "application/pdf");
  });
  router.get("/:id/image", async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const file = await scanService.getScanImage(contextOf(res), id, kindSchema.parse(req.query.kind));
    sendFile(res, file, "image/jpeg");
  });
  return router;
}

const classFilterSchema = z.object({
  schoolId: z.uuid(),
  testNumber: z.coerce.number().int().min(1).max(99),
  classLevel: z.coerce.number().int().min(1).max(12),
  program: z.string().trim().max(64).optional().transform((value) => value || undefined),
});

const kindSchema = z.enum(["preview", "raw"]).catch("preview");

function sendFile(res: Response, file: { data: Buffer; fileName: string }, type: string) {
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", String(file.data.length));
  res.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.end(file.data);
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
