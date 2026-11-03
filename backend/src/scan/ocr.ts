import { createWorker, PSM, type Worker } from "tesseract.js";
import { textCropPng, type Rgba } from "./detect.js";

const TEST_WINDOWS = [
  { left: 0.36, top: 0.168, width: 0.36, height: 0.045 },
  { left: 0.36, top: 0.185, width: 0.36, height: 0.04 },
  { left: 0.38, top: 0.2, width: 0.32, height: 0.042 },
  { left: 0.38, top: 0.218, width: 0.3, height: 0.038 },
  { left: 0.4, top: 0.228, width: 0.28, height: 0.032 },
  { left: 0.36, top: 0.21, width: 0.34, height: 0.05 },
  { left: 0.36, top: 0.24, width: 0.36, height: 0.045 },
];
const TEST_LABEL_WINDOW = { left: 0.3, top: 0.165, width: 0.46, height: 0.1 };
const NAME_WINDOW = { left: 0.22, top: 0.075, width: 0.7, height: 0.045 };
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TEST_ALPHA = `${ALPHA}:/ `;
const ROLL_DIGITS = "0123456789";
const NAME_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
const LABEL_WORDS =
  /^(TEST|ID|TESTI|TESTID|EXAM|DATE|EXAMDATE|CLASS|SECTION|SCHOOL|NAME|INSTRUCTION|INSTRUCTIONS|CORRECT|WRONG|METHOD|REGISTRATION|STUDENT|TH|ST|ND|RD)$/;

export type PrintedDetails = {
  name: string;
  testId: string;
  testCandidates: string[];
  examDate: string;
};

let ocr: Promise<Worker> | null = null;
let ocrQueue: Promise<unknown> = Promise.resolve();

async function worker() {
  if (!ocr) {
    ocr = createWorker("eng").then(async (w) => {
      await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      return w;
    });
  }
  return ocr;
}

function ocrText(png: Buffer, psm: PSM, whitelist: string) {
  const run = ocrQueue.then(async () => {
    const w = await worker();
    await w.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: whitelist });
    return (await w.recognize(png)).data.text.toUpperCase();
  });
  ocrQueue = run.catch(() => undefined);
  return run;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function ocrRegion(
  rgba: Rgba,
  box: { left: number; top: number; width: number; height: number },
  modes: PSM[],
  whitelist: string,
  height?: number,
) {
  const crop = await textCropPng(rgba, box, height);
  const texts: string[] = [];
  for (const mode of modes) texts.push(await ocrText(crop, mode, whitelist));
  return texts;
}

function asDigits(value: string, dee: "0" | "3") {
  return [...value.toUpperCase()]
    .map((ch) => {
      if (/\d/.test(ch)) return ch;
      if (ch === "O" || ch === "Q") return "0";
      if (ch === "I" || ch === "L") return "1";
      if (ch === "Z") return "2";
      if (ch === "E") return "3";
      if (ch === "U" || ch === "A" || ch === "H") return "4";
      if (ch === "S") return "5";
      if (ch === "G") return "6";
      if (ch === "T") return "7";
      if (ch === "B") return "8";
      if (ch === "D") return dee;
      return "";
    })
    .join("");
}

function labeledTestValue(text: string) {
  const compact = text.replace(/[^A-Z0-9:/\s]/g, " ").replace(/\s+/g, " ").trim();
  const match =
    compact.match(/TEST\s*I?D\s*:?\s*([A-Z0-9: ]{4,16}?)(?=\s+INSTRUCT|\s+CORRECT|$)/) ?? compact.match(/ID\s*:?\s*([A-Z0-9]{5,8})/);
  return (match?.[1] ?? "").replace(/[:\s]/g, "");
}

function looksLikeDate(digits: string) {
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

function isPlausibleTestId(value: string) {
  if (!/^\d{5,8}$/.test(value) || /^20\d{2}/.test(value) || /20(2[4-9]|3\d)/.test(value)) return false;
  if (value.length === 6 && looksLikeDate(value)) return false;
  return true;
}

function mostlyDigits(token: string) {
  const digits = token.replace(/\D/g, "").length;
  const letters = token.replace(/[^A-Z]/gi, "").length;
  return digits >= 4 && digits >= letters;
}

function parseTests(texts: string[]) {
  const compact = texts.map((text) => text.replace(/[^A-Z0-9:/\s]/g, " ").replace(/\s+/g, " ").trim());
  const digits = compact.flatMap((text) => [...text.matchAll(/\b(\d{6,8})\b/g)].map((match) => match[1]!));
  const labeled = texts.map(labeledTestValue).filter(Boolean);
  const tokens = compact.flatMap((text) =>
    [...text.matchAll(/\b([A-Z0-9]{4,8})\b/g)].map((match) => match[1]!).filter((token) => !LABEL_WORDS.test(token)),
  );
  const labeledIds = unique(labeled.flatMap((value) => [asDigits(value, "0"), asDigits(value, "3")])).filter(isPlausibleTestId);
  const rest = unique([
    ...digits,
    ...tokens.filter(mostlyDigits).flatMap((token) => [asDigits(token, "0"), asDigits(token, "3")]),
  ])
    .filter((value) => isPlausibleTestId(value) && !labeledIds.includes(value))
    .sort((a, b) => b.length - a.length);
  return [...labeledIds, ...rest];
}

function parseName(texts: string[]) {
  const names = texts
    .map((text) => text.replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim())
    .filter((text) => text.replace(/ /g, "").length >= 3 && !/^(STUDENT|NAME|STUDENT NAME)$/.test(text))
    .sort((a, b) => b.length - a.length);
  const best = names[0] ?? "";
  return best
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .trim();
}

/** Tesseract OCR of the header: name and test ID. Registration comes from bubbles, not OCR. Date is not read. */
export async function readPrintedDetails(page: Rgba): Promise<PrintedDetails> {
  const [nameTexts, testTexts] = await Promise.all([
    ocrRegion(page, NAME_WINDOW, [PSM.SINGLE_LINE, PSM.SPARSE_TEXT], NAME_ALPHA, 180),
    Promise.all([
      ...TEST_WINDOWS.map((box) => ocrRegion(page, box, [PSM.SINGLE_LINE, PSM.SPARSE_TEXT], ROLL_DIGITS, 220)),
      ocrRegion(page, TEST_LABEL_WINDOW, [PSM.SPARSE_TEXT], TEST_ALPHA, 220),
    ]).then((rows) => rows.flat()),
  ]);
  let tests = parseTests(testTexts);
  let fragments = unique(
    testTexts.flatMap((text) => {
      const digits = text.replace(/\D/g, "");
      return [digits, ...[...text.matchAll(/\d{5,8}/g)].map((match) => match[0]!)];
    }),
  ).filter((value) => value.length >= 5);
  if (!tests.length && !fragments.length) {
    const wide = (
      await Promise.all([
        ocrRegion(page, { left: 0.28, top: 0.15, width: 0.52, height: 0.12 }, [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK], TEST_ALPHA, 220),
        ocrRegion(page, { left: 0.2, top: 0.1, width: 0.7, height: 0.22 }, [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK], TEST_ALPHA, 240),
      ])
    ).flat();
    tests = parseTests(wide);
    fragments = unique(
      wide.flatMap((text) => {
        const digits = text.replace(/\D/g, "");
        return [digits, ...[...text.matchAll(/\d{5,8}/g)].map((match) => match[0]!)];
      }),
    ).filter((value) => value.length >= 5);
  }
  return {
    name: parseName(nameTexts),
    testId: tests[0] ?? "",
    testCandidates: unique([...tests, ...fragments]),
    examDate: "",
  };
}
