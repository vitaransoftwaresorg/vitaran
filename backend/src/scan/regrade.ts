import type { Prisma } from "../generated/prisma/client.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import { recordOmrResult } from "../services/result.service.js";
import { asAnswers, asSubjectRanges, type AnswerOption } from "../utils/answer-key-parse.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { logger } from "../utils/logger.js";
import { asRgba } from "../utils/omr-geometry.js";
import { readAnswerBubbles, type BubbleMap } from "./detect.js";
import { getObject, replaceObject } from "../services/object-storage.js";
import { markedSheetPreview } from "./marked-preview.js";
import * as scanRepository from "./repository.js";
import { scoreSheet, sheetFlags } from "./score.js";

export type ScoringKey = Pick<
  answerKeyRepository.AnswerKeyDetail,
  "answers" | "subjectRanges" | "correctMarks" | "wrongMarks"
>;

type Marked = Record<string, AnswerOption | AnswerOption[]>;

/** Two keys with the same fingerprint give every sheet the same marks. */
export function scoringFingerprint(key: ScoringKey) {
  return JSON.stringify([asAnswers(key.answers), asSubjectRanges(key.subjectRanges), key.correctMarks, key.wrongMarks]);
}

export function scoreWithKey(answers: Marked, key: ScoringKey) {
  return scoreSheet(answers, key.answers, key.subjectRanges, {
    correctMarks: key.correctMarks,
    wrongMarks: key.wrongMarks,
  });
}

/** Green/red evaluated sheet for the given key, drawn on the straightened sheet. */
export async function evaluatedImage(sheet: Buffer, bubbles: BubbleMap, answers: Marked, key: ScoringKey) {
  const score = scoreWithKey(answers, key);
  const lists = Object.fromEntries(
    Object.entries(answers).map(([question, value]) => [question, Array.isArray(value) ? value : [value]]),
  );
  return { score, image: await markedSheetPreview(sheet, bubbles, lists, key.answers, score.subjectScores) };
}

const running = new Set<string>();
const rerun = new Set<string>();

/**
 * Re-mark every saved sheet of this answer key in the background: marks, flags, the evaluated image
 * and the student's result row. Rank cards and class PDFs are built from the result rows.
 */
export function regradeScansForKey(answerKeyId: string) {
  if (running.has(answerKeyId)) {
    rerun.add(answerKeyId);
    return;
  }
  running.add(answerKeyId);
  void (async () => {
    try {
      do {
        rerun.delete(answerKeyId);
        await regradeOnce(answerKeyId);
      } while (rerun.has(answerKeyId));
    } catch (error) {
      logger.error({ err: error, answerKeyId }, "OMR re-marking failed");
    } finally {
      running.delete(answerKeyId);
    }
  })();
}

async function regradeOnce(answerKeyId: string) {
  const key = await answerKeyRepository.findAnswerKeyById(answerKeyId);
  if (!key) return;
  const ids = await scanRepository.findScanIdsForKey(answerKeyId);
  if (!ids.length) return;
  const schools = new Set<string>();
  let failed = 0;
  for (const id of ids) {
    // Live phone scans get served between sheets.
    await new Promise((resolve) => setImmediate(resolve));
    if (rerun.has(answerKeyId)) break;
    try {
      const schoolId = await regradeScan(id, key);
      if (schoolId) schools.add(schoolId);
    } catch (error) {
      failed += 1;
      logger.error({ err: error, scanId: id, answerKeyId }, "Could not re-mark OMR sheet");
    }
  }
  logger.info({ answerKeyId, sheets: ids.length, failed }, "OMR sheets re-marked after answer key change");
  for (const schoolId of schools) notifyContentChanged({ kind: "results", schoolId });
}

async function regradeScan(id: string, key: NonNullable<Awaited<ReturnType<typeof answerKeyRepository.findAnswerKeyById>>>) {
  const scan = await scanRepository.findScanForRegrade(id);
  if (!scan) return null;
  const answers = (scan.answers ?? {}) as Marked;
  const sheetBytes = await getObject(scan.image);
  if (!sheetBytes) throw new Error(`OMR sheet image missing for scan ${id}`);
  const { bubbles } = readAnswerBubbles(await asRgba(sheetBytes));
  const { score, image } = await evaluatedImage(sheetBytes, bubbles, answers, key);
  const readFlags = (Array.isArray(scan.flags) ? (scan.flags as Array<{ question: number; reason: string }>) : []).filter(
    (flag) => flag.reason !== "Un-attempted",
  );
  const previewImage = await replaceObject(null, `omr/${scan.schoolId}/${scan.testId}/${scan.rollNo}/evaluated`, image, {
    fileName: "evaluated.jpg",
    contentType: "image/jpeg",
  });
  await scanRepository.updateScanScore(scan.id, {
    flags: sheetFlags(score, readFlags) as Prisma.InputJsonValue,
    subjectScores: score.subjectScores as Prisma.InputJsonValue,
    correct: score.correct,
    wrong: score.wrong,
    blank: score.blank,
    total: score.total,
    maxTotal: score.maxTotal,
    previewImage: Uint8Array.from(previewImage),
  });
  await recordOmrResult({
    schoolId: scan.schoolId,
    programCode: key.programCode,
    testId: scan.testId,
    testNumber: key.testNumber,
    classLevel: scan.classLevel,
    name: scan.studentName,
    rollNo: scan.rollNo,
    sectionName: scan.sectionName,
    subjects: score.subjectScores.map(({ subject, total, maxTotal }) => ({ subject, total, maxTotal })),
    total: score.total,
    maxTotal: score.maxTotal,
  });
  return scan.schoolId;
}
