import { ZodError } from "zod";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";
import { readAnswerBubbles, readRollBubbleCandidates } from "./detect.js";
import { readPrintedDetails } from "./ocr.js";
import { prepareSheet } from "./preprocess.js";
import { parseExtractedSheet } from "./schema.js";

export type ScanFlag = { question: number; reason: string };

export type SheetIdentity = {
  rollNo?: string;
  testId?: string;
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
  jpeg: Buffer;
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function pickTestId(candidates: string[], knownIds: string[]) {
  const known = unique(knownIds);
  for (const candidate of candidates) {
    const hit = known.find((id) => id.toUpperCase() === candidate.toUpperCase());
    if (hit) return hit;
  }
  const contained = candidates.flatMap((candidate) => {
    const hits = known.filter((id) => id.length >= 5 && candidate.includes(id) && candidate.length - id.length <= 2);
    return hits.length === 1 && hits[0] ? [hits[0]] : [];
  });
  if (contained[0]) return contained[0];
  const spread = candidates.flatMap((candidate) => {
    const hits = known.filter(
      (id) => id.length >= 5 && candidate.length > id.length && candidate.length - id.length <= 2 && isSubsequence(id, candidate),
    );
    return hits.length === 1 && hits[0] ? [hits[0]] : [];
  });
  if (spread[0]) return spread[0];
  const close = new Map<string, number>();
  for (const candidate of candidates) {
    for (const id of known) {
      if (Math.abs(id.length - candidate.length) > 1) continue;
      const distance = levenshtein(candidate, id);
      const maxDistance = candidate.length >= 6 && id.length >= 6 ? 2 : 1;
      if (distance < 1 || distance > maxDistance) continue;
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

function isSubsequence(needle: string, hay: string) {
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i += 1;
  return i === needle.length;
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
  const prepared = await prepareSheet(image);
  const bubbles = readAnswerBubbles(prepared.rgba);
  const givenRoll = cleanRoll(identity.rollNo);
  const givenTest = cleanTest(identity.testId);
  const printed =
    givenRoll && givenTest
      ? { name: "", testId: givenTest, testCandidates: [givenTest], examDate: "" }
      : await readPrintedDetails(prepared.rgba);
  const rollCandidates = givenRoll ? [givenRoll] : readRollBubbleCandidates(prepared.rgba);
  const rollNo = givenRoll || rollCandidates.find((value) => /^\d{6,7}$/.test(value)) || "";
  if (!rollNo) {
    logger.warn({ rollCandidates, markCount: bubbles.markCount }, "registration bubbles missed");
    throw new AppError(422, "Could not read the registration number. Fill the registration bubbles.");
  }
  const testCandidates = unique([givenTest, printed.testId, ...printed.testCandidates]);
  if (!givenTest && !printed.testId && !printed.testCandidates.length) {
    throw new AppError(422, "Could not read the test ID. Show the sheet header.");
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
    });
    return { ...parsed, jpeg: prepared.jpeg };
  } catch (error) {
    if (error instanceof ZodError) throw new AppError(422, "Could not validate the extracted answers.");
    throw error;
  }
}
