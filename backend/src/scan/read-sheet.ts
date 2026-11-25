import sharp from "sharp";
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
  /** Sheet corners confirmed in the phone scanner (TL, TR, BR, BL as 0–1 fractions of the photo). */
  corners?: SheetCorners;
};

export type SheetCorners = [number, number][];

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

/** Empty / unbubbled grids often collapse to 0000000 — never treat that as a real reg. */
export function isPlausibleRoll(value: string) {
  return /^\d{7}$/.test(value) && value !== "0000000" && !/^(\d)\1{6}$/.test(value);
}

export function pickRollNo(candidates: string[], knownRolls: string[]) {
  const values = unique(candidates.filter(isPlausibleRoll));
  if (!values.length) return "";
  const pool = values;
  const known = unique(knownRolls);
  const exactHits = pool.filter((value) => known.some((roll) => roll.toUpperCase() === value.toUpperCase()));
  if (exactHits.length === 1) return known.find((roll) => roll.toUpperCase() === exactHits[0]!.toUpperCase())!;
  if (exactHits.length > 1) {
    // Prefer the strongest bubble read among exact roster hits.
    for (const value of pool) {
      if (!exactHits.some((hit) => hit.toUpperCase() === value.toUpperCase())) continue;
      return known.find((roll) => roll.toUpperCase() === value.toUpperCase()) ?? value;
    }
    return exactHits[0]!;
  }
  if (!known.length) return pool[0]!;
  // One-edit snap only for the strongest (first) raw candidate — never for weaker
  // alternate grids. Sequential regs (…101 vs …106) make broad snaps dangerous.
  const primary = pool[0]!;
  const near = known.filter(
    (roll) => Math.abs(roll.length - primary.length) <= 1 && levenshtein(roll, primary) <= 1,
  );
  if (near.length === 1) return near[0]!;
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
  return isPlausibleRoll(digits) ? digits : "";
}

function cleanTest(value?: string) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

type OrientedAttempt =
  | { ok: true; read: SheetRead; score: number; gridFound: boolean }
  | { ok: false; error: unknown; score: number };

function scoreRead(gridFound: boolean, rollNo: string, markCount: number, flagCount: number) {
  return (gridFound ? 1000 : 0) + (isPlausibleRoll(rollNo) ? 200 : 0) + markCount * 2 - flagCount;
}

async function rotate180(image: Buffer) {
  return sharp(image).rotate(180).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

async function rotateBy(image: Buffer, angle: 0 | 90 | 180 | 270) {
  if (angle === 0) {
    return sharp(image).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  }
  return sharp(image).rotate(angle).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

/** Score how much an orientation looks like an upright OMR (grid + marks). */
async function orientationScore(image: Buffer, flat: boolean) {
  try {
    const prepared = await prepareSheet(image, { flat });
    const bubbles = readAnswerBubbles(prepared.rgba);
    return {
      score: scoreRead(Boolean(bubbles.gridFound), "", bubbles.markCount, bubbles.flags.length),
      jpeg: prepared.jpeg,
    };
  } catch {
    return { score: -1, jpeg: image };
  }
}

/**
 * Auto-rotate a sheet image upright for display (failed PDF pages, etc.).
 * Tries every 90° turn and keeps the strongest bubble-grid orientation (production upright).
 */
export async function uprightOmrJpeg(image: Buffer, options: { flat?: boolean } = {}): Promise<Buffer> {
  const flat = options.flat !== false;
  const base = await sharp(image).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  const meta = await sharp(base).metadata();
  const landscape = (meta.width ?? 0) > (meta.height ?? 0);

  // Always score all four turns — PDF pages and phone shots land in every orientation.
  const angles: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
  let bestJpeg: Buffer = Buffer.from(base);
  let bestScore = -Infinity;

  for (const angle of angles) {
    const candidate = await rotateBy(base, angle);
    const { score, jpeg } = await orientationScore(candidate, flat);
    if (score > bestScore) {
      bestScore = score;
      bestJpeg = Buffer.from(jpeg);
    }
  }

  // Detection failed — still force portrait so the viewer isn't sideways.
  if (bestScore < 0) {
    const portrait = landscape ? await rotateBy(base, 90) : base;
    return Buffer.from(portrait);
  }
  return bestJpeg;
}

/** One orientation pass — no auto-flip. */
async function readSheetOriented(image: Buffer, identity: SheetIdentity = {}): Promise<OrientedAttempt> {
  try {
    const prepared = await prepareSheet(image, { flat: identity.flat, corners: identity.corners });
    const bubbles = readAnswerBubbles(prepared.rgba);
    // On photos the template guess misreads shadows and creases as answers; PDF pages are flat and keep it.
    if (!identity.flat && !bubbles.gridFound) {
      logger.warn({ markCount: bubbles.markCount, flags: bubbles.flags.length }, "answer grid not found in photo");
      return {
        ok: false,
        score: scoreRead(false, "", bubbles.markCount, bubbles.flags.length),
        error: new AppError(
          422,
          "The answer bubbles aren't clear in this photo. Scan again with the whole sheet flat, sharp and in good light.",
        ),
      };
    }
    const givenRoll = cleanRoll(identity.rollNo);
    const givenTest = cleanTest(identity.testId);
    // When the examiner typed the test ID, skip header OCR entirely (bubbles only).
    const printed = givenTest
      ? { name: "", testId: givenTest, testCandidates: [givenTest], examDate: "" }
      : await readPrintedDetails(prepared.rgba);
    const rollCandidates = givenRoll
      ? [givenRoll]
      : readRollBubbleCandidates(prepared.rgba).filter(isPlausibleRoll);
    const rollNo = givenRoll || rollCandidates[0] || "";
    if (!rollNo) {
      logger.warn({ rollCandidates, markCount: bubbles.markCount }, "registration bubbles missed");
      return {
        ok: false,
        score: scoreRead(Boolean(bubbles.gridFound), "", bubbles.markCount, bubbles.flags.length),
        error: new AppError(422, "Unable to read the registration number."),
      };
    }
    const testCandidates = givenTest
      ? [givenTest]
      : unique([printed.testId, ...printed.testCandidates]);
    if (!testCandidates.length) {
      return {
        ok: false,
        score: scoreRead(Boolean(bubbles.gridFound), rollNo, bubbles.markCount, bubbles.flags.length),
        error: new AppError(422, "Enter the test ID from the answer key, then scan again."),
      };
    }
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
    const read: SheetRead = { ...parsed, jpeg: prepared.jpeg };
    return {
      ok: true,
      read,
      gridFound: Boolean(bubbles.gridFound),
      score: scoreRead(Boolean(bubbles.gridFound), rollNo, bubbles.markCount, bubbles.flags.length),
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, score: 0, error: new AppError(422, "Could not validate the extracted answers.") };
    }
    return { ok: false, score: 0, error };
  }
}

/** Strong upright signal — skip the 180° retry to keep large PDF batches fast. */
function looksUpright(attempt: OrientedAttempt) {
  return attempt.ok === true && attempt.gridFound && isPlausibleRoll(attempt.read.rollNo);
}

function throwAttempt(error: unknown): never {
  if (error instanceof Error) throw error;
  throw new AppError(422, "Could not read this OMR sheet.");
}

/**
 * Phone camera and laptop upload both run this pipeline:
 * 1. sharp – orient, quality gate, warp
 * 2. If the sheet is upside down, rotate 180° and keep the better read
 * 3. Vitaran OMR template – 100 A/B/C/D answers
 * 4. Typed registration / test ID on phone; otherwise bubbles + Tesseract
 * 5. zod – validate extracted answers
 * BullMQ runs this job for a batch of sheets (see queue.ts).
 */
export async function readSheet(image: Buffer, identity: SheetIdentity = {}): Promise<SheetRead> {
  // Phone crop corners already define orientation — do not flip under the user.
  if (identity.corners?.length === 4) {
    const attempt = await readSheetOriented(image, identity);
    if (attempt.ok) return attempt.read;
    throwAttempt(attempt.error);
  }

  const first = await readSheetOriented(image, identity);
  if (looksUpright(first) && first.ok) return first.read;

  let flipped: Buffer;
  try {
    flipped = await rotate180(image);
  } catch (error) {
    if (first.ok) return first.read;
    throwAttempt(first.error instanceof Error ? first.error : error);
  }

  const second = await readSheetOriented(flipped, identity);
  if (second.ok && (!first.ok || second.score > first.score)) {
    logger.info(
      {
        firstScore: first.score,
        secondScore: second.score,
        flat: Boolean(identity.flat),
      },
      "OMR sheet was upside down — used 180° rotation",
    );
    return second.read;
  }
  if (first.ok) return first.read;
  throwAttempt(first.error);
}
