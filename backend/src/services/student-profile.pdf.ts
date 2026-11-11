import { PDFDocument, StandardFonts, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { classWithSectionLabel, displaySectionName } from "../utils/section-label.js";
import {
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
  N_100,
  N_200,
  N_400,
  N_500,
  N_800,
  N_950,
  W,
  WHITE,
  drawLogoHeader,
  drawPageFooters,
  drawText,
  embedLogo,
  fitSize,
  hex,
  roundedRect,
  truncate,
  type Fonts,
} from "./pdf-kit.js";
import type { StudentTestResult } from "./student-performance.service.js";

/** Same line colours as the portal performance chart. */
const SUBJECT_COLORS = ["#2f5bea", "#0f9f6e", "#e8622c", "#d63384", "#7048e8", "#0b93b8", "#c28a0a"].map(hex);
const TOTAL_COLOR = BRAND_900;
const EMERALD_700 = hex("#047857");
const AMBER_700 = hex("#b45309");
const RED_600 = hex("#dc2626");

export type StudentProfilePdfData = {
  student: {
    name: string;
    rollNo: string;
    status: "ACTIVE" | "INACTIVE";
    parentName: string | null;
    parentPhone: string | null;
    email: string | null;
    programName: string;
    classLevel: number;
    sectionName: string | null;
    schoolName: string;
  };
  results: StudentTestResult[];
};

export type StudentProfilePdfLogos = { vitaran: Buffer | null; school: Buffer | null };

const capitalizeWords = (value: string) =>
  value.toLowerCase().replace(/(^|[\s.'-])\S/g, (char) => char.toUpperCase());

const titleCase = (label: string) => label.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());

const round = (value: number) => String(Math.round(value * 100) / 100);
const pct = (value: number | null | undefined) => (value == null ? "-" : `${round(value)}%`);

const ordinal = (rank: number | null) => {
  if (rank == null) return "-";
  const tail = rank % 100;
  if (tail >= 11 && tail <= 13) return `${rank}th`;
  return `${rank}${["th", "st", "nd", "rd"][rank % 10] ?? "th"}`;
};

const average = (values: Array<number | null>) => {
  const filled = values.filter((value): value is number => value != null);
  return filled.length ? filled.reduce((sum, value) => sum + value, 0) / filled.length : null;
};

const tone = (percent: number | null): RGB =>
  percent == null ? N_400 : percent >= 75 ? EMERALD_700 : percent >= 50 ? AMBER_700 : RED_600;


type FieldSpec = { label: string; value: string; span?: boolean };

/** Two-column field grid inside a titled panel; returns the panel height. */
function panelHeight(fields: FieldSpec[]) {
  let rows = 0;
  let col = 0;
  for (const field of fields) {
    if (field.span && col === 1) {
      rows += 1;
      col = 0;
    }
    if (field.span || col === 1) {
      rows += 1;
      col = 0;
    } else {
      col = 1;
    }
  }
  if (col === 1) rows += 1;
  return 30 + rows * 30 + 6;
}

function drawPanel(page: PDFPage, fonts: Fonts, x: number, top: number, width: number, height: number, title: string, fields: FieldSpec[]) {
  roundedRect(page, x, top, width, height, 8, { fill: WHITE, border: BRAND_200 });
  roundedRect(page, x, top, width, 24, 8, { fill: BRAND_50 });
  page.drawRectangle({ x: x + 0.5, y: H - top - 24, width: width - 1, height: 12, color: BRAND_50 });
  page.drawLine({ start: { x, y: H - top - 24 }, end: { x: x + width, y: H - top - 24 }, thickness: 0.6, color: BRAND_100 });
  drawText(page, title, x + 12, top + 16, { font: fonts.bold, size: 9.5, color: BRAND_950 });

  const colW = (width - 24) / 2;
  let y = top + 30;
  let col = 0;
  for (const field of fields) {
    if (field.span && col === 1) {
      y += 30;
      col = 0;
    }
    const fx = x + 12 + col * colW;
    const maxW = (field.span ? width - 24 : colW) - 8;
    drawText(page, field.label.toUpperCase(), fx, y + 8, { font: fonts.bold, size: 6.2, color: N_500, spacing: 0.5 });
    drawText(page, truncate(fonts.bold, field.value || "-", 9.5, maxW), fx, y + 21, {
      font: fonts.bold,
      size: 9.5,
      color: field.value ? N_950 : N_400,
    });
    if (field.span || col === 1) {
      y += 30;
      col = 0;
    } else {
      col = 1;
    }
  }
}

type EmbeddedLogos = { vitaran: PDFImage | null; school: PDFImage | null };

/** Draws one student's profile on fresh pages of `pdf`; returns those pages. */
function drawStudentProfile(pdf: PDFDocument, fonts: Fonts, logos: EmbeddedLogos, data: StudentProfilePdfData) {
  const { vitaran, school } = logos;
  const { student, results } = data;
  const name = capitalizeWords(student.name);
  const classLabel = classWithSectionLabel(student.classLevel, student.sectionName);
  const status = student.status === "ACTIVE" ? "Active" : "Inactive";

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let top = 0;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    top = M;
  };
  const ensure = (height: number) => {
    if (top + height > H - FOOTER) {
      newPage();
      return true;
    }
    return false;
  };

  newPage();
  top = drawLogoHeader(page, fonts, { vitaran, school }, student.schoolName, "Student profile");

  // Banner, like the page header.
  {
    const bannerH = 84;
    roundedRect(page, M, top, CONTENT, bannerH, 10, { fill: BRAND_900 });
    drawText(page, "STUDENT PROFILE", M + 16, top + 18, { font: fonts.bold, size: 6.5, color: WHITE, spacing: 1.6 });
    drawText(page, truncate(fonts.bold, name, 18, CONTENT - 32), M + 16, top + 38, { font: fonts.bold, size: 18, color: WHITE });
    drawText(
      page,
      truncate(fonts.regular, `Registration no ${student.rollNo} · ${classLabel} · ${student.programName}`, 9, CONTENT - 32),
      M + 16,
      top + 52,
      { font: fonts.regular, size: 9, color: BRAND_200 },
    );
    let x = M + 16;
    for (const chip of [
      { label: "STATUS", value: status },
      { label: "REGISTRATION NO", value: student.rollNo },
      { label: "CLASS", value: classLabel },
    ]) {
      const labelW = fonts.bold.widthOfTextAtSize(chip.label, 5.8) + chip.label.length * 0.4;
      const valueW = fonts.bold.widthOfTextAtSize(chip.value, 8);
      const chipW = labelW + valueW + 22;
      roundedRect(page, x, top + 60, chipW, 16, 8, { fill: WHITE, opacity: 0.12 });
      drawText(page, chip.label, x + 8, top + 70.5, { font: fonts.bold, size: 5.8, color: BRAND_200, spacing: 0.4 });
      drawText(page, chip.value, x + 14 + labelW, top + 71, { font: fonts.bold, size: 8, color: WHITE });
      x += chipW + 6;
    }
    top += bannerH + 12;
  }

  // Details panels.
  {
    const details: FieldSpec[] = [
      { label: "Full name", value: name, span: true },
      { label: "Registration number", value: student.rollNo },
      { label: "Status", value: status },
      { label: "Parent / guardian name", value: student.parentName ? capitalizeWords(student.parentName) : "" },
      { label: "Parent mobile", value: student.parentPhone ?? "" },
      { label: "Parent / guardian email", value: student.email ?? "", span: true },
      { label: "School", value: student.schoolName, span: true },
    ];
    const program: FieldSpec[] = [
      { label: "Program", value: student.programName, span: true },
      { label: "Class", value: classLabel },
      { label: "Section", value: displaySectionName(student.sectionName) },
    ];
    const gap = 10;
    const colW = (CONTENT - gap) / 2;
    const height = Math.max(panelHeight(details), panelHeight(program));
    drawPanel(page, fonts, M, top, colW, height, "Student details", details);
    drawPanel(page, fonts, M + colW + gap, top, colW, height, "Class & program", program);
    top += height + 16;
  }

  const subjects = [...new Set(results.flatMap((test) => test.subjects.map((subject) => subject.label)))];
  const colorOf = (label: string) => SUBJECT_COLORS[subjects.indexOf(label) % SUBJECT_COLORS.length]!;

  ensure(40);
  drawText(page, "Performance", M, top + 4, { font: fonts.bold, size: 11, color: N_950 });
  top += 14;

  if (results.length === 0) {
    roundedRect(page, M, top, CONTENT, 60, 8, { fill: WHITE, border: BRAND_200 });
    drawText(page, "No test results yet", W / 2, top + 28, { font: fonts.bold, size: 10, color: N_800, align: "center" });
    drawText(page, "Performance appears here once results are saved.", W / 2, top + 42, {
      font: fonts.regular,
      size: 8.5,
      color: N_500,
      align: "center",
    });
  } else {
    // Stat cards.
    {
      const latest = results.at(-1)!;
      const previous = results.at(-2);
      const delta =
        previous?.percentage != null && latest.percentage != null ? latest.percentage - previous.percentage : null;
      const percents = results.map((test) => test.percentage);
      const filled = percents.filter((value): value is number => value != null);
      const ranks = results.map((test) => test.classRank).filter((rank): rank is number => rank != null);
      const stats: Array<{ label: string; value: string; hint?: { text: string; color: RGB } }> = [
        { label: "TESTS TAKEN", value: String(results.length) },
        { label: "AVERAGE", value: pct(average(percents)) },
        { label: "BEST SCORE", value: filled.length ? pct(Math.max(...filled)) : "-" },
        {
          label: "LATEST",
          value: pct(latest.percentage),
          hint:
            delta != null
              ? {
                  text: `${delta > 0 ? "+" : ""}${round(delta)}% vs previous`,
                  color: delta > 0 ? EMERALD_700 : delta < 0 ? RED_600 : N_500,
                }
              : ranks.length
                ? { text: `Best class rank ${ordinal(Math.min(...ranks))}`, color: N_500 }
                : undefined,
        },
      ];
      const gap = 8;
      const cardW = (CONTENT - gap * 3) / 4;
      const cardH = 50;
      stats.forEach((stat, index) => {
        const x = M + index * (cardW + gap);
        roundedRect(page, x, top, cardW, cardH, 8, { fill: WHITE, border: BRAND_200 });
        drawText(page, stat.label, x + 10, top + 14, { font: fonts.bold, size: 6.2, color: N_500, spacing: 0.6 });
        drawText(page, stat.value, x + 10, top + 32, { font: fonts.bold, size: 15, color: BRAND_950 });
        if (stat.hint) drawText(page, stat.hint.text, x + 10, top + 43, { font: fonts.bold, size: 6.8, color: stat.hint.color });
      });
      top += cardH + 10;
    }

    // Trend chart: percentage per test, one line per subject plus the total.
    {
      const chartH = 210;
      ensure(chartH);
      roundedRect(page, M, top, CONTENT, chartH, 8, { fill: WHITE, border: BRAND_200 });
      roundedRect(page, M, top, CONTENT, 34, 8, { fill: BRAND_50 });
      page.drawRectangle({ x: M + 0.5, y: H - top - 34, width: CONTENT - 1, height: 14, color: BRAND_50 });
      page.drawLine({ start: { x: M, y: H - top - 34 }, end: { x: W - M, y: H - top - 34 }, thickness: 0.6, color: BRAND_100 });
      drawText(page, "Performance trend", M + 12, top + 15, { font: fonts.bold, size: 9.5, color: BRAND_950 });
      drawText(page, "Percentage in each test", M + 12, top + 27, { font: fonts.regular, size: 7.5, color: N_500 });

      // Legend, right-aligned in the header.
      const legend = [...subjects.map((label) => ({ label: titleCase(label), color: colorOf(label) })), { label: "Total", color: TOTAL_COLOR }];
      let lx = W - M - 12;
      for (const item of [...legend].reverse()) {
        const textW = fonts.bold.widthOfTextAtSize(item.label, 7);
        const pillW = textW + 20;
        lx -= pillW;
        roundedRect(page, lx, top + 10, pillW, 14, 7, { fill: item.color });
        page.drawCircle({ x: lx + 7, y: H - top - 17, size: 2, color: WHITE, opacity: 0.9 });
        drawText(page, item.label, lx + 12, top + 19.5, { font: fonts.bold, size: 7, color: WHITE });
        lx -= 4;
      }

      const plotLeft = M + 36;
      const plotRight = W - M - 16;
      const plotTop = top + 48;
      const plotBottom = top + chartH - 26;
      const yOf = (percent: number) => plotBottom - (Math.max(0, Math.min(100, percent)) / 100) * (plotBottom - plotTop);
      for (const tick of [0, 25, 50, 75, 100]) {
        const y = yOf(tick);
        page.drawLine({
          start: { x: plotLeft, y: H - y },
          end: { x: plotRight, y: H - y },
          thickness: tick === 0 ? 0.75 : 0.5,
          color: tick === 0 ? BRAND_200 : BRAND_100,
          dashArray: tick === 0 ? undefined : [3, 3],
        });
        drawText(page, `${tick}%`, plotLeft - 6, y + 2.5, { font: fonts.regular, size: 7, color: N_500, align: "right" });
      }

      const repeated = new Set(results.map((test) => test.testNumber).filter((n, i, all) => all.indexOf(n) !== i));
      const step = results.length > 1 ? (plotRight - plotLeft - 24) / (results.length - 1) : 0;
      const xOf = (index: number) => (results.length > 1 ? plotLeft + 12 + index * step : (plotLeft + plotRight) / 2);
      const labelEvery = Math.max(1, Math.ceil(results.length / 12));
      results.forEach((test, index) => {
        if (index % labelEvery !== 0 && index !== results.length - 1) return;
        const label = repeated.has(test.testNumber) ? `T${test.testNumber} · ${test.programName}` : `Test ${test.testNumber}`;
        drawText(page, truncate(fonts.regular, label, 7, Math.max(40, step * labelEvery - 4)), xOf(index), plotBottom + 13, {
          font: fonts.regular,
          size: 7,
          color: N_500,
          align: "center",
        });
      });

      const series = [
        ...subjects.map((label) => ({
          color: colorOf(label),
          width: 1.6,
          values: results.map((test) => test.subjects.find((subject) => subject.label === label)?.percentage ?? null),
        })),
        { color: TOTAL_COLOR, width: 2.6, values: results.map((test) => test.percentage) },
      ];
      for (const line of series) {
        let prev: { x: number; y: number } | null = null;
        line.values.forEach((value, index) => {
          if (value == null) {
            prev = null;
            return;
          }
          const point = { x: xOf(index), y: yOf(value) };
          if (prev) {
            page.drawLine({
              start: { x: prev.x, y: H - prev.y },
              end: { x: point.x, y: H - point.y },
              thickness: line.width,
              color: line.color,
            });
          }
          prev = point;
        });
        line.values.forEach((value, index) => {
          if (value == null) return;
          page.drawCircle({
            x: xOf(index),
            y: H - yOf(value),
            size: line.width + 1.2,
            color: WHITE,
            borderColor: line.color,
            borderWidth: 1.4,
          });
        });
      }
      top += chartH + 16;
    }

    // All tests table, newest first like the page.
    {
      const rows = [...results].reverse();
      const fixed = [{ key: "test", label: "TEST", width: 74 }];
      const trailing = [
        { key: "total", label: "TOTAL", width: 58 },
        { key: "class", label: "CLASS RANK", width: 54 },
        { key: "section", label: "SEC. RANK", width: 50 },
      ];
      const fixedW = [...fixed, ...trailing].reduce((sum, col) => sum + col.width, 0);
      const subjectW = subjects.length ? (CONTENT - fixedW) / subjects.length : 0;
      const headH = 22;
      const rowH = 28;

      const drawTitle = () => {
        drawText(page, "All tests", M, top + 4, { font: fonts.bold, size: 11, color: N_950 });
        drawText(page, `${results.length} ${results.length === 1 ? "test" : "tests"} · newest first`, W - M, top + 4, {
          font: fonts.regular,
          size: 8,
          color: N_500,
          align: "right",
        });
        top += 12;
      };
      const drawHead = () => {
        roundedRect(page, M, top, CONTENT, headH, 6, { fill: BRAND_50, border: BRAND_200 });
        let x = M;
        const head = (label: string, width: number, align: "left" | "center" = "center") => {
          const size = fitSize(fonts.bold, label, width - 6 - label.length * 0.4, 6.2, 5);
          const text = truncate(fonts.bold, label, size, width - 6);
          drawText(page, text, align === "left" ? x + 8 : x + width / 2, top + 14, {
            font: fonts.bold,
            size,
            color: BRAND_700,
            align,
            spacing: 0.3,
          });
          x += width;
        };
        head("TEST", fixed[0]!.width, "left");
        for (const subject of subjects) head(subject.toUpperCase(), subjectW);
        for (const col of trailing) head(col.label, col.width);
        top += headH;
      };

      ensure(12 + headH + rowH);
      drawTitle();
      drawHead();

      rows.forEach((test, index) => {
        if (ensure(rowH)) drawHead();
        if (index % 2 === 1) page.drawRectangle({ x: M + 0.5, y: H - top - rowH, width: CONTENT - 1, height: rowH, color: hex("#fbfbfd") });
        page.drawLine({ start: { x: M, y: H - top - rowH }, end: { x: W - M, y: H - top - rowH }, thickness: 0.5, color: N_100 });

        let x = M;
        drawText(page, `Test ${test.testNumber}`, x + 8, top + 12, { font: fonts.bold, size: 8.5, color: N_950 });
        drawText(page, truncate(fonts.regular, test.testId ? `ID ${test.testId}` : test.programName, 6.8, fixed[0]!.width - 12), x + 8, top + 22, {
          font: fonts.regular,
          size: 6.8,
          color: N_500,
        });
        x += fixed[0]!.width;

        for (const label of subjects) {
          const subject = test.subjects.find((entry) => entry.label === label);
          const cx = x + subjectW / 2;
          if (subject?.marks != null) {
            const value = subject.max ? `${round(subject.marks)}/${round(subject.max)}` : round(subject.marks);
            drawText(page, value, cx, top + 12, { font: fonts.bold, size: 8, color: N_950, align: "center" });
            drawText(page, pct(subject.percentage), cx, top + 22, {
              font: fonts.bold,
              size: 6.8,
              color: tone(subject.percentage),
              align: "center",
            });
          } else {
            drawText(page, "-", cx, top + 17, { font: fonts.regular, size: 8, color: N_400, align: "center" });
          }
          x += subjectW;
        }

        const total = test.total != null ? (test.totalMax ? `${round(test.total)}/${round(test.totalMax)}` : round(test.total)) : "-";
        drawText(page, total, x + trailing[0]!.width / 2, top + 12, { font: fonts.bold, size: 8.5, color: N_950, align: "center" });
        drawText(page, pct(test.percentage), x + trailing[0]!.width / 2, top + 22, {
          font: fonts.bold,
          size: 6.8,
          color: tone(test.percentage),
          align: "center",
        });
        x += trailing[0]!.width;
        for (const [rank, width] of [
          [test.classRank, trailing[1]!.width],
          [test.sectionRank, trailing[2]!.width],
        ] as const) {
          const cx = x + width / 2;
          if (rank != null) {
            const text = ordinal(rank);
            const pillW = fonts.bold.widthOfTextAtSize(text, 7.5) + 12;
            const top3 = rank <= 3;
            roundedRect(page, cx - pillW / 2, top + 8, pillW, 14, 7, top3 ? { fill: BRAND_900 } : { fill: BRAND_50, border: BRAND_200 });
            drawText(page, text, cx, top + 17.5, { font: fonts.bold, size: 7.5, color: top3 ? WHITE : BRAND_900, align: "center" });
          } else {
            drawText(page, "-", cx, top + 17, { font: fonts.regular, size: 8, color: N_400, align: "center" });
          }
          x += width;
        }
        top += rowH;
      });

      page.drawLine({ start: { x: M, y: H - top }, end: { x: W - M, y: H - top }, thickness: 0.6, color: N_200 });
    }
  }

  drawPageFooters(pages, fonts, `Vitaran Learning · Student profile · ${name} (${student.rollNo})`);
  return pages;
}

async function createDocument() {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  pdf.setAuthor("Vitaran Learning");
  return { pdf, fonts };
}

export async function renderStudentProfilePdf(data: StudentProfilePdfData, logos: StudentProfilePdfLogos) {
  const { pdf, fonts } = await createDocument();
  const [vitaran, school] = await Promise.all([embedLogo(pdf, logos.vitaran), embedLogo(pdf, logos.school)]);
  drawStudentProfile(pdf, fonts, { vitaran, school }, data);
  pdf.setTitle(`Student profile - ${capitalizeWords(data.student.name)} - ${data.student.rollNo}`);
  return Buffer.from(await pdf.save());
}

/** Several profiles in one file (e.g. a whole class); each student starts on a new page. */
export async function renderStudentProfilesPdf(
  entries: Array<{ data: StudentProfilePdfData; schoolId: string }>,
  logos: { vitaran: Buffer | null; schools: Map<string, Buffer | null> },
  title: string,
) {
  const { pdf, fonts } = await createDocument();
  const vitaran = await embedLogo(pdf, logos.vitaran);
  const crests = new Map<string, PDFImage | null>();
  for (const [schoolId, logo] of logos.schools) crests.set(schoolId, await embedLogo(pdf, logo));
  for (const entry of entries) {
    drawStudentProfile(pdf, fonts, { vitaran, school: crests.get(entry.schoolId) ?? null }, entry.data);
  }
  pdf.setTitle(title);
  return Buffer.from(await pdf.save());
}
