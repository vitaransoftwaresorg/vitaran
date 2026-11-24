import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import opentype, { type Font } from "opentype.js";
import { PDFDocument } from "pdf-lib";
import sharp, { type OverlayOptions } from "sharp";

/** A4 at 150 dpi. */
const W = 1240;
const H = 1754;
/** Fallback only when the bundled font fails to load. */
const FALLBACK_FONT = "DejaVu Sans, Liberation Sans, Arial, sans-serif";

const NAVY = "#141a52";
const INK = "#1c2033";
const MUTED = "#7a7f99";
const GOLD = "#c9a227";
const GOLD_DARK = "#8a6a10";
const SUBJECT_COLORS = ["#2f5bea", "#0f9f6e", "#e8622c", "#d63384", "#7048e8", "#0b93b8", "#c28a0a"];

/** Set for the duration of one cardSvg() call so every label uses glyph outlines. */
let paintFont: Font | null = null;

export type RankCardSubject = {
  label: string;
  marks: number | null;
  max: number | null;
  right?: number;
  wrong?: number;
  blank?: number;
};

export type RankCardData = {
  schoolName: string;
  programName: string;
  testNumber: number;
  /** Shown on the class result PDF, not on the rank card. */
  testId: string;
  student: { name: string; rollNo: string; classLabel: string };
  /** Subjects the student took — omitted subjects are not printed on the card. */
  subjects: RankCardSubject[];
  /** Marks aligned to the class paper subject list (null = not taken); class result PDF. */
  paperMarks?: Array<number | null>;
  total: number | null;
  totalMax: number | null;
  percentage: number | null;
  classRank: number | null;
  sectionRank: number | null;
};

export type RankCardLogos = { vitaran: Buffer | null; school: Buffer | null };

export type YearReportTest = {
  testNumber: number;
  testId: string | null;
  subjects: Array<{ label: string; marks: number | null; max: number | null; percentage: number | null }>;
  total: number | null;
  totalMax: number | null;
  percentage: number | null;
  classRank: number | null;
  sectionRank: number | null;
};

export type YearReportCardData = {
  schoolName: string;
  programName: string;
  student: { name: string; rollNo: string; classLabel: string };
  tests: YearReportTest[];
};

export type SubjectReportCardData = {
  schoolName: string;
  programName: string;
  student: { name: string; rollNo: string; classLabel: string };
  tests: Array<{ testNumber: number }>;
  subjects: Array<{
    label: string;
    scores: Array<{ marks: number | null; max: number | null; percentage: number | null }>;
    average: number | null;
  }>;
  overallAverage: number | null;
  /** When set, card is for one subject only. */
  focusSubject?: string;
};

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fit = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}...` : value);

/** Trim with an ellipsis so glyph text stays inside `maxWidth`. */
function fitToWidth(font: Font | null, value: string, size: number, maxWidth: number, spacingPx = 0) {
  if (measureText(font, value, size, spacingPx) <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && measureText(font, `${cut}...`, size, spacingPx) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}...`;
}

const num = (value: number | null | undefined, digits = 2) =>
  value == null ? "-" : String(Math.round(value * 10 ** digits) / 10 ** digits);

/** Cinzel may lack fancy punctuation — keep printable glyphs only. */
const forFont = (value: string) =>
  value
    .replace(/[—–]/g, "-")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u201C/g, '"');

const ordinalSuffix = (rank: number) => {
  const tail = rank % 100;
  if (tail >= 11 && tail <= 13) return "th";
  return ["th", "st", "nd", "rd"][rank % 10] ?? "th";
};

/** Call sites use SVG pixel letter-spacing; opentype expects em fractions. */
function trackingEm(spacingPx: number | undefined, size: number) {
  if (!spacingPx || size <= 0) return 0;
  return spacingPx / size;
}

function measureText(font: Font | null, value: string, size: number, spacingPx = 0) {
  if (font) return font.getAdvanceWidth(value, size, { letterSpacing: trackingEm(spacingPx, size) });
  return value.length * size * 0.55 + Math.max(0, value.length - 1) * spacingPx;
}

/** Word-wrap a sentence so path text stays inside the remark card. */
function wrapLines(font: Font | null, value: string, size: number, maxWidth: number) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [] as string[];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && measureText(font, next, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Rank number with a raised, smaller "st / nd / rd / th". */
function rankText(x: number, y: number, rank: number | null, size: number, options: TextOptions = {}) {
  if (rank == null) return text(x, y, "-", size, options);
  const value = String(Math.round(rank));
  const suffix = ordinalSuffix(Math.round(rank));
  const suffixSize = Math.round(size * 0.42);
  if (paintFont) {
    const tracking = trackingEm(options.spacing, size);
    const valueWidth = paintFont.getAdvanceWidth(value, size, { letterSpacing: tracking });
    const suffixWidth = paintFont.getAdvanceWidth(suffix, suffixSize, { letterSpacing: tracking });
    const gap = Math.round(size * 0.04);
    const total = valueWidth + gap + suffixWidth;
    const anchor = options.anchor ?? "middle";
    const startX = anchor === "middle" ? x - total / 2 : anchor === "end" ? x - total : x;
    const color = options.color ?? INK;
    const opacity = options.opacity != null ? ` fill-opacity="${options.opacity}"` : "";
    const valuePath = paintFont.getPath(value, startX, y, size, { letterSpacing: tracking }).toPathData(2);
    const suffixPath = paintFont
      .getPath(suffix, startX + valueWidth + gap, y - Math.round(size * 0.46), suffixSize, { letterSpacing: tracking })
      .toPathData(2);
    return `<path d="${valuePath}" fill="${color}"${opacity}/><path d="${suffixPath}" fill="${color}"${opacity}/>`;
  }
  return `<text x="${x}" y="${y}" font-family="${FALLBACK_FONT}" font-size="${size}" font-weight="${options.weight ?? 700}" fill="${options.color ?? INK}" text-anchor="${options.anchor ?? "middle"}">${value}<tspan font-size="${suffixSize}" font-weight="800" dx="${Math.round(size * 0.04)}" dy="${-Math.round(size * 0.46)}">${suffix}</tspan></text>`;
}

/** Gold, silver and bronze for the top three. */
const MEDALS: Record<number, { face: string; rim: string; label: string; ink: string }> = {
  1: { face: "url(#gold)", rim: "#a47912", label: "#5a3e00", ink: "#3a2700" },
  2: { face: "url(#silver)", rim: "#7d8494", label: "#3d4352", ink: "#262a35" },
  3: { face: "url(#bronze)", rim: "#7a4a22", label: "#4a2a0e", ink: "#331c08" },
};

function remark(percent: number | null) {
  if (percent == null) return "Result pending.";
  if (percent >= 90) return "Outstanding performance! A brilliant example — keep shining.";
  if (percent >= 80) return "Excellent work! Your hard work is clearly paying off.";
  if (percent >= 70) return "Very good! A little more practice will take you to the top.";
  if (percent >= 60) return "Good job! Keep building on your strengths every day.";
  if (percent >= 50) return "Nice effort! Steady revision will help you score even higher.";
  if (percent >= 35) return "You're making progress! Daily practice will build your confidence.";
  return "Every step counts! With focus and support, you'll do better next time.";
}

type TextOptions = {
  color?: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  spacing?: number;
  opacity?: number;
  /** Kept for call-site compatibility; path text uses the bundled Cinzel font. */
  font?: string;
  italic?: boolean;
};

/**
 * Draw label text as glyph outlines from the bundled font so Sharp prints every detail
 * on hosts without Helvetica/Georgia (e.g. the production VPS).
 */
function text(x: number, y: number, value: string, size: number, options: TextOptions = {}) {
  const label = forFont(value);
  if (paintFont) {
    const tracking = trackingEm(options.spacing, size);
    const width = paintFont.getAdvanceWidth(label, size, { letterSpacing: tracking });
    const anchor = options.anchor ?? "start";
    const startX = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
    const color = options.color ?? INK;
    const opacity = options.opacity != null ? ` fill-opacity="${options.opacity}"` : "";
    return `<path d="${paintFont.getPath(label, startX, y, size, { letterSpacing: tracking }).toPathData(2)}" fill="${color}"${opacity}/>`;
  }
  return `<text x="${x}" y="${y}" font-family="${FALLBACK_FONT}" font-size="${size}" font-weight="${options.weight ?? 400}"${options.italic ? ' font-style="italic"' : ""} fill="${options.color ?? INK}" text-anchor="${options.anchor ?? "start"}"${options.spacing ? ` letter-spacing="${options.spacing}"` : ""}${options.opacity != null ? ` fill-opacity="${options.opacity}"` : ""}>${esc(label)}</text>`;
}

function initials(name: string) {
  const words = name
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return (words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? "S").slice(0, 2)).toUpperCase();
}

/** School name sized to sit between the two logos (about 620px): shrink, then wrap onto two lines. */
function schoolNameLines(name: string) {
  if (name.length <= 20) return { lines: [name], size: 40, top: 116 };
  if (name.length <= 26) return { lines: [name], size: 33, top: 114 };
  const words = name.split(/\s+/);
  const lines: string[] = [""];
  for (const word of words) {
    const current = lines[lines.length - 1]!;
    if (current && `${current} ${word}`.length > 28 && lines.length < 2) lines.push(word);
    else lines[lines.length - 1] = current ? `${current} ${word}` : word;
  }
  return { lines: lines.map((line) => fit(line, 30)), size: 29, top: 94 };
}

/** Room for the school name between the two header logos. */
const TITLE_WIDTH = 620;
const TITLE_TRACKING = 0.06;

function titleWidth(font: Font, value: string, size: number) {
  return font.getAdvanceWidth(value, size, { letterSpacing: TITLE_TRACKING });
}

/** Two lines split where they come out closest in width. */
function balancedLines(font: Font, value: string) {
  const words = value.split(/\s+/);
  let best: [string, string] = [value, ""];
  let bestGap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const pair: [string, string] = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const gap = Math.abs(titleWidth(font, pair[0], 10) - titleWidth(font, pair[1], 10));
    if (gap < bestGap) [best, bestGap] = [pair, gap];
  }
  return best;
}

/**
 * School name drawn as outlines from the bundled Cinzel font, so it looks the same on any server:
 * as large as fits on one line, else two balanced lines.
 */
function schoolTitle(font: Font, name: string) {
  const path = (value: string, size: number, baseline: number) => {
    const x = W / 2 - titleWidth(font, value, size) / 2;
    return `<path d="${font.getPath(value, x, baseline, size, { letterSpacing: TITLE_TRACKING }).toPathData(2)}" fill="${NAVY}"/>`;
  };
  for (let size = 50; size >= 34; size -= 1) {
    if (titleWidth(font, name, size) <= TITLE_WIDTH) {
      return [
        path(name, size, 118),
        `<line x1="${W / 2 - 90}" y1="140" x2="${W / 2 - 14}" y2="140" stroke="${GOLD}" stroke-width="2"/>`,
        diamond(W / 2, 140, 6),
        `<line x1="${W / 2 + 14}" y1="140" x2="${W / 2 + 90}" y2="140" stroke="${GOLD}" stroke-width="2"/>`,
      ].join("");
    }
  }
  const lines = balancedLines(font, name).filter(Boolean);
  let size = 34;
  while (size > 22 && lines.some((line) => titleWidth(font, line, size) > TITLE_WIDTH)) size -= 1;
  return lines.map((line, index) => path(fitWidth(font, line, size), size, 98 + index * (size + 8))).join("");
}

/** Last resort for one very long word: trim with an ellipsis. */
function fitWidth(font: Font, value: string, size: number) {
  if (titleWidth(font, value, size) <= TITLE_WIDTH) return value;
  let cut = value;
  while (cut.length > 1 && titleWidth(font, `${cut}...`, size) > TITLE_WIDTH) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}...`;
}

/** Small gold diamond used as an ornament before section titles. */
const diamond = (x: number, y: number, r: number) =>
  `<path d="M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z" fill="url(#gold)"/>`;

function sectionTitle(y: number, label: string) {
  const size = 22;
  const spacing = 3;
  // Leave room for the diamond + a short rule; never let the rule cut the title glyphs.
  const title = fitToWidth(paintFont, label, size, W - 300, spacing);
  const titleW = measureText(paintFont, title, size, spacing);
  const lineStart = 100 + titleW + 36;
  const parts = [
    diamond(78, y - 8, 9),
    text(100, y, title, size, { color: NAVY, weight: 800, spacing }),
  ];
  if (lineStart < W - 110) {
    parts.push(
      `<line x1="${lineStart}" y1="${y - 8}" x2="${W - 64}" y2="${y - 8}" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="2"/>`,
    );
  }
  return parts.join("");
}

function chartAxisLabel(label: string) {
  const key = label.trim().toUpperCase();
  const known: Record<string, string> = {
    MATHEMATICS: "MATHS",
    MATHS: "MATHS",
    MATH: "MATH",
    SCIENCE: "SCI",
    ENGLISH: "ENG",
    SOCIAL: "SOC",
    "SOCIAL STUDIES": "SST",
    TELUGU: "TEL",
    HINDI: "HIN",
    PHYSICS: "PHY",
    CHEMISTRY: "CHE",
    BIOLOGY: "BIO",
  };
  return known[key] ?? (key.length <= 6 ? key : `${key.slice(0, 5)}`);
}

/** Simple bar chart for subject / test percentages. */
function percentBarChart(
  x: number,
  y: number,
  w: number,
  h: number,
  points: Array<{ label: string; value: number | null; color: string }>,
) {
  const parts: string[] = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="#ffffff" stroke="#ece4c9" stroke-width="1.5"/>`,
  ];
  if (!points.length) {
    parts.push(text(x + w / 2, y + h / 2, "No scores yet", 18, { color: MUTED, anchor: "middle" }));
    return parts.join("");
  }
  const padL = 54;
  const padR = 28;
  const padT = 28;
  const padB = 56;
  const chartX = x + padL;
  const chartY = y + padT;
  const chartW = w - padL - padR;
  const chartH = Math.max(40, h - padT - padB);
  parts.push(`<line x1="${chartX}" y1="${chartY}" x2="${chartX}" y2="${chartY + chartH}" stroke="#d9d2b8" stroke-width="1.5"/>`);
  parts.push(`<line x1="${chartX}" y1="${chartY + chartH}" x2="${chartX + chartW}" y2="${chartY + chartH}" stroke="#d9d2b8" stroke-width="1.5"/>`);
  for (const pct of [25, 50, 75, 100]) {
    const gy = chartY + chartH - (pct / 100) * chartH;
    parts.push(`<line x1="${chartX}" y1="${gy}" x2="${chartX + chartW}" y2="${gy}" stroke="#efe9d6" stroke-width="1"/>`);
    parts.push(text(chartX - 10, gy + 5, String(pct), 12, { color: MUTED, anchor: "end" }));
  }
  const gap = Math.max(8, Math.min(18, chartW / (points.length * 3)));
  const barW = Math.max(14, Math.min(56, (chartW - gap * (points.length + 1)) / points.length));
  const span = points.length * barW + (points.length - 1) * gap;
  const startX = chartX + Math.max(gap, (chartW - span) / 2);
  points.forEach((point, index) => {
    const value = Math.max(0, Math.min(100, point.value ?? 0));
    const barH = point.value == null ? 0 : (value / 100) * chartH;
    const bx = startX + index * (barW + gap);
    const by = chartY + chartH - barH;
    parts.push(`<rect x="${bx}" y="${chartY}" width="${barW}" height="${chartH}" rx="8" fill="#f6f1e2"/>`);
    if (barH > 0) {
      parts.push(`<rect x="${bx}" y="${by}" width="${barW}" height="${barH}" rx="8" fill="${point.color}"/>`);
      if (barH > 22) {
        parts.push(
          text(bx + barW / 2, by + 18, `${Math.round(value)}%`, 13, {
            color: "#ffffff",
            weight: 800,
            anchor: "middle",
          }),
        );
      } else {
        parts.push(
          text(bx + barW / 2, by - 8, point.value == null ? "-" : `${Math.round(value)}%`, 13, {
            color: INK,
            weight: 700,
            anchor: "middle",
          }),
        );
      }
    } else {
      parts.push(text(bx + barW / 2, chartY + chartH - 10, "-", 14, { color: MUTED, anchor: "middle" }));
    }
    parts.push(
      text(bx + barW / 2, chartY + chartH + 28, fitToWidth(paintFont, point.label, 13, barW + gap), 13, {
        color: MUTED,
        weight: 700,
        anchor: "middle",
      }),
    );
  });
  return parts.join("");
}

function statCard(x: number, y: number, w: number, h: number, body: string) {
  return [
    `<rect x="${x}" y="${y + 8}" width="${w}" height="${h}" rx="24" fill="#0b0f33" fill-opacity="0.12"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="url(#navy)"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="url(#lines)"/>`,
    `<rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="22.5" fill="none" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="1.5"/>`,
    `<rect x="${x + w / 2 - 34}" y="${y}" width="68" height="5" rx="2.5" fill="url(#gold)"/>`,
    body,
  ].join("");
}

function cardSvg(data: RankCardData, schoolBadge: boolean, titleFont: Font | null) {
  const previousFont = paintFont;
  paintFont = titleFont;
  try {
    return buildCardSvg(data, schoolBadge, titleFont);
  } finally {
    paintFont = previousFont;
  }
}

function buildCardSvg(data: RankCardData, schoolBadge: boolean, titleFont: Font | null) {
  const hasOmr = data.subjects.some((row) => row.right != null);
  const parts: string[] = [];

  parts.push(`<defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe9a6"/><stop offset="0.5" stop-color="#d9ad38"/><stop offset="1" stop-color="#a47912"/></linearGradient>
    <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f8fb"/><stop offset="0.5" stop-color="#c3c8d3"/><stop offset="1" stop-color="#8d94a3"/></linearGradient>
    <linearGradient id="bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cfa5"/><stop offset="0.5" stop-color="#c7834a"/><stop offset="1" stop-color="#8a5328"/></linearGradient>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1bd"/><stop offset="1" stop-color="#e0b23e"/></linearGradient>
    <linearGradient id="navy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#232a78"/><stop offset="1" stop-color="#0d1140"/></linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d1140"/><stop offset="0.5" stop-color="#232a78"/><stop offset="1" stop-color="#0d1140"/></linearGradient>
    <linearGradient id="ribbonL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3290"/><stop offset="1" stop-color="#121752"/></linearGradient>
    <linearGradient id="ribbonR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3261e"/><stop offset="1" stop-color="#6e120d"/></linearGradient>
    <pattern id="lines" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="22" stroke="#ffffff" stroke-opacity="0.045" stroke-width="8"/></pattern>
  </defs>`);

  // Ivory page with a double gold frame.
  parts.push(`<rect width="${W}" height="${H}" fill="#f6f2e7"/>`);
  parts.push(`<rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="30" fill="#fffdf8" stroke="url(#gold)" stroke-width="4"/>`);
  parts.push(`<rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="22" fill="none" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="1.5"/>`);

  // Header: Vitaran logo left, school logo (or initials badge) right, school name centred.
  if (titleFont) {
    parts.push(schoolTitle(titleFont, data.schoolName.toUpperCase()));
  } else {
    const name = schoolNameLines(data.schoolName.toUpperCase());
    name.lines.forEach((line, index) => {
      parts.push(text(W / 2, name.top + index * (name.size + 6), line, name.size, { color: NAVY, weight: 800, anchor: "middle", spacing: 1.5 }));
    });
  }
  // e.g. "New advanced Test -1" — program + test number in the header.
  const programLabel = data.programName.trim();
  const testLabel =
    data.testNumber > 0
      ? programLabel
        ? `${fit(programLabel, 36)} Test -${data.testNumber}`
        : `Test ${data.testNumber}`
      : fit(programLabel, 44);
  parts.push(text(W / 2, 176, testLabel, 23, { color: MUTED, weight: 600, anchor: "middle", spacing: 1 }));
  if (schoolBadge) {
    const cx = W - 140;
    parts.push(`<circle cx="${cx}" cy="122" r="62" fill="url(#navy)" stroke="url(#gold)" stroke-width="4"/>`);
    parts.push(`<circle cx="${cx}" cy="122" r="51" fill="none" stroke="${GOLD}" stroke-opacity="0.6" stroke-width="1.5"/>`);
    parts.push(text(cx, 138, initials(data.schoolName), 44, { color: "url(#goldText)", weight: 800, anchor: "middle" }));
  }

  // Title band.
  const bandY = 214;
  parts.push(`<rect x="40" y="${bandY}" width="${W - 80}" height="136" fill="url(#band)"/>`);
  parts.push(`<rect x="40" y="${bandY}" width="${W - 80}" height="136" fill="url(#lines)"/>`);
  parts.push(`<line x1="40" y1="${bandY + 8}" x2="${W - 40}" y2="${bandY + 8}" stroke="url(#gold)" stroke-width="2"/>`);
  parts.push(`<line x1="40" y1="${bandY + 128}" x2="${W - 40}" y2="${bandY + 128}" stroke="url(#gold)" stroke-width="2"/>`);
  parts.push(diamond(300, bandY + 64, 8), diamond(W - 300, bandY + 64, 8));
  parts.push(text(W / 2, bandY + 89, "REPORT CARD", 60, { color: "url(#goldText)", weight: 700, anchor: "middle", spacing: 14 }));

  // Student hero; the class-rank medal is only for the top three.
  const heroY = 386;
  const heroH = 236;
  parts.push(`<rect x="64" y="${heroY}" width="${W - 128}" height="${heroH}" rx="26" fill="#ffffff" stroke="#e8dcb4" stroke-width="2"/>`);
  parts.push(text(100, heroY + 50, "STUDENT", 17, { color: GOLD_DARK, weight: 800, spacing: 5 }));
  parts.push(text(100, heroY + 108, fit(data.student.name.toUpperCase(), 24), 50, { color: NAVY, weight: 700 }));
  parts.push(`<rect x="100" y="${heroY + 124}" width="110" height="4" rx="2" fill="url(#gold)"/>`);
  const chips: Array<[string, string]> = [
    ["REG. NO", data.student.rollNo || "-"],
    ["CLASS", data.student.classLabel || "-"],
  ];
  chips.forEach(([label, value], index) => {
    const x = 100 + index * 228;
    parts.push(`<rect x="${x}" y="${heroY + 148}" width="212" height="64" rx="14" fill="#f8f4e8" stroke="#ece2c2" stroke-width="1.5"/>`);
    parts.push(text(x + 18, heroY + 172, label, 15, { color: MUTED, weight: 700, spacing: 2.5 }));
    parts.push(text(x + 18, heroY + 202, value, 25, { color: INK, weight: 800 }));
  });

  const medal = data.classRank != null ? MEDALS[Math.round(data.classRank)] : undefined;
  if (medal) {
    const mx = W - 220;
    const my = heroY + 112;
    parts.push(`<path d="M${mx - 60} ${my + 52} L${mx - 84} ${my + 138} L${mx - 60} ${my + 126} L${mx - 44} ${my + 148} L${mx - 14} ${my + 72} Z" fill="url(#ribbonL)"/>`);
    parts.push(`<path d="M${mx + 60} ${my + 52} L${mx + 84} ${my + 138} L${mx + 60} ${my + 126} L${mx + 44} ${my + 148} L${mx + 14} ${my + 72} Z" fill="url(#ribbonR)"/>`);
    parts.push(`<circle cx="${mx}" cy="${my + 6}" r="104" fill="#000000" fill-opacity="0.12"/>`);
    parts.push(`<circle cx="${mx}" cy="${my}" r="104" fill="${medal.face}" stroke="${medal.rim}" stroke-width="3"/>`);
    parts.push(`<circle cx="${mx}" cy="${my}" r="88" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.5" stroke-dasharray="3 7"/>`);
    parts.push(`<circle cx="${mx}" cy="${my}" r="76" fill="#ffffff" fill-opacity="0.18"/>`);
    parts.push(text(mx, my - 34, "CLASS RANK", 16, { color: medal.label, weight: 800, anchor: "middle", spacing: 3 }));
    parts.push(rankText(mx - 6, my + 46, data.classRank, 76, { color: medal.ink }));
  }

  // Stat cards.
  const statY = 664;
  const statH = 196;
  const gap = 22;
  const statW = (W - 128 - gap * 3) / 4;
  const statX = (index: number) => 64 + index * (statW + gap);
  const label = (x: number, y: number, value: string) =>
    text(x + statW / 2, y + 44, value, 17, { color: "#f1d980", weight: 800, anchor: "middle", spacing: 3 });

  parts.push(
    statCard(statX(0), statY, statW, statH, [
      label(statX(0), statY, "TOTAL MARKS"),
      text(statX(0) + statW / 2, statY + 124, num(data.total), 60, { color: "#ffffff", weight: 800, anchor: "middle" }),
      text(statX(0) + statW / 2, statY + 164, data.totalMax ? `out of ${num(data.totalMax)}` : "marks scored", 20, { color: "#c3c8f2", anchor: "middle" }),
    ].join("")),
  );

  const share = data.percentage == null ? 0 : Math.max(0, Math.min(1, data.percentage / 100));
  const ringX = statX(1) + statW / 2;
  const ringY = statY + 120;
  const ringR = 52;
  const circumference = 2 * Math.PI * ringR;
  parts.push(
    statCard(statX(1), statY, statW, statH, [
      label(statX(1), statY, "PERCENTAGE"),
      `<circle cx="${ringX}" cy="${ringY}" r="${ringR}" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="12"/>`,
      share > 0
        ? `<circle cx="${ringX}" cy="${ringY}" r="${ringR}" fill="none" stroke="url(#gold)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${circumference * share} ${circumference}" transform="rotate(-90 ${ringX} ${ringY})"/>`
        : "",
      text(ringX, ringY + 11, data.percentage == null ? "-" : `${Math.round(data.percentage)}%`, 32, { color: "#ffffff", weight: 800, anchor: "middle" }),
    ].join("")),
  );

  parts.push(
    statCard(statX(2), statY, statW, statH, [
      label(statX(2), statY, "SECTION RANK"),
      rankText(statX(2) + statW / 2, statY + 126, data.sectionRank, 62, { color: "#ffffff" }),
      text(statX(2) + statW / 2, statY + 164, `Class ${data.student.classLabel}`, 20, { color: "#c3c8f2", anchor: "middle" }),
    ].join("")),
  );

  parts.push(
    statCard(statX(3), statY, statW, statH, [
      label(statX(3), statY, "CLASS RANK"),
      rankText(statX(3) + statW / 2, statY + 126, data.classRank, 62, { color: "url(#goldText)" }),
      text(statX(3) + statW / 2, statY + 164, "All sections", 20, { color: "#c3c8f2", anchor: "middle", weight: 600 }),
    ].join("")),
  );

  // Subjects.
  const subjectsY = 924;
  parts.push(sectionTitle(subjectsY, "SUBJECT-WISE PERFORMANCE"));
  const cols = hasOmr
    ? { name: 150, marks: 500, bar: 610, barW: 230, right: 966, wrong: 1046, blank: 1126 }
    : { name: 150, marks: 560, bar: 700, barW: 400, right: 0, wrong: 0, blank: 0 };
  const headY = subjectsY + 44;
  const head = (x: number, value: string, anchor: "start" | "middle" = "start") =>
    text(x, headY, value, 15, { color: MUTED, weight: 800, anchor, spacing: 2.5 });
  parts.push(head(cols.name, "SUBJECT"), head(cols.marks, "MARKS", "middle"), head(cols.bar, "SCORE"));
  if (hasOmr) parts.push(head(cols.right, "RIGHT", "middle"), head(cols.wrong, "WRONG", "middle"), head(cols.blank, "BLANK", "middle"));

  const rowCount = Math.max(1, data.subjects.length);
  const rowGap = rowCount > 6 ? 6 : 12;
  const rowH = Math.min(70, Math.floor(360 / rowCount) - rowGap);
  const rowFont = Math.min(25, Math.round(rowH * 0.6));
  const chipH = Math.min(40, rowH - 6);
  const chipFont = Math.min(22, Math.round(chipH * 0.55));
  const iconR = Math.max(10, Math.min(22, rowH / 2 - 6));
  const rowsTop = headY + 18;
  data.subjects.forEach((row, index) => {
    const y = rowsTop + index * (rowH + rowGap);
    const mid = y + rowH / 2;
    const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length]!;
    parts.push(`<rect x="64" y="${y}" width="${W - 128}" height="${rowH}" rx="16" fill="#ffffff" stroke="#ece4c9" stroke-width="1.5"/>`);
    parts.push(`<circle cx="104" cy="${mid}" r="${iconR}" fill="${color}"/>`);
    parts.push(text(104, mid + iconR * 0.36, row.label.slice(0, 1), Math.round(iconR),  { color: "#ffffff", weight: 800, anchor: "middle" }));
    parts.push(text(cols.name, mid + rowFont * 0.36, fit(row.label, 16), rowFont, { color: INK, weight: 800, spacing: 0.5 }));
    parts.push(
      text(cols.marks, mid + rowFont * 0.36, `${num(row.marks)}${row.max ? ` / ${num(row.max)}` : ""}`, rowFont, {
        color: INK,
        weight: 700,
        anchor: "middle",
      }),
    );
    const part = row.marks != null && row.max ? Math.max(0, Math.min(1, row.marks / row.max)) : 0;
    parts.push(`<rect x="${cols.bar}" y="${mid - 9}" width="${cols.barW}" height="18" rx="9" fill="#efeadb"/>`);
    if (part > 0) {
      parts.push(`<rect x="${cols.bar}" y="${mid - 9}" width="${Math.max(18, cols.barW * part)}" height="18" rx="9" fill="${color}"/>`);
    }
    if (row.max && row.marks != null) {
      parts.push(text(cols.bar + cols.barW + 14, mid + 7, `${Math.round(part * 100)}%`, 20, { color, weight: 800 }));
    }
    if (hasOmr) {
      const chip = (x: number, value: number | undefined, fill: string, ink: string) => {
        parts.push(`<rect x="${x - 30}" y="${mid - chipH / 2}" width="60" height="${chipH}" rx="12" fill="${fill}"/>`);
        parts.push(text(x, mid + chipFont * 0.36, value == null ? "-" : String(value), chipFont, { color: ink, weight: 800, anchor: "middle" }));
      };
      chip(cols.right, row.right, "#e3f6ea", "#16794a");
      chip(cols.wrong, row.wrong, "#fde8e6", "#b42318");
      chip(cols.blank, row.blank, "#f1f1ee", "#5b6070");
    }
  });

  // Total summary under the table — separate from subject rows.
  const subjectsEnd = rowsTop + data.subjects.length * (rowH + rowGap) - rowGap;
  const totalTop = subjectsEnd + 28;
  const totalH = 56;
  const totalMid = totalTop + totalH / 2;
  parts.push(`<rect x="64" y="${totalTop}" width="${W - 128}" height="${totalH}" rx="14" fill="#f8f4e8" stroke="#ece2c2" stroke-width="1.5"/>`);
  parts.push(text(100, totalMid + 10, "TOTAL", 18, { color: GOLD_DARK, weight: 800, spacing: 4 }));
  parts.push(
    text(W - 100, totalMid + 12, `${num(data.total)}${data.totalMax ? ` / ${num(data.totalMax)}` : ""}`, 34, {
      color: NAVY,
      weight: 700,
      anchor: "end",
    }),
  );
  const rowsEnd = totalTop + totalH;

  // Remark — wrap so the sentence stays inside the card (no right-edge overflow).
  const remarkCopy = remark(data.percentage);
  const remarkSize = 22;
  const remarkLeft = 166;
  const remarkMaxW = W - remarkLeft - 88;
  const remarkLines = wrapLines(paintFont, remarkCopy, remarkSize, remarkMaxW).slice(0, 3);
  const remarkBoxH = 52 + remarkLines.length * (remarkSize + 10);
  const footY = H - 108;
  const signY = footY - 78;
  const remarkY = Math.min(rowsEnd + 32, signY - remarkBoxH - 36);
  parts.push(
    `<rect x="64" y="${remarkY}" width="${W - 128}" height="${remarkBoxH}" rx="22" fill="#fbf6e6" stroke="${GOLD}" stroke-opacity="0.5" stroke-width="1.5"/>`,
  );
  parts.push(
    `<rect x="64" y="${remarkY + 18}" width="6" height="${Math.max(40, remarkBoxH - 36)}" rx="3" fill="url(#gold)"/>`,
  );
  parts.push(text(remarkLeft, remarkY + 34, "REMARK", 15, { color: GOLD_DARK, weight: 800, spacing: 4 }));
  remarkLines.forEach((line, index) => {
    parts.push(
      text(remarkLeft, remarkY + 64 + index * (remarkSize + 10), line, remarkSize, {
        color: NAVY,
        italic: true,
      }),
    );
  });

  // Signatures — more gap between teacher and principal, clear of the remark box.
  const signCenters = [210, W - 210];
  const signHalf = 150;
  ["Class Teacher", "Principal"].forEach((value, index) => {
    const x = signCenters[index]!;
    parts.push(
      `<line x1="${x - signHalf}" y1="${signY}" x2="${x + signHalf}" y2="${signY}" stroke="#bfb592" stroke-width="1.5"/>`,
    );
    parts.push(text(x, signY + 32, value, 20, { color: MUTED, weight: 600, anchor: "middle", spacing: 1 }));
  });
  parts.push(`<path d="M40 ${footY} H${W - 40} V${H - 62} a22 22 0 0 1 -22 22 H62 a22 22 0 0 1 -22 -22 Z" fill="url(#band)"/>`);
  parts.push(`<line x1="40" y1="${footY}" x2="${W - 40}" y2="${footY}" stroke="url(#gold)" stroke-width="2"/>`);
  parts.push(
    text(W / 2, footY + 44, "COMPUTER-GENERATED REPORT CARD", 17, {
      color: "#f1d980",
      weight: 700,
      anchor: "middle",
      spacing: 3,
    }),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

/** Logo scaled into a box, centred, transparent padding. */
async function logoTile(image: Buffer, width: number, height: number) {
  return sharp(image)
    .resize(width, height, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

let vitaranLogo: Promise<Buffer | null> | null = null;

export function loadVitaranLogo() {
  vitaranLogo ??= readFile(fileURLToPath(new URL("../../assets/brand/vitaran-logo.png", import.meta.url))).catch(
    () => null,
  );
  return vitaranLogo;
}

let titleFont: Promise<Font | null> | null = null;

export function loadTitleFont() {
  titleFont ??= readFile(fileURLToPath(new URL("../../assets/fonts/cinzel-700.woff", import.meta.url)))
    .then((file) => opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)))
    .catch(() => null);
  return titleFont;
}

export async function renderRankCard(data: RankCardData, logos: RankCardLogos) {
  const titleFont = await loadTitleFont();
  let schoolLogo = false;
  const layers: OverlayOptions[] = [];
  if (logos.vitaran) layers.push({ input: await logoTile(logos.vitaran, 230, 104), left: 66, top: 68 });
  if (logos.school) {
    try {
      layers.push({ input: await logoTile(logos.school, 150, 128), left: W - 216, top: 58 });
      schoolLogo = true;
    } catch {
      // Unreadable school logo: falls back to the initials badge.
    }
  }
  return sharp(Buffer.from(cardSvg(data, !schoolLogo, titleFont)))
    .composite(layers)
    .jpeg({ quality: 92 })
    .toBuffer();
}

function cardDefs() {
  return `<defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe9a6"/><stop offset="0.5" stop-color="#d9ad38"/><stop offset="1" stop-color="#a47912"/></linearGradient>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1bd"/><stop offset="1" stop-color="#e0b23e"/></linearGradient>
    <linearGradient id="navy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#232a78"/><stop offset="1" stop-color="#0d1140"/></linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d1140"/><stop offset="0.5" stop-color="#232a78"/><stop offset="1" stop-color="#0d1140"/></linearGradient>
    <pattern id="lines" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="22" stroke="#ffffff" stroke-opacity="0.045" stroke-width="8"/></pattern>
  </defs>`;
}

function cardFrame() {
  return [
    `<rect width="${W}" height="${H}" fill="#f6f2e7"/>`,
    `<rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="30" fill="#fffdf8" stroke="url(#gold)" stroke-width="4"/>`,
    `<rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="22" fill="none" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="1.5"/>`,
  ].join("");
}

function cardHeader(schoolName: string, programName: string, schoolBadge: boolean, titleFont: Font | null) {
  const parts: string[] = [];
  if (titleFont) parts.push(schoolTitle(titleFont, schoolName.toUpperCase()));
  else {
    const name = schoolNameLines(schoolName.toUpperCase());
    name.lines.forEach((line, index) => {
      parts.push(
        text(W / 2, name.top + index * (name.size + 6), line, name.size, {
          color: NAVY,
          weight: 800,
          anchor: "middle",
          spacing: 1.5,
        }),
      );
    });
  }
  parts.push(text(W / 2, 176, fit(programName, 44), 23, { color: MUTED, weight: 600, anchor: "middle", spacing: 1 }));
  if (schoolBadge) {
    const cx = W - 140;
    parts.push(`<circle cx="${cx}" cy="122" r="62" fill="url(#navy)" stroke="url(#gold)" stroke-width="4"/>`);
    parts.push(`<circle cx="${cx}" cy="122" r="51" fill="none" stroke="${GOLD}" stroke-opacity="0.6" stroke-width="1.5"/>`);
    parts.push(text(cx, 138, initials(schoolName), 44, { color: "url(#goldText)", weight: 800, anchor: "middle" }));
  }
  return parts.join("");
}

function titleBand(label: string) {
  const bandY = 214;
  const maxTitleW = W - 280;
  let size = 52;
  let spacing = 10;
  let display = label;
  while (size > 28 && measureText(paintFont, display, size, spacing) > maxTitleW) {
    if (spacing > 2) spacing -= 2;
    else size -= 2;
  }
  if (measureText(paintFont, display, size, spacing) > maxTitleW) {
    while (display.length > 3 && measureText(paintFont, `${display}...`, size, spacing) > maxTitleW) {
      display = display.slice(0, -1);
    }
    display = `${display.trimEnd()}...`;
  }
  const titleW = measureText(paintFont, display, size, spacing);
  const diamondX = W / 2 - titleW / 2 - 28;
  const showDiamonds = diamondX >= 72;
  return [
    `<rect x="40" y="${bandY}" width="${W - 80}" height="136" fill="url(#band)"/>`,
    `<rect x="40" y="${bandY}" width="${W - 80}" height="136" fill="url(#lines)"/>`,
    `<line x1="40" y1="${bandY + 8}" x2="${W - 40}" y2="${bandY + 8}" stroke="url(#gold)" stroke-width="2"/>`,
    `<line x1="40" y1="${bandY + 128}" x2="${W - 40}" y2="${bandY + 128}" stroke="url(#gold)" stroke-width="2"/>`,
    showDiamonds ? diamond(diamondX, bandY + 64, 8) : "",
    showDiamonds ? diamond(W - diamondX, bandY + 64, 8) : "",
    text(W / 2, bandY + 89, display, size, { color: "url(#goldText)", weight: 700, anchor: "middle", spacing }),
  ].join("");
}

function studentHeroBlock(student: { name: string; rollNo: string; classLabel: string }) {
  const heroY = 386;
  const heroH = 220;
  const name = fitToWidth(paintFont, student.name.toUpperCase(), 44, W - 220);
  const parts: string[] = [
    `<rect x="64" y="${heroY}" width="${W - 128}" height="${heroH}" rx="26" fill="#ffffff" stroke="#e8dcb4" stroke-width="2"/>`,
    text(100, heroY + 42, "STUDENT", 17, { color: GOLD_DARK, weight: 800, spacing: 5 }),
    text(100, heroY + 96, name, 44, { color: NAVY, weight: 700 }),
    `<rect x="100" y="${heroY + 112}" width="110" height="4" rx="2" fill="url(#gold)"/>`,
  ];
  (
    [
      ["REG. NO", student.rollNo || "-"],
      ["CLASS", student.classLabel || "-"],
    ] as Array<[string, string]>
  ).forEach(([label, value], index) => {
    const x = 100 + index * 280;
    parts.push(`<rect x="${x}" y="${heroY + 140}" width="260" height="56" rx="14" fill="#f8f4e8" stroke="#ece2c2" stroke-width="1.5"/>`);
    parts.push(text(x + 18, heroY + 162, label, 14, { color: MUTED, weight: 700, spacing: 2.5 }));
    parts.push(text(x + 18, heroY + 186, value, 22, { color: INK, weight: 800 }));
  });
  return parts.join("");
}

function fourStats(
  stats: Array<{ label: string; value: string; hint?: string }>,
  y = 640,
) {
  const gap = 22;
  const statW = (W - 128 - gap * 3) / 4;
  const statH = 170;
  const label = (x: number, value: string) =>
    text(x + statW / 2, y + 38, value, 15, { color: "#f1d980", weight: 800, anchor: "middle", spacing: 2.5 });
  const valueSize = (value: string) => {
    if (value.length <= 4) return 40;
    if (value.length <= 6) return 30;
    if (value.length <= 9) return 22;
    return 18;
  };
  return stats
    .map((stat, index) => {
      const x = 64 + index * (statW + gap);
      const size = valueSize(stat.value);
      const value = fitToWidth(paintFont, stat.value, size, statW - 28);
      return statCard(
        x,
        y,
        statW,
        statH,
        [
          label(x, stat.label),
          text(x + statW / 2, y + 100, value, size, { color: "#ffffff", weight: 800, anchor: "middle" }),
          text(x + statW / 2, y + 148, stat.hint ?? "", 16, { color: "#c3c8f2", anchor: "middle" }),
        ].join(""),
      );
    })
    .join("");
}

function cardFooter(label: string, remarkCopy: string, contentEnd: number) {
  const parts: string[] = [];
  const remarkSize = 22;
  const remarkLeft = 166;
  const remarkMaxW = W - remarkLeft - 88;
  const remarkLines = wrapLines(paintFont, remarkCopy, remarkSize, remarkMaxW).slice(0, 3);
  const remarkBoxH = 52 + remarkLines.length * (remarkSize + 10);
  const footY = H - 108;
  const signY = footY - 78;
  // Prefer sitting under the last content row; never climb into the table.
  const remarkY = Math.min(contentEnd + 20, signY - remarkBoxH - 28);
  parts.push(
    `<rect x="64" y="${remarkY}" width="${W - 128}" height="${remarkBoxH}" rx="22" fill="#fbf6e6" stroke="${GOLD}" stroke-opacity="0.5" stroke-width="1.5"/>`,
  );
  parts.push(`<rect x="64" y="${remarkY + 18}" width="6" height="${Math.max(40, remarkBoxH - 36)}" rx="3" fill="url(#gold)"/>`);
  parts.push(text(remarkLeft, remarkY + 34, "REMARK", 15, { color: GOLD_DARK, weight: 800, spacing: 4 }));
  remarkLines.forEach((line, index) => {
    parts.push(text(remarkLeft, remarkY + 64 + index * (remarkSize + 10), line, remarkSize, { color: NAVY, italic: true }));
  });
  const signCenters = [210, W - 210];
  ["Class Teacher", "Principal"].forEach((value, index) => {
    const x = signCenters[index]!;
    parts.push(`<line x1="${x - 150}" y1="${signY}" x2="${x + 150}" y2="${signY}" stroke="#bfb592" stroke-width="1.5"/>`);
    parts.push(text(x, signY + 32, value, 20, { color: MUTED, weight: 600, anchor: "middle", spacing: 1 }));
  });
  parts.push(`<path d="M40 ${footY} H${W - 40} V${H - 62} a22 22 0 0 1 -22 22 H62 a22 22 0 0 1 -22 -22 Z" fill="url(#band)"/>`);
  parts.push(`<line x1="40" y1="${footY}" x2="${W - 40}" y2="${footY}" stroke="url(#gold)" stroke-width="2"/>`);
  parts.push(
    text(W / 2, footY + 44, label, 17, {
      color: "#f1d980",
      weight: 700,
      anchor: "middle",
      spacing: 3,
    }),
  );
  return parts.join("");
}

function avgOf(values: Array<number | null>) {
  const filled = values.filter((value): value is number => value != null);
  return filled.length ? filled.reduce((sum, value) => sum + value, 0) / filled.length : null;
}

function buildYearReportSvg(data: YearReportCardData, schoolBadge: boolean, titleFont: Font | null) {
  const previousFont = paintFont;
  paintFont = titleFont;
  try {
    const parts: string[] = [cardDefs(), cardFrame()];
    parts.push(cardHeader(data.schoolName, data.programName, schoolBadge, titleFont));
    parts.push(titleBand("YEAR REPORT CARD"));
    parts.push(studentHeroBlock(data.student));

    const percents = data.tests.map((test) => test.percentage);
    const ranks = data.tests.map((test) => test.classRank).filter((rank): rank is number => rank != null);
    const best = (() => {
      const filled = percents.filter((value): value is number => value != null);
      return filled.length ? Math.max(...filled) : null;
    })();
    parts.push(
      fourStats([
        { label: "TESTS", value: String(data.tests.length), hint: "this year" },
        { label: "AVERAGE", value: data.tests.length ? `${Math.round(avgOf(percents) ?? 0)}%` : "-", hint: "overall" },
        { label: "BEST SCORE", value: best == null ? "-" : `${Math.round(best)}%`, hint: "highest test" },
        {
          label: "BEST RANK",
          value: ranks.length ? `${Math.min(...ranks)}${ordinalSuffix(Math.min(...ranks))}` : "-",
          hint: "class",
        },
      ]),
    );

    const subjects = [...new Set(data.tests.flatMap((test) => test.subjects.map((subject) => subject.label)))];
    const tableY = 850;
    parts.push(sectionTitle(tableY, "ALL TESTS THIS YEAR"));
    const headY = tableY + 40;
    const testCol = 140;
    const trailing = 70;
    const subjectW = subjects.length ? Math.max(56, (W - 128 - testCol - trailing * 2) / subjects.length) : 90;
    const cellFont = subjectW < 70 ? 12 : 16;
    parts.push(text(90, headY, "TEST", 14, { color: MUTED, weight: 800, spacing: 2 }));
    subjects.forEach((label, index) => {
      parts.push(
        text(
          90 + testCol + index * subjectW + subjectW / 2,
          headY,
          fitToWidth(paintFont, label, 12, subjectW - 8),
          12,
          {
            color: MUTED,
            weight: 800,
            anchor: "middle",
            spacing: 1,
          },
        ),
      );
    });
    parts.push(text(W - 64 - trailing * 1.5, headY, "TOTAL", 13, { color: MUTED, weight: 800, anchor: "middle" }));
    parts.push(text(W - 64 - trailing * 0.5, headY, "RANK", 13, { color: MUTED, weight: 800, anchor: "middle" }));

    const rowCount = Math.max(1, data.tests.length);
    const rowGap = rowCount > 8 ? 4 : 8;
    const rowH = Math.min(56, Math.floor(480 / rowCount) - rowGap);
    const rowsTop = headY + 16;
    data.tests.forEach((test, index) => {
      const y = rowsTop + index * (rowH + rowGap);
      const mid = y + rowH / 2;
      parts.push(`<rect x="64" y="${y}" width="${W - 128}" height="${rowH}" rx="14" fill="#ffffff" stroke="#ece4c9" stroke-width="1.5"/>`);
      parts.push(text(90, mid + 6, `Test ${test.testNumber}`, 18, { color: NAVY, weight: 800 }));
      subjects.forEach((label, sIndex) => {
        const subject = test.subjects.find((entry) => entry.label === label);
        const cx = 90 + testCol + sIndex * subjectW + subjectW / 2;
        if (subject?.marks != null) {
          const mark =
            subjectW < 64 || !subject.max
              ? num(subject.marks)
              : `${num(subject.marks)}/${num(subject.max)}`;
          parts.push(
            text(cx, mid + 6, mark, cellFont, {
              color: INK,
              weight: 700,
              anchor: "middle",
            }),
          );
        } else {
          parts.push(text(cx, mid + 6, "-", cellFont, { color: MUTED, anchor: "middle" }));
        }
      });
      parts.push(
        text(W - 64 - trailing * 1.5, mid + 6, test.total == null ? "-" : num(test.total), 18, {
          color: NAVY,
          weight: 800,
          anchor: "middle",
        }),
      );
      parts.push(
        text(W - 64 - trailing * 0.5, mid + 6, test.classRank == null ? "-" : String(Math.round(test.classRank)), 18, {
          color: GOLD_DARK,
          weight: 800,
          anchor: "middle",
        }),
      );
    });
    const contentEnd = rowsTop + data.tests.length * (rowH + rowGap);
    parts.push(cardFooter("COMPUTER-GENERATED YEAR REPORT CARD", remark(avgOf(percents)), contentEnd));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
  } finally {
    paintFont = previousFont;
  }
}

function buildSubjectReportSvg(data: SubjectReportCardData, schoolBadge: boolean, titleFont: Font | null) {
  const previousFont = paintFont;
  paintFont = titleFont;
  try {
    const parts: string[] = [cardDefs(), cardFrame()];
    parts.push(cardHeader(data.schoolName, data.programName, schoolBadge, titleFont));
    const focus = data.focusSubject?.trim().toUpperCase();
    parts.push(titleBand(focus ? `${focus} REPORT` : "SUBJECT REPORT CARD"));
    parts.push(studentHeroBlock(data.student));

    const focusScores = focus ? data.subjects[0]?.scores ?? [] : [];
    const focusPercents = focusScores
      .map((score) => score.percentage)
      .filter((value): value is number => value != null);
    const subjectAvgs = data.subjects.map((subject) => subject.average);
    const bestTest = focusPercents.length ? Math.max(...focusPercents) : null;
    const lowTest = focusPercents.length ? Math.min(...focusPercents) : null;
    const bestSubjectAvg = (() => {
      const filled = subjectAvgs.filter((value): value is number => value != null);
      return filled.length ? Math.max(...filled) : null;
    })();
    parts.push(
      fourStats(
        focus
          ? [
              { label: "SUBJECT", value: focus, hint: "selected" },
              { label: "TESTS", value: String(data.tests.length), hint: "compared" },
              {
                label: "AVERAGE",
                value: data.overallAverage == null ? "-" : `${Math.round(data.overallAverage)}%`,
                hint: "this subject",
              },
              {
                label: "BEST TEST",
                value: bestTest == null ? "-" : `${Math.round(bestTest)}%`,
                hint: lowTest == null ? "highest" : `low ${Math.round(lowTest)}%`,
              },
            ]
          : [
              { label: "SUBJECTS", value: String(data.subjects.length), hint: "tracked" },
              { label: "TESTS", value: String(data.tests.length), hint: "compared" },
              {
                label: "BEST AVG",
                value: bestSubjectAvg == null ? "-" : `${Math.round(bestSubjectAvg)}%`,
                hint: "top subject",
              },
              {
                label: "OVERALL",
                value: data.overallAverage == null ? "-" : `${Math.round(data.overallAverage)}%`,
                hint: "all tests",
              },
            ],
      ),
    );

    // Leave room for remark + signatures + footer band so they never cover rows.
    const contentFloor = H - 360;
    const sectionY = 850;
    let tableY = sectionY;
    if (!focus) {
      parts.push(sectionTitle(sectionY, "SUBJECT AVERAGES"));
      const chartTop = sectionY + 24;
      const tableRows = Math.max(1, data.subjects.length);
      const tableBlockMin = 36 + 18 + tableRows * 36;
      const chartH = Math.max(160, Math.min(200, contentFloor - chartTop - 56 - tableBlockMin));
      parts.push(
        percentBarChart(
          64,
          chartTop,
          W - 128,
          chartH,
          data.subjects.map((subject, index) => ({
            label: chartAxisLabel(subject.label),
            value: subject.average,
            color: SUBJECT_COLORS[index % SUBJECT_COLORS.length]!,
          })),
        ),
      );
      tableY = chartTop + chartH + 28;
    }

    parts.push(sectionTitle(tableY, focus ? "TEST-WISE PERFORMANCE" : "SUBJECTS ACROSS ALL TESTS"));
    const headY = tableY + 32;
    const rowsBudget = Math.max(120, contentFloor - (headY + 18));
    let contentEnd = headY;

    if (focus) {
      const cols = { test: 110, marks: 340, max: 520, pct: 700, bar: 820, barW: 280 };
      parts.push(text(90, headY, "TEST", 14, { color: MUTED, weight: 800, spacing: 2 }));
      parts.push(text(cols.marks, headY, "MARKS", 14, { color: MUTED, weight: 800, anchor: "middle", spacing: 2 }));
      parts.push(text(cols.max, headY, "OUT OF", 14, { color: MUTED, weight: 800, anchor: "middle", spacing: 2 }));
      parts.push(text(cols.pct, headY, "PERCENTAGE", 14, { color: MUTED, weight: 800, anchor: "middle", spacing: 2 }));
      parts.push(text(cols.bar, headY, "SCORE", 14, { color: MUTED, weight: 800, spacing: 2 }));
      const rowCount = Math.max(1, data.tests.length);
      const rowGap = rowCount > 8 ? 3 : 6;
      const rowH = Math.max(28, Math.min(46, Math.floor(rowsBudget / rowCount) - rowGap));
      const rowsTop = headY + 16;
      data.tests.forEach((test, index) => {
        const score = focusScores[index];
        const y = rowsTop + index * (rowH + rowGap);
        const mid = y + rowH / 2;
        const pct = score?.percentage ?? null;
        const font = Math.min(17, Math.round(rowH * 0.45));
        parts.push(`<rect x="64" y="${y}" width="${W - 128}" height="${rowH}" rx="12" fill="#ffffff" stroke="#ece4c9" stroke-width="1.5"/>`);
        parts.push(text(90, mid + font * 0.35, `Test ${test.testNumber}`, font, { color: NAVY, weight: 800 }));
        parts.push(
          text(cols.marks, mid + font * 0.35, score?.marks == null ? "-" : num(score.marks), font, {
            color: INK,
            weight: 700,
            anchor: "middle",
          }),
        );
        parts.push(
          text(cols.max, mid + font * 0.35, score?.max == null ? "-" : num(score.max), font, {
            color: MUTED,
            weight: 700,
            anchor: "middle",
          }),
        );
        parts.push(
          text(cols.pct, mid + font * 0.35, pct == null ? "-" : `${Math.round(pct)}%`, font, {
            color: pct != null && pct >= 75 ? "#16794a" : GOLD_DARK,
            weight: 800,
            anchor: "middle",
          }),
        );
        const share = pct == null ? 0 : Math.max(0, Math.min(1, pct / 100));
        const barH = Math.max(10, Math.min(14, rowH - 16));
        parts.push(`<rect x="${cols.bar}" y="${mid - barH / 2}" width="${cols.barW}" height="${barH}" rx="7" fill="#efeadb"/>`);
        if (share > 0) {
          parts.push(
            `<rect x="${cols.bar}" y="${mid - barH / 2}" width="${Math.max(8, cols.barW * share)}" height="${barH}" rx="7" fill="${SUBJECT_COLORS[0]}"/>`,
          );
        }
      });
      contentEnd = rowsTop + data.tests.length * (rowH + rowGap);
    } else {
      const avgW = 90;
      const minTestW = data.tests.length > 9 ? 50 : data.tests.length > 6 ? 60 : 74;
      const labelW = Math.min(
        data.tests.length > 9 ? 200 : 250,
        Math.max(140, W - 128 - avgW - data.tests.length * minTestW),
      );
      const testW = data.tests.length ? (W - 128 - labelW - avgW) / data.tests.length : 90;
      const showMax = data.tests.length <= 8 && testW >= 70;
      const headFont = testW < 64 ? 11 : 14;
      const markFont = testW < 56 ? 11 : testW < 72 ? 13 : 16;
      const nameFont = data.tests.length > 9 ? 15 : data.subjects.length > 7 ? 16 : 18;
      const nameMaxW = labelW - 44;
      parts.push(text(90, headY, "SUBJECT", 14, { color: MUTED, weight: 800, spacing: 2 }));
      data.tests.forEach((test, index) => {
        parts.push(
          text(90 + labelW + index * testW + testW / 2, headY, `T${test.testNumber}`, headFont, {
            color: MUTED,
            weight: 800,
            anchor: "middle",
          }),
        );
      });
      parts.push(text(W - 64 - avgW / 2, headY, "AVG", 14, { color: MUTED, weight: 800, anchor: "middle" }));
      const rowCount = Math.max(1, data.subjects.length);
      const rowGap = rowCount > 7 ? 3 : 6;
      const rowH = Math.max(28, Math.min(46, Math.floor(rowsBudget / rowCount) - rowGap));
      const rowsTop = headY + 16;
      data.subjects.forEach((subject, index) => {
        const y = rowsTop + index * (rowH + rowGap);
        const mid = y + rowH / 2;
        const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length]!;
        const iconR = Math.min(14, Math.max(9, rowH / 2 - 6));
        parts.push(`<rect x="64" y="${y}" width="${W - 128}" height="${rowH}" rx="12" fill="#ffffff" stroke="#ece4c9" stroke-width="1.5"/>`);
        parts.push(`<circle cx="98" cy="${mid}" r="${iconR}" fill="${color}"/>`);
        parts.push(
          text(98, mid + iconR * 0.36, subject.label.slice(0, 1), Math.round(iconR), {
            color: "#ffffff",
            weight: 800,
            anchor: "middle",
          }),
        );
        parts.push(
          text(124, mid + nameFont * 0.35, fitToWidth(paintFont, subject.label, nameFont, nameMaxW), nameFont, {
            color: INK,
            weight: 800,
          }),
        );
        subject.scores.forEach((score, sIndex) => {
          const cx = 90 + labelW + sIndex * testW + testW / 2;
          const mark =
            score.marks == null
              ? "-"
              : showMax && score.max
                ? `${num(score.marks)}/${num(score.max)}`
                : num(score.marks);
          parts.push(
            text(cx, mid + markFont * 0.35, mark, markFont, {
              color: score.marks == null ? MUTED : INK,
              weight: 700,
              anchor: "middle",
            }),
          );
        });
        const avgLabel = subject.average == null ? "-" : `${Math.round(subject.average)}%`;
        parts.push(
          text(W - 64 - avgW / 2, mid + 7, avgLabel, Math.min(18, markFont + 3), {
            color: subject.average != null && subject.average >= 75 ? "#16794a" : GOLD_DARK,
            weight: 800,
            anchor: "middle",
          }),
        );
      });
      contentEnd = rowsTop + data.subjects.length * (rowH + rowGap);
    }

    parts.push(
      cardFooter("COMPUTER-GENERATED SUBJECT REPORT CARD", remark(data.overallAverage), contentEnd),
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
  } finally {
    paintFont = previousFont;
  }
}

export async function renderYearReportCard(data: YearReportCardData, logos: RankCardLogos) {
  const titleFont = await loadTitleFont();
  let schoolLogo = false;
  const layers: OverlayOptions[] = [];
  if (logos.vitaran) layers.push({ input: await logoTile(logos.vitaran, 230, 104), left: 66, top: 68 });
  if (logos.school) {
    try {
      layers.push({ input: await logoTile(logos.school, 150, 128), left: W - 216, top: 58 });
      schoolLogo = true;
    } catch {
      // Unreadable school logo: falls back to the initials badge.
    }
  }
  return sharp(Buffer.from(buildYearReportSvg(data, !schoolLogo, titleFont)))
    .composite(layers)
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function renderSubjectReportCard(data: SubjectReportCardData, logos: RankCardLogos) {
  const titleFont = await loadTitleFont();
  let schoolLogo = false;
  const layers: OverlayOptions[] = [];
  if (logos.vitaran) layers.push({ input: await logoTile(logos.vitaran, 230, 104), left: 66, top: 68 });
  if (logos.school) {
    try {
      layers.push({ input: await logoTile(logos.school, 150, 128), left: W - 216, top: 58 });
      schoolLogo = true;
    } catch {
      // Unreadable school logo: falls back to the initials badge.
    }
  }
  return sharp(Buffer.from(buildSubjectReportSvg(data, !schoolLogo, titleFont)))
    .composite(layers)
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** One A4 page per card — slight inset so browser print margins don't spill onto a 2nd page. */
export async function rankCardsPdf(cards: Buffer[], title?: string) {
  const pdf = await PDFDocument.create();
  if (title) pdf.setTitle(title);
  pdf.setAuthor("Vitaran Learning");
  const pageW = 595.28;
  const pageH = 841.89;
  const inset = 8;
  for (const card of cards) {
    const image = await pdf.embedJpg(card);
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(image, {
      x: inset,
      y: inset,
      width: pageW - inset * 2,
      height: pageH - inset * 2,
    });
  }
  return Buffer.from(await pdf.save());
}
