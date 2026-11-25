import type { Prisma } from "../generated/prisma/client.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import { recordOmrResult } from "../services/result.service.js";
import { asAnswers, asKeyTypeRanges, asSubjectRanges, type AnswerOption } from "../utils/answer-key-parse.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { logger } from "../utils/logger.js";
import { asRgba } from "../utils/omr-geometry.js";
import { readAnswerBubbles, type BubbleMap } from "./detect.js";
import { getObject, replaceObject } from "../services/object-storage.js";
import { markedSheetPreview } from "./marked-preview.js";
import * as scanRepository from "./repository.js";
import {
  filterRangesForPattern,
  filterRangesForSubjects,
  type ExamPattern,
} from "./exam-pattern.js";
import { scoreSheet, sheetFlags } from "./score.js";

export type ScoringKey = Pick<
  answerKeyRepository.AnswerKeyDetail,
  "answers" | "subjectRanges" | "keyTypeRanges" | "correctMarks" | "wrongMarks"
>;

type Marked = Record<string, AnswerOption | AnswerOption[]>;

export type ScoreOptions = {
  /** Live scan: MPCB / PCB / MPC. */
  examPattern?: ExamPattern | null;
  /** Regrade: keep the subjects this sheet was originally scored on. */
  subjects?: string[];
};

function scoringRanges(key: ScoringKey, options: ScoreOptions = {}) {
  const all = asSubjectRanges(key.subjectRanges);
  if (options.subjects?.length) return filterRangesForSubjects(all, options.subjects);
  return filterRangesForPattern(all, options.examPattern);
}

/** Two keys with the same fingerprint give every sheet the same marks. */
export function scoringFingerprint(key: ScoringKey) {
  return JSON.stringify([
    asAnswers(key.answers),
    asSubjectRanges(key.subjectRanges),
    asKeyTypeRanges(key.keyTypeRanges),
    key.correctMarks,
    key.wrongMarks,
  ]);
}

export function scoreWithKey(answers: Marked, key: ScoringKey, options: ScoreOptions = {}) {
  return scoreSheet(
    answers,
    key.answers,
    scoringRanges(key, options),
    {
      correctMarks: key.correctMarks,
      wrongMarks: key.wrongMarks,
    },
    key.keyTypeRanges,
  );
}

/** Green/red evaluated sheet for the given key, drawn on the straightened sheet. */
export async function evaluatedImage(
  sheet: Buffer,
  bubbles: BubbleMap,
  answers: Marked,
  key: ScoringKey,
  options: ScoreOptions = {},
) {
  const score = scoreWithKey(answers, key, options);
  const lists = Object.fromEntries(
    Object.entries(answers).map(([question, value]) => [question, Array.isArray(value) ? value : [value]]),
  );
  return {
    score,
    image: await markedSheetPreview(
      sheet,
      bubbles,
      lists,
      key.answers,
      score.subjectScores,
      key.keyTypeRanges,
    ),
  };
}

const running = new Set<string>();
const rerun = new Set<string>();

/** Per-sheet retries before waiting for another key edit / requeue. */
const MAX_ATTEMPTS_PER_SCAN = 8;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 30_000;

/**
 * Re-mark every saved sheet of this answer key in the background: marks, flags, the evaluated image
 * and the student's result row. Rank cards and class PDFs are built from the result rows.
 */
/** True while saved OMR sheets are being re-marked for this answer key. */
export function isRegradeRunningForKey(answerKeyId: string) {
  return running.has(answerKeyId);
}

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
  const evaluatedTestId = key.testId?.trim() || "";
  if (evaluatedTestId) {
    await scanRepository.syncTestIdForKey(answerKeyId, evaluatedTestId);
  }

  let pending = await scanRepository.findScanIdsForKey(answerKeyId);
  if (!pending.length) return;

  const schools = new Set<string>();
  const attempts = new Map<string, number>();
  let round = 0;
  let succeeded = 0;

  while (pending.length > 0) {
    if (rerun.has(answerKeyId)) break;
    round += 1;
    const failed: string[] = [];

    for (const id of pending) {
      // Live phone scans get served between sheets.
      await new Promise((resolve) => setImmediate(resolve));
      if (rerun.has(answerKeyId)) break;
      try {
        const schoolId = await regradeScan(id, key, evaluatedTestId);
        if (schoolId) schools.add(schoolId);
        attempts.delete(id);
        succeeded += 1;
      } catch (error) {
        const n = (attempts.get(id) ?? 0) + 1;
        attempts.set(id, n);
        logger.error({ err: error, scanId: id, answerKeyId, attempt: n }, "Could not re-mark OMR sheet");
        if (n < MAX_ATTEMPTS_PER_SCAN) {
          failed.push(id);
        } else {
          logger.error(
            { scanId: id, answerKeyId, attempts: n },
            "OMR re-mark stopped for this sheet after max attempts — will retry on next key save",
          );
        }
      }
    }

    if (failed.length === 0) break;

    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(round - 1, 5));
    logger.info(
      { answerKeyId, remaining: failed.length, round, delayMs: delay },
      "Retrying failed OMR re-marks",
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    pending = failed;
  }

  logger.info(
    {
      answerKeyId,
      succeeded,
      remaining: pending.length,
      rounds: round,
    },
    "OMR sheets re-marked after answer key change",
  );
  for (const schoolId of schools) notifyContentChanged({ kind: "results", schoolId });
}

async function regradeScan(
  id: string,
  key: NonNullable<Awaited<ReturnType<typeof answerKeyRepository.findAnswerKeyById>>>,
  evaluatedTestId: string,
) {
  const scan = await scanRepository.findScanForRegrade(id);
  if (!scan) return null;
  const answers = (scan.answers ?? {}) as Marked;
  const sheetBytes = await getObject(scan.image);
  if (!sheetBytes) throw new Error(`OMR sheet image missing for scan ${id}`);
  const { bubbles } = readAnswerBubbles(await asRgba(sheetBytes));
  // Keep the exam pattern this sheet was scored with (e.g. PCB without Maths).
  const priorSubjects = Array.isArray(scan.subjectScores)
    ? (scan.subjectScores as Array<{ subject?: string }>)
        .map((row) => row.subject)
        .filter((subject): subject is string => typeof subject === "string" && subject.length > 0)
    : [];
  const { score, image } = await evaluatedImage(sheetBytes, bubbles, answers, key, {
    subjects: priorSubjects,
  });
  const readFlags = (Array.isArray(scan.flags) ? (scan.flags as Array<{ question: number; reason: string }>) : []).filter(
    (flag) => flag.reason !== "Un-attempted",
  );
  const testId = evaluatedTestId || scan.testId;
  const previewImage = await replaceObject(null, `omr/${scan.schoolId}/${testId}/${scan.rollNo}/evaluated`, image, {
    fileName: "evaluated.jpg",
    contentType: "image/jpeg",
  });
  await scanRepository.updateScanScore(scan.id, {
    ...(testId !== scan.testId ? { testId } : {}),
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
    testId,
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
