import { ZodError } from "zod";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";
import { readAnswerBubbles, readRollBubbleCandidates, type BubbleMap } from "./detect.js";
import { readPrintedDetails } from "./ocr.js";
import { prepareSheet } from "./preprocess.js";
import { parseExtractedSheet } from "./schema.js";

export type ScanFlag = { question: number; reason: string };

export type SheetIdentity = {
  rollNo?: string;
  testId?: string;
  /** PDF pages are already flat — skip perspective warp that mis-aligns bubbles. */
  flat?: boolean;
};

export type SheetRead = {
  rollNo: string;
  rollCandidates: string[];
  printedName: string;
  testId: string;
  testCandidates: string[];
  examDate: string;
  answers: Record<string, Array<"A" | "B" | "C" | "D">>;
  flags: ScanFlag[];
  markCount: number;
  confidence: number;
  bubbles?: BubbleMap;
  jpeg: Buffer;
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function pickTestId(candidates: string[], knownIds: string[], reject: string[] = []) {
  const known = unique(knownIds);
  const blocked = new Set(unique(reject).map((value) => value.toUpperCase()));
  const pool = unique(candidates).filter((value) => {
    const upper = value.toUpperCase();
    if (blocked.has(upper)) return false;
    // Registration numbers often leak into header OCR — do not treat them as test IDs.
    if (blocked.has(upper.replace(/\D/g, ""))) return false;
    return true;
  });

  for (const candidate of pool) {
    const hit = known.find((id) => id.toUpperCase() === candidate.toUpperCase());
    if (hit) return hit;
  }

  // Only accept a near-miss when length matches and exactly one known ID is 1 edit away.
  const close = new Map<string, number>();
  for (const candidate of pool) {
    for (const id of known) {
      if (id.length !== candidate.length) continue;
      const distance = levenshtein(candidate.toUpperCase(), id.toUpperCase());
      if (distance !== 1) continue;
      const prev = close.get(id);
      if (prev == null || distance < prev) close.set(id, distance);
    }
  }
  if (close.size === 1) return [...close.keys()][0] ?? "";
  return "";
}

function shiftedDown(digits: string) {
  if (!/^[1-9]{6,7}$/.test(digits)) return "";
  return [...digits].map((digit) => String(Number(digit) - 1)).join("");
}

export function pickRollNo(candidates: string[], knownRolls: string[]) {
  const values = unique(candidates.filter((value) => /^\d{6,7}$/.test(value)));
  if (!values.length) return "";
  const long = values.filter((value) => value.length === 7);
  const pool = long.length ? long : values;
  const known = unique(knownRolls);
  const exactHits = pool.filter((value) => known.some((roll) => roll.toUpperCase() === value.toUpperCase()));
  if (exactHits.length === 1) return known.find((roll) => roll.toUpperCase() === exactHits[0]!.toUpperCase())!;
  if (exactHits.length > 1) {
    const unshifted = exactHits.find((hit) => exactHits.some((other) => shiftedDown(other) === hit));
    if (unshifted) return unshifted;
    if (pool[0] && exactHits.includes(pool[0])) return pool[0];
    return exactHits[0]!;
  }
  if (!known.length) return pool[0]!;
  const close = new Map<string, number>();
  for (const value of pool) {
    for (const roll of known) {
      if (Math.abs(roll.length - value.length) > 1) continue;
      if (levenshtein(roll, value) !== 1) continue;
      close.set(roll, (close.get(roll) ?? 0) + 1);
    }
  }
  if (close.size === 1) return [...close.keys()][0]!;
  return "";
}

function levenshtein(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = Array.from({ length: b.length + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0));
    return row;
  });
  for (let i = 1; i < a.length + 1; i += 1) {
    for (let j = 1; j < b.length + 1; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i]![j] = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
    }
  }
  return rows[a.length]![b.length]!;
}

function cleanRoll(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return /^\d{6,7}$/.test(digits) ? digits : "";
}

function cleanTest(value?: string) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Phone camera and laptop upload both run this pipeline:
 * 1. sharp – orient, quality gate, warp
 * 2. Vitaran OMR template – 100 A/B/C/D answers
 * 3. Typed registration / test ID on phone; otherwise bubbles + Tesseract
 * 4. zod – validate extracted answers
 * BullMQ runs this job for a batch of sheets (see queue.ts).
 */
export async function readSheet(image: Buffer, identity: SheetIdentity = {}): Promise<SheetRead> {
  const prepared = await prepareSheet(image, { flat: identity.flat });
  const bubbles = readAnswerBubbles(prepared.rgba);
  const givenRoll = cleanRoll(identity.rollNo);
  const givenTest = cleanTest(identity.testId);
  // When the examiner typed the test ID, skip header OCR entirely (bubbles only).
  const printed = givenTest
    ? { name: "", testId: givenTest, testCandidates: [givenTest], examDate: "" }
    : await readPrintedDetails(prepared.rgba);
  const rollCandidates = givenRoll ? [givenRoll] : readRollBubbleCandidates(prepared.rgba);
  const rollNo = givenRoll || rollCandidates.find((value) => /^\d{6,7}$/.test(value)) || "";
  if (!rollNo) {
    logger.warn({ rollCandidates, markCount: bubbles.markCount }, "registration bubbles missed");
    throw new AppError(422, "Could not read the registration number. Fill the registration bubbles.");
  }
  const testCandidates = givenTest
    ? [givenTest]
    : unique([printed.testId, ...printed.testCandidates]);
  if (!testCandidates.length) {
    throw new AppError(422, "Enter the test ID from the answer key, then scan again.");
  }
  try {
    const parsed = parseExtractedSheet({
      rollNo,
      rollCandidates: unique(rollCandidates),
      printedName: printed.name,
      testId: givenTest || printed.testId,
      testCandidates,
      examDate: printed.examDate,
      answers: bubbles.answers,
      flags: bubbles.flags,
      markCount: bubbles.markCount,
      confidence: Math.max(0.2, Math.min(1, bubbles.markCount / 100)),
      bubbles: bubbles.bubbles,
    });
    return { ...parsed, jpeg: prepared.jpeg };
  } catch (error) {
    if (error instanceof ZodError) throw new AppError(422, "Could not validate the extracted answers.");
    throw error;
  }
}
