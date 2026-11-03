import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import { readKeyGrid } from "./answer-key-grid.js";

export const ANSWER_OPTIONS = ["A", "B", "C", "D"] as const;
export type AnswerOption = (typeof ANSWER_OPTIONS)[number];
/** Printed KEY cell: one option, two options ("B/C"), or a bonus ("ADD"). */
export type KeyAnswer = AnswerOption | `${AnswerOption}/${AnswerOption}` | "ADD";

export type SubjectRange = {
  subject: string;
  from: number;
  to: number;
  maxMarks: number;
};

export type ParsedAnswerKey = {
  testId: string | null;
  answers: Record<string, KeyAnswer>;
  explanations: Record<string, string>;
  subjectRanges: SubjectRange[];
};

export const QUESTIONS_PER_PAPER = 100;
export const MARKS_PER_QUESTION = 4;
const BLOCK = 25;
const MPC = ["MATHEMATICS", "PHYSICS", "CHEMISTRY"] as const;
const MPCB = [...MPC, "BIOLOGY"] as const;

const HEADING: Record<string, string> = {
  mathematics: "MATHEMATICS",
  maths: "MATHEMATICS",
  math: "MATHEMATICS",
  physics: "PHYSICS",
  chemistry: "CHEMISTRY",
  biology: "BIOLOGY",
  science: "SCIENCE",
  english: "ENGLISH",
};

const isOption = (value: string): value is AnswerOption =>
  ANSWER_OPTIONS.includes(value as AnswerOption);

export function parseKeyAnswer(value: unknown): KeyAnswer | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toUpperCase();
  if (token === "ADD" || token === "BONUS" || token === "FREE") return "ADD";
  const parts = token
    .split("/")
    .map((part) => part.trim())
    .filter(isOption);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  const unique = [...new Set(parts)];
  return unique.join("/") as KeyAnswer;
}

export function keyOptions(answer: KeyAnswer | null | undefined): AnswerOption[] {
  if (!answer || answer === "ADD") return [];
  return answer.split("/").filter(isOption);
}

export function isBonusKey(answer: KeyAnswer | null | undefined) {
  return answer === "ADD";
}

export function matchesKey(marked: AnswerOption | null | undefined, expected: KeyAnswer) {
  if (expected === "ADD") return Boolean(marked);
  return Boolean(marked && keyOptions(expected).includes(marked));
}

export function isMultiKey(answer: KeyAnswer | null | undefined) {
  return keyOptions(answer).length > 1;
}

export function markedList(value: unknown): AnswerOption[] {
  if (Array.isArray(value)) return value.filter(isOption);
  if (typeof value !== "string") return [];
  return value
    .split("/")
    .map((part) => part.trim().toUpperCase())
    .filter(isOption);
}

/** Single-correct keys ignore double marks. Multi-correct keys need the same set. */
export function markedMatchesKey(marked: AnswerOption[], expected: KeyAnswer) {
  if (isBonusKey(expected)) return marked.length > 0;
  const wanted = keyOptions(expected);
  if (wanted.length === 0 || marked.length === 0) return false;
  if (marked.length > 1 && wanted.length === 1) return false;
  if (marked.length > 1) {
    return [...marked].sort().join("") === [...wanted].sort().join("");
  }
  return wanted.includes(marked[0]!);
}

/** 100 questions split across the program's subjects, 4 marks each. */
export function defaultSubjectRanges(subjects: readonly string[]): SubjectRange[] {
  const list = subjects.length > 0 ? [...subjects] : ["MATHEMATICS"];
  const extra = QUESTIONS_PER_PAPER % list.length;
  const base = Math.floor(QUESTIONS_PER_PAPER / list.length);
  let from = 1;
  return list.map((subject, index) => {
    const count = base + (index < extra ? 1 : 0);
    const to = from + count - 1;
    const range = { subject, from, to, maxMarks: count * MARKS_PER_QUESTION };
    from = to + 1;
    return range;
  });
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
  const answers: Record<string, AnswerOption> = {};
  for (const match of text.matchAll(/(\d{1,3})\s*[).:\-]\s*([A-D])(?:[A-D])?\b/g)) {
    const question = Number(match[1]);
    const option = match[2];
    if (question >= 1 && question <= 200 && option && isOption(option)) {
      answers[String(question)] = option;
    }
  }
  return answers;
}

function collectHeadings(text: string) {
  const found: string[] = [];
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

function rangesFor(subjects: readonly string[], last: number): SubjectRange[] {
  return subjects
    .map((subject, index) => {
      const from = index * BLOCK + 1;
      const to = Math.min((index + 1) * BLOCK, last);
      const count = Math.max(0, to - from + 1);
      return { subject, from, to, maxMarks: count * MARKS_PER_QUESTION };
    })
    .filter((range) => range.to >= range.from && last >= range.from);
}

/** Friend’s rule: paper order is always M-P-C, plus Biology when there are 100 questions. */
function subjectOrder(headings: string[], last: number) {
  const canonical = last > BLOCK * 3 ? MPCB : MPC;
  const fromHeadings = canonical.filter((subject) => headings.includes(subject));
  if (fromHeadings.length >= 3) return fromHeadings;
  if (headings.includes("SCIENCE") && headings.length >= 2) {
    return ["MATHEMATICS", "SCIENCE"].filter((subject) => headings.includes(subject));
  }
  return [...canonical];
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

function parseChunk(chunk: string): { answer: AnswerOption | null; explanation: string } {
  const answerMatch =
    chunk.match(/Answer\s*:?\s*([A-D])\s*[\]).:]/i) ??
    chunk.match(/^\s*([A-D])\s*[\]).:]/) ??
    chunk.match(/\bmatches\s+([A-D])\b/i);
  const answer = answerMatch?.[1] && isOption(answerMatch[1]) ? answerMatch[1] : null;
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

  return { testId, answers, explanations, subjectRanges };
}

const KEY_TOKEN = /(\d{1,3})\s*\)\s*(Add|BONUS|FREE|[A-D](?:\s*\/\s*[A-D])*)(?![A-Za-z])/gi;

/** A key line is "1) C 2) A 3) B …"; prose never packs this many "n) X" pairs on one line. */
function isKeyLine(line: string) {
  return (line.match(/\d{1,3}\s*\)\s*(?:Add|BONUS|FREE|[A-D])/gi)?.length ?? 0) >= 4;
}

/**
 * Typed key list such as "1) C 2) A … 75) A".
 * "B/C" keeps both options. "60) Add" is a bonus (free marks).
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
    return { testId: null, answers, explanations: {}, subjectRanges };
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
  for (const [question, option] of Object.entries(asAnswers(value))) {
    if (isOption(option)) answers[question] = option;
  }
  return answers;
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
    if (typeof subject !== "string" || !/^[A-Z][A-Z0-9_]{1,63}$/.test(subject)) return [];
    if (typeof from !== "number" || typeof to !== "number") return [];
    return [
      {
        subject,
        from,
        to,
        maxMarks: typeof maxMarks === "number" ? maxMarks : Math.max(0, to - from + 1) * MARKS_PER_QUESTION,
      },
    ];
  });
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
