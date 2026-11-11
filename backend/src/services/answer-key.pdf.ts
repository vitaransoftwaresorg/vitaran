import { PDFDocument, StandardFonts, type PDFPage } from "pdf-lib";
import type { KeyAnswer, SubjectRange } from "../utils/answer-key-parse.js";
import {
  AMBER_700,
  BRAND_50,
  BRAND_100,
  BRAND_200,
  BRAND_700,
  BRAND_900,
  BRAND_950,
  CONTENT,
  FOOTER,
  H,
  M,
  N_50,
  N_100,
  N_200,
  N_400,
  N_500,
  N_700,
  N_800,
  N_950,
  SKY_700,
  W,
  WHITE,
  drawLogoHeader,
  drawPageFooters,
  drawText,
  embedLogo,
  roundedRect,
  wrap,
  type Fonts,
} from "./pdf-kit.js";

const OPTIONS = ["A", "B", "C", "D"] as const;

const SUBJECT_NAMES: Record<string, string> = { MATHEMATICS: "Mathematics", GK: "General Knowledge" };

export type AnswerKeyPdfData = {
  schoolName: string;
  programName: string;
  testNumber: number;
  testId: string | null;
  classLevel: number;
  correctMarks: number;
  wrongMarks: number;
  publishedAt: Date;
  answers: Record<string, KeyAnswer>;
  explanations: Record<string, string>;
  subjectRanges: SubjectRange[];
};

export type AnswerKeyPdfLogos = { vitaran: Buffer | null; school: Buffer | null };

const subjectName = (code: string) =>
  SUBJECT_NAMES[code] ??
  code
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");

const marks = (value: number) => String(Math.round(value * 100) / 100);

function subjectsOf(data: AnswerKeyPdfData): SubjectRange[] {
  if (data.subjectRanges.length > 0) return data.subjectRanges;
  const last = Math.max(0, ...Object.keys(data.answers).map(Number));
  return [{ subject: "QUESTIONS", from: 1, to: last, maxMarks: 0 }];
}

const keyOptions = (answer: KeyAnswer | undefined) =>
  !answer || answer === "ADD" ? [] : (answer.split("/") as string[]);

const TABLE_ROWS = 10;

export async function renderAnswerKeyPdf(data: AnswerKeyPdfData, logos: AnswerKeyPdfLogos) {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const [vitaran, school] = await Promise.all([embedLogo(pdf, logos.vitaran), embedLogo(pdf, logos.school)]);

  const subjects = subjectsOf(data);
  const questionsIn = (range: SubjectRange) =>
    Array.from({ length: Math.max(0, range.to - range.from + 1) }, (_, i) => range.from + i);
  const questions = [...new Set(subjects.flatMap(questionsIn))].sort((a, b) => a - b);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let top = 0;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    top = M;
  };
  const ensure = (height: number) => {
    if (top + height > H - FOOTER) newPage();
  };

  newPage();

  // Logo header, first page only.
  top = drawLogoHeader(page, fonts, { vitaran, school }, data.schoolName, data.programName);

  // Header card: same fields as the portal page.
  const meta = [
    { label: "TEST", value: String(data.testNumber) },
    ...(data.testId ? [{ label: "TEST ID", value: data.testId }] : []),
    { label: "CLASS", value: String(data.classLevel) },
    { label: "QUESTIONS", value: String(questions.length) },
    { label: "CORRECT", value: `+${marks(data.correctMarks)}` },
    { label: "WRONG", value: `-${marks(data.wrongMarks)}` },
  ];
  roundedRect(page, M, top, CONTENT, 56, 8, { fill: WHITE, border: BRAND_200 });
  drawText(page, "ANSWER KEY", M + 14, top + 17, { font: fonts.bold, size: 7, color: BRAND_700, spacing: 1.4 });
  const metaW = (CONTENT - 28) / meta.length;
  meta.forEach((item, index) => {
    const x = M + 14 + index * metaW;
    drawText(page, item.label, x, top + 32, { font: fonts.bold, size: 6.5, color: N_500, spacing: 0.6 });
    drawText(page, item.value, x, top + 46, { font: fonts.bold, size: 11, color: N_950 });
  });
  top += 72;

  // Answer key table: Q1–Q10 down column 1, Q11–Q20 down column 2, …
  const columns = Math.max(1, Math.ceil(questions.length / TABLE_ROWS));
  const rowH = 17;
  const tableH = 36 + 18 + TABLE_ROWS * rowH;
  ensure(tableH);
  roundedRect(page, M, top, CONTENT, tableH, 8, { fill: WHITE, border: BRAND_200 });
  page.drawRectangle({ x: M + 0.5, y: H - top - 36, width: CONTENT - 1, height: 35, color: BRAND_50 });
  roundedRect(page, M, top, CONTENT, 12, 8, { fill: BRAND_50 });
  page.drawLine({ start: { x: M, y: H - top - 36 }, end: { x: W - M, y: H - top - 36 }, thickness: 0.6, color: BRAND_100 });
  drawText(page, "Answer key", M + 12, top + 16, { font: fonts.bold, size: 10, color: BRAND_950 });
  drawText(page, `${questions.length} questions · options only`, M + 12, top + 28, { font: fonts.regular, size: 8, color: N_500 });
  const tableTop = top + 36;
  const pairW = (CONTENT - 1) / columns;
  page.drawRectangle({ x: M + 0.5, y: H - tableTop - 18, width: CONTENT - 1, height: 18, color: N_50 });
  page.drawLine({ start: { x: M, y: H - tableTop - 18 }, end: { x: W - M, y: H - tableTop - 18 }, thickness: 0.6, color: N_200 });
  for (let col = 0; col < columns; col++) {
    const x = M + col * pairW;
    drawText(page, "Q", x + 7, tableTop + 12, { font: fonts.bold, size: 6.5, color: N_500, spacing: 0.6 });
    drawText(page, "KEY", x + pairW * 0.48, tableTop + 12, { font: fonts.bold, size: 6.5, color: N_500, spacing: 0.6 });
    if (col > 0) {
      page.drawLine({
        start: { x, y: H - tableTop - 18 },
        end: { x, y: H - tableTop - 18 - TABLE_ROWS * rowH },
        thickness: 0.5,
        color: N_100,
      });
    }
  }
  for (let row = 0; row < TABLE_ROWS; row++) {
    const y = tableTop + 18 + row * rowH;
    if (row > 0) page.drawLine({ start: { x: M, y: H - y }, end: { x: W - M, y: H - y }, thickness: 0.5, color: N_100 });
    for (let col = 0; col < columns; col++) {
      const question = questions[col * TABLE_ROWS + row];
      if (question == null) continue;
      const x = M + col * pairW;
      const answer = data.answers[String(question)];
      drawText(page, String(question), x + 7, y + 11.5, { font: fonts.bold, size: 8, color: N_800 });
      drawText(page, answer ?? "-", x + pairW * 0.48, y + 11.5, {
        font: fonts.bold,
        size: 8.5,
        color: answer ? N_950 : AMBER_700,
      });
    }
  }
  top += tableH + 22;

  // Explanations: one card per question, grouped by subject.
  ensure(40);
  drawText(page, "Explanations", M, top, { font: fonts.bold, size: 11, color: N_950 });
  top += 16;

  const textW = CONTENT - 24 - 16;
  for (const range of subjects) {
    const list = questionsIn(range);
    ensure(24 + 70);
    drawText(page, `${subjectName(range.subject)} · ${list.length} questions`, M + 1, top + 8, {
      font: fonts.bold,
      size: 9.5,
      color: N_950,
    });
    top += 18;

    for (const question of list) {
      const answer = data.answers[String(question)];
      const explanation = data.explanations[String(question)]?.trim() ?? "";
      const lines = explanation ? wrap(fonts.regular, explanation, 9, textW) : [];
      const boxH = 17 + Math.max(1, lines.length) * 11;
      const cardH = 30 + boxH + 7;
      ensure(cardH);

      roundedRect(page, M, top, CONTENT, cardH, 8, { fill: WHITE, border: N_200 });
      drawText(page, `Q${question}`, M + 12, top + 20, { font: fonts.bold, size: 9.5, color: N_800 });
      const selected = keyOptions(answer);
      let x = M + 52;
      for (const option of OPTIONS) {
        const on = selected.includes(option);
        roundedRect(page, x, top + 7, 18, 18, 4, on ? { fill: BRAND_900 } : { fill: N_50, border: N_200 });
        drawText(page, option, x + 9, top + 19.5, { font: fonts.bold, size: 8.5, color: on ? WHITE : N_400, align: "center" });
        x += 22;
      }
      if (answer === "ADD") {
        roundedRect(page, x, top + 7, 30, 18, 4, { fill: SKY_700 });
        drawText(page, "ADD", x + 15, top + 19.5, { font: fonts.bold, size: 7.5, color: WHITE, align: "center" });
      } else if (!answer) {
        drawText(page, "Not set", x + 2, top + 19.5, { font: fonts.bold, size: 8, color: AMBER_700 });
      }

      const boxTop = top + 30;
      roundedRect(page, M + 12, boxTop, CONTENT - 24, boxH, 5, { fill: N_50, border: N_100 });
      drawText(page, "EXPLANATION", M + 20, boxTop + 10, { font: fonts.bold, size: 6.5, color: N_500, spacing: 0.6 });
      if (lines.length === 0) {
        drawText(page, "No Explanation", M + 20, boxTop + 21.5, { font: fonts.regular, size: 9, color: N_400 });
      } else {
        lines.forEach((line, index) => {
          drawText(page, line, M + 20, boxTop + 21.5 + index * 11, { font: fonts.regular, size: 9, color: N_700 });
        });
      }
      top += cardH + 6;
    }
    top += 8;
  }

  drawPageFooters(pages, fonts, "Vitaran Learning · Answer key");

  pdf.setTitle(`Answer key - Test ${data.testNumber} - Class ${data.classLevel}`);
  pdf.setAuthor("Vitaran Learning");
  return Buffer.from(await pdf.save());
}
