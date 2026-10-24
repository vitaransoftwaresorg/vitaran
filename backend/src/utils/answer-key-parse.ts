import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import { Subject } from "../generated/prisma/enums.js";
import { readKeyGrid } from "./answer-key-grid.js";

export const ANSWER_OPTIONS = ["A", "B", "C", "D"] as const;
export type AnswerOption = (typeof ANSWER_OPTIONS)[number];
/** ADD | single A–D | mains OR ("B/C") | advanced AND ("A,C,D"). */
export type KeyAnswer = string;
export type KeyPattern = "MAINS" | "ADVANCED";

export type SubjectRange = {
  subject: Subject;
  from: number;
  to: number;
  maxMarks: number;
};

export type ParsedAnswerKey = {
  testId: string | null;
  answers: Record<string, KeyAnswer>;
  explanations: Record<string, string>;
  subjectRanges: SubjectRange[];
  pattern: KeyPattern;
};

const MARKS_PER_QUESTION = 4;
const BLOCK = 25;
const MPC = [Subject.MATHEMATICS, Subject.PHYSICS, Subject.CHEMISTRY] as const;
const PCB = [Subject.PHYSICS, Subject.CHEMISTRY, Subject.BIOLOGY] as const;
const MPCB = [...MPC, Subject.BIOLOGY] as const;

const HEADING: Record<string, Subject> = {
  mathematics: Subject.MATHEMATICS,
  maths: Subject.MATHEMATICS,
  math: Subject.MATHEMATICS,
  physics: Subject.PHYSICS,
  chemistry: Subject.CHEMISTRY,
  biology: Subject.BIOLOGY,
  science: Subject.SCIENCE,
};

const isOption = (value: string): value is AnswerOption =>
  ANSWER_OPTIONS.includes(value as AnswerOption);

export function parseKeyAnswer(value: unknown): KeyAnswer | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toUpperCase();
  if (token === "ADD" || token === "BONUS" || token === "FREE") return "ADD";
  const slash = token.includes("/");
  const comma = token.includes(",");
  const parts = token
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter(isOption);
  const packed =
    parts.length === 0 && /^[A-D]{1,4}$/.test(token)
      ? [...new Set(token.split(""))].filter(isOption)
      : parts;
  const unique = [...new Set(packed)];
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0]!;
  unique.sort();
  return slash && !comma ? unique.join("/") : unique.join(",");
}

export function keyOptions(answer: KeyAnswer | null | undefined): AnswerOption[] {
  if (!answer || answer === "ADD") return [];
  const split = answer.split(/[,/]/).filter(isOption);
  const letters = split.length > 0 ? split : answer.replace(/[^A-D]/g, "").split("").filter(isOption);
  return ANSWER_OPTIONS.filter((option) => letters.includes(option));
}

/** Mains B/C: any one listed option is full marks. */
export function isOrKey(answer: KeyAnswer | null | undefined) {
  return Boolean(answer && answer.includes("/") && !answer.includes(","));
}

/** Advanced A,C,D: every listed option is required for full marks. */
export function isAndKey(answer: KeyAnswer | null | undefined) {
  return Boolean(answer && answer !== "ADD" && keyOptions(answer).length > 1 && !isOrKey(answer));
}

export function isBonusKey(answer: KeyAnswer | null | undefined) {
  return answer === "ADD";
}

export function matchesKey(marked: AnswerOption | null | undefined, expected: KeyAnswer) {
  if (expected === "ADD") return Boolean(marked);
  return Boolean(marked && keyOptions(expected).includes(marked));
}

async function screenshotPage(parser: PDFParse, page: number, scale: number) {
  const shots = await parser.getScreenshot({
    partial: [page],
    scale,
    imageDataUrl: false,
  });
  const shot = shots.pages[0];
  if (!shot) throw new Error(`PDF page ${page} is empty`);
  return Buffer.from(shot.data);
}

async function cropBand(png: Buffer, top: number, height: number) {
  const meta = await sharp(png).metadata();
  const width = meta.width ?? 0;
  const pageHeight = meta.height ?? 0;
  const topPx = Math.round(pageHeight * top);
  const heightPx = Math.round(pageHeight * height);
  return sharp(png)
    .extract({
      left: Math.round(width * 0.04),
      top: topPx,
      width: Math.round(width * 0.92),
      height: Math.min(heightPx, pageHeight - topPx),
    })
    .png()
    .toBuffer();
}

function collectAnswers(text: string) {
  const answers: Record<string, KeyAnswer> = {};
  const token =
    /(\d{1,3})\s*[).:\-]\s*(Add|BONUS|FREE|[A-D](?:\s*[,/]\s*[A-D])+|[A-D]{2,4}|[A-D])(?![A-Za-z])/gi;
  for (const match of text.matchAll(token)) {
    const question = Number(match[1]);
    const parsed = parseKeyAnswer(match[2]);
    if (question >= 1 && question <= 200 && parsed) answers[String(question)] = parsed;
  }
  return answers;
}

function collectHeadings(text: string) {
  const found: Subject[] = [];
  for (const match of text.matchAll(
    /(?:^|\n)\s*(mathematics|maths|math|physics|chemistry|biology|science)\s*(?:\n|$)/gi,
  )) {
    const subject = HEADING[match[1]!.toLowerCase()];
    if (subject && !found.includes(subject)) found.push(subject);
  }
  return found;
}

function lastQuestion(answers: Record<string, KeyAnswer>, extras: number[]) {
  const nums = [...Object.keys(answers).map(Number), ...extras];
  const max = nums.length ? Math.max(...nums) : 0;
  if (max > BLOCK * 3) return BLOCK * 4;
  if (max > BLOCK * 2) return BLOCK * 3;
  return max;
}

function rangesFor(subjects: readonly Subject[], last: number): SubjectRange[] {
  return subjects
    .map((subject, index) => {
      const from = index * BLOCK + 1;
      const to = Math.min((index + 1) * BLOCK, last);
      const count = Math.max(0, to - from + 1);
      return { subject, from, to, maxMarks: count * MARKS_PER_QUESTION };
    })
    .filter((range) => range.to >= range.from && last >= range.from);
}

/** 75-q is MPC or PCB from headings; 100-q is MPCB. Same 25-bubble blocks either way. */
function subjectOrder(headings: Subject[], last: number) {
  if (last > BLOCK * 3) {
    const fromHeadings = MPCB.filter((subject) => headings.includes(subject));
    return fromHeadings.length >= 3 ? fromHeadings : [...MPCB];
  }
  const pcb = PCB.filter((subject) => headings.includes(subject));
  if (pcb.length === 3 && !headings.includes(Subject.MATHEMATICS)) return [...PCB];
  const mpc = MPC.filter((subject) => headings.includes(subject));
  if (mpc.length >= 3) return mpc;
  if (headings.includes(Subject.SCIENCE) && headings.length >= 2) {
    return [Subject.MATHEMATICS, Subject.SCIENCE].filter((subject) => headings.includes(subject));
  }
  return [...MPC];
}

export function detectKeyPattern(text: string, answers: Record<string, KeyAnswer>): KeyPattern {
  if (/one\s+or\s+more\s+than\s+one/i.test(text) || /multi[\s-]?correct/i.test(text)) return "ADVANCED";
  if (Object.values(answers).some((answer) => answer.includes(","))) return "ADVANCED";
  return "MAINS";
}

function explanationChunks(text: string) {
  const start = text.search(/EXPLANATIONS?/i);
  const body = start >= 0 ? text.slice(start) : text;
  const chunks = new Map<number, string>();
  const matches = [...body.matchAll(/(?:^|\n)\s*(\d{1,3})\s*[.)]\s+/g)];
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index]!;
    const question = Number(match[1]);
    if (question < 1 || question > 200) continue;
    const from = (match.index ?? 0) + match[0].length;
    const to = matches[index + 1]?.index ?? body.length;
    chunks.set(question, body.slice(from, to).trim());
  }
  return chunks;
}

function parseChunk(chunk: string): { answer: KeyAnswer | null; explanation: string } {
  const answerMatch =
    chunk.match(/Answer\s*:?\s*(ADD|[A-D](?:\s*[,/]\s*[A-D])*|[A-D]{2,4})/i) ??
    chunk.match(/^\s*(ADD|[A-D](?:\s*[,/]\s*[A-D])*|[A-D]{2,4})\s*[\]).:]/) ??
    chunk.match(/\bmatches\s+([A-D])\b/i);
  const answer = parseKeyAnswer(answerMatch?.[1] ?? "");
  const explMatch = chunk.match(/Explanation\s*:\s*([\s\S]+)/i);
  let explanation = (explMatch?.[1] ?? chunk.replace(/^[\s\S]*?Answer\s*:?[^\n]*\n?/i, "")).trim();
  explanation = explanation
    .replace(/(?:^|\n)\s*(mathematics|maths|physics|chemistry|biology|science)\s*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
  return { answer, explanation };
}

export function parseAnswerKeyText(text: string): ParsedAnswerKey {
  const testId = text.match(/Test\s*I[D1]\s*:?\s*([A-Z0-9-]{2,20})/i)?.[1] ?? null;
  const fromKey = collectAnswers(text);
  const headings = collectHeadings(text);
  const explanations: Record<string, string> = {};
  const fromExpl: Record<string, KeyAnswer> = {};

  for (const [question, chunk] of explanationChunks(text)) {
    const parsed = parseChunk(chunk);
    if (parsed.answer) fromExpl[String(question)] = parsed.answer;
    if (parsed.explanation) explanations[String(question)] = parsed.explanation;
  }

  const answers = { ...fromExpl, ...fromKey };
  const last = lastQuestion(answers, [...explanationChunks(text).keys()]);
  const subjects = subjectOrder(headings, last || Object.keys(answers).length);
  const subjectRanges = rangesFor(subjects, last || subjects.length * BLOCK);

  return { testId, answers, explanations, subjectRanges, pattern: detectKeyPattern(text, answers) };
}

const KEY_TOKEN =
  /(\d{1,3})\s*\)\s*(Add|BONUS|FREE|[A-D](?:\s*[,/]\s*[A-D])+|[A-D]{2,4}|[A-D])(?![A-Za-z])/gi;

/** A key line is "1) C 2) A 3) B …"; prose never packs this many "n) X" pairs on one line. */
function isKeyLine(line: string) {
  return (line.match(/\d{1,3}\s*\)\s*(?:Add|BONUS|FREE|[A-D])/gi)?.length ?? 0) >= 4;
}

/**
 * Typed key list such as "1) C 2) A … 75) A".
 * Mains: "B/C" (either is 4 marks), "60) Add" (any bubble = 4).
 * Advanced: "11) A,C,D" (all required for 4; partial otherwise).
 */
export function parseTextKey(text: string): ParsedAnswerKey | null {
  const lines = text.split(/\r?\n/);
  const answers: Record<string, KeyAnswer> = {};
  for (const line of lines.filter(isKeyLine)) {
    for (const match of line.matchAll(KEY_TOKEN)) {
      const question = Number(match[1]);
      const parsed = parseKeyAnswer(match[2]);
      if (question >= 1 && question <= 200 && parsed) answers[String(question)] = parsed;
    }
  }
  if (Object.keys(answers).length < 10) return null;

  const prose = lines.filter((line) => !isKeyLine(line)).join("\n");
  const explanations: Record<string, string> = {};
  for (const [question, chunk] of explanationChunks(prose)) {
    const { explanation } = parseChunk(chunk);
    if (explanation) explanations[String(question)] = explanation;
  }
  const keyNumbers = lines
    .filter(isKeyLine)
    .flatMap((line) => [...line.matchAll(/(\d{1,3})\s*\)/g)].map((m) => Number(m[1])));
  const last = lastQuestion(answers, keyNumbers);
  const subjects = subjectOrder(collectHeadings(prose), last);
  return {
    testId: text.match(/Test\s*I[D1]\s*:?\s*([A-Z0-9-]{2,20})/i)?.[1] ?? null,
    answers,
    explanations,
    subjectRanges: rangesFor(subjects, last),
    pattern: detectKeyPattern(text, answers),
  };
}

/**
 * A typed key list ("1) C 2) A …") is read from the PDF text. Scanned keys fall back to the
 * printed 10×10 KEY grid on page 1.
 */
export async function parseAnswerKeyPdf(pdf: Buffer): Promise<ParsedAnswerKey> {
  const parser = new PDFParse({ data: pdf });
  try {
    const fromText = parseTextKey((await parser.getText()).text);
    if (fromText) return fromText;
    const page = await screenshotPage(parser, 1, 2);
    const grid = await readKeyGrid(await cropBand(page, 0.26, 0.36));
    const answers: Record<string, KeyAnswer> = { ...grid };
    const last = lastQuestion(answers, []);
    const subjects = subjectOrder([], last || Object.keys(answers).length);
    const subjectRanges = rangesFor(subjects, last || subjects.length * BLOCK);
    return { testId: null, answers, explanations: {}, subjectRanges, pattern: "MAINS" };
  } finally {
    await parser.destroy();
  }
}

export function asAnswers(value: unknown): Record<string, KeyAnswer> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const answers: Record<string, KeyAnswer> = {};
  for (const [question, option] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d+$/.test(question)) continue;
    const parsed = parseKeyAnswer(option);
    if (parsed) answers[question] = parsed;
  }
  return answers;
}

export function asMarkedAnswers(value: unknown): Record<string, AnswerOption> {
  const answers: Record<string, AnswerOption> = {};
  for (const [question, options] of Object.entries(asMarkedSelections(value))) {
    if (options[0]) answers[question] = options[0];
  }
  return answers;
}

/** Every filled bubble on a question, in A–D order. Accepts "A", "ACD", "A,C,D", "B/C". */
export function asMarkedSelections(value: unknown): Record<string, AnswerOption[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const answers: Record<string, AnswerOption[]> = {};
  for (const [question, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d+$/.test(question)) continue;
    const token = typeof raw === "string" ? raw.toUpperCase() : "";
    const letters = token.replace(/[^A-D]/g, "").split("").filter(isOption);
    const unique = ANSWER_OPTIONS.filter((option) => letters.includes(option));
    if (unique.length > 0) answers[question] = unique;
  }
  return answers;
}

export function formatMarked(options: AnswerOption[]) {
  return ANSWER_OPTIONS.filter((option) => options.includes(option)).join("");
}

export function asExplanations(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const explanations: Record<string, string> = {};
  for (const [question, text] of Object.entries(value as Record<string, unknown>)) {
    if (/^\d+$/.test(question) && typeof text === "string" && text.trim()) {
      explanations[question] = text;
    }
  }
  return explanations;
}

export function asSubjectRanges(value: unknown): SubjectRange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const { subject, from, to, maxMarks } = row as Record<string, unknown>;
    if (typeof subject !== "string" || !(subject in Subject)) return [];
    if (typeof from !== "number" || typeof to !== "number") return [];
    return [
      {
        subject: subject as Subject,
        from,
        to,
        maxMarks: typeof maxMarks === "number" ? maxMarks : Math.max(0, to - from + 1) * MARKS_PER_QUESTION,
      },
    ];
  });
}

export function defaultSubjectRanges(lastQuestion: number): SubjectRange[] {
  return rangesFor(lastQuestion > BLOCK * 3 ? MPCB : MPC, lastQuestion);
}

export type AnswerCorrection = {
  question: number;
  from: KeyAnswer | null;
  to: KeyAnswer | null;
  explanation: string;
};

/** Questions where admin changed the printed KEY option. Explanation rides along. */
export function diffCorrections(
  printedAnswers: Record<string, KeyAnswer>,
  answers: Record<string, KeyAnswer>,
  _printedExplanations: Record<string, string>,
  explanations: Record<string, string>,
): AnswerCorrection[] {
  const questions = new Set([...Object.keys(printedAnswers), ...Object.keys(answers)]);
  return [...questions]
    .map(Number)
    .filter((question) => question > 0)
    .sort((a, b) => a - b)
    .flatMap((question) => {
      const key = String(question);
      const from = printedAnswers[key] ?? null;
      const to = answers[key] ?? from;
      if (!to || to === from) return [];
      return [{ question, from, to, explanation: (explanations[key] ?? "").trim() }];
    });
}
