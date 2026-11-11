import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import opentype, { type Font } from "opentype.js";
import { PDFDocument } from "pdf-lib";
import sharp, { type OverlayOptions } from "sharp";

/** A4 at 150 dpi. */
const W = 1240;
const H = 1754;
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

const NAVY = "#141a52";
const INK = "#1c2033";
const MUTED = "#7a7f99";
const GOLD = "#c9a227";
const GOLD_DARK = "#8a6a10";
const SUBJECT_COLORS = ["#2f5bea", "#0f9f6e", "#e8622c", "#d63384", "#7048e8", "#0b93b8", "#c28a0a"];

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
  subjects: RankCardSubject[];
  total: number | null;
  totalMax: number | null;
  percentage: number | null;
  classRank: number | null;
  sectionRank: number | null;
};

export type RankCardLogos = { vitaran: Buffer | null; school: Buffer | null };

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fit = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

const num = (value: number | null | undefined, digits = 2) =>
  value == null ? "—" : String(Math.round(value * 10 ** digits) / 10 ** digits);

const ordinalSuffix = (rank: number) => {
  const tail = rank % 100;
  if (tail >= 11 && tail <= 13) return "th";
  return ["th", "st", "nd", "rd"][rank % 10] ?? "th";
};

/** Rank number with a raised, smaller "st / nd / rd / th". */
function rankText(x: number, y: number, rank: number | null, size: number, options: TextOptions = {}) {
  if (rank == null) return text(x, y, "—", size, options);
  const value = String(Math.round(rank));
  const suffix = ordinalSuffix(Math.round(rank));
  return `<text x="${x}" y="${y}" font-family="${options.font ?? SANS}" font-size="${size}" font-weight="${options.weight ?? 700}" fill="${options.color ?? INK}" text-anchor="${options.anchor ?? "middle"}">${value}<tspan font-size="${Math.round(size * 0.42)}" font-family="${SANS}" font-weight="800" dx="${Math.round(size * 0.04)}" dy="${-Math.round(size * 0.46)}">${suffix}</tspan></text>`;
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
  font?: string;
  italic?: boolean;
};

function text(x: number, y: number, value: string, size: number, options: TextOptions = {}) {
  return `<text x="${x}" y="${y}" font-family="${options.font ?? SANS}" font-size="${size}" font-weight="${options.weight ?? 400}"${options.italic ? ' font-style="italic"' : ""} fill="${options.color ?? INK}" text-anchor="${options.anchor ?? "start"}"${options.spacing ? ` letter-spacing="${options.spacing}"` : ""}${options.opacity != null ? ` fill-opacity="${options.opacity}"` : ""}>${esc(value)}</text>`;
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
  while (cut.length > 1 && titleWidth(font, `${cut}…`, size) > TITLE_WIDTH) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Small gold diamond used as an ornament before section titles. */
const diamond = (x: number, y: number, r: number) =>
  `<path d="M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z" fill="url(#gold)"/>`;

function sectionTitle(y: number, label: string) {
  return [
    diamond(78, y - 8, 9),
    text(100, y, label, 23, { color: NAVY, weight: 800, spacing: 4 }),
    `<line x1="${120 + label.length * 20}" y1="${y - 8}" x2="${W - 64}" y2="${y - 8}" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="2"/>`,
  ].join("");
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
  parts.push(text(W / 2, 176, fit(data.programName, 44), 23, { color: MUTED, weight: 600, anchor: "middle", spacing: 1 }));
  if (schoolBadge) {
    const cx = W - 140;
    parts.push(`<circle cx="${cx}" cy="122" r="62" fill="url(#navy)" stroke="url(#gold)" stroke-width="4"/>`);
    parts.push(`<circle cx="${cx}" cy="122" r="51" fill="none" stroke="${GOLD}" stroke-opacity="0.6" stroke-width="1.5"/>`);
    parts.push(text(cx, 138, initials(data.schoolName), 44, { color: "url(#goldText)", weight: 800, anchor: "middle", font: SERIF }));
  }

  // Title band.
  const bandY = 214;
  parts.push(`<rect x="40" y="${bandY}" width="${W - 80}" height="136" fill="url(#band)"/>`);
  parts.push(`<rect x="40" y="${bandY}" width="${W - 80}" height="136" fill="url(#lines)"/>`);
  parts.push(`<line x1="40" y1="${bandY + 8}" x2="${W - 40}" y2="${bandY + 8}" stroke="url(#gold)" stroke-width="2"/>`);
  parts.push(`<line x1="40" y1="${bandY + 128}" x2="${W - 40}" y2="${bandY + 128}" stroke="url(#gold)" stroke-width="2"/>`);
  parts.push(diamond(300, bandY + 64, 8), diamond(W - 300, bandY + 64, 8));
  parts.push(text(W / 2, bandY + 89, "RANK CARD", 60, { color: "url(#goldText)", weight: 700, anchor: "middle", spacing: 14, font: SERIF }));

  // Student hero; the class-rank medal is only for the top three.
  const heroY = 386;
  const heroH = 236;
  parts.push(`<rect x="64" y="${heroY}" width="${W - 128}" height="${heroH}" rx="26" fill="#ffffff" stroke="#e8dcb4" stroke-width="2"/>`);
  parts.push(text(100, heroY + 50, "STUDENT", 17, { color: GOLD_DARK, weight: 800, spacing: 5 }));
  parts.push(text(100, heroY + 108, fit(data.student.name.toUpperCase(), 24), 50, { color: NAVY, weight: 700, font: SERIF }));
  parts.push(`<rect x="100" y="${heroY + 124}" width="110" height="4" rx="2" fill="url(#gold)"/>`);
  const chips: Array<[string, string]> = [
    ["REG. NO", data.student.rollNo || "—"],
    ["CLASS", data.student.classLabel || "—"],
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
    parts.push(rankText(mx - 6, my + 46, data.classRank, 76, { color: medal.ink, font: SERIF }));
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
      text(ringX, ringY + 11, data.percentage == null ? "—" : `${Math.round(data.percentage)}%`, 32, { color: "#ffffff", weight: 800, anchor: "middle" }),
    ].join("")),
  );

  parts.push(
    statCard(statX(2), statY, statW, statH, [
      label(statX(2), statY, "SECTION RANK"),
      rankText(statX(2) + statW / 2, statY + 126, data.sectionRank, 62, { color: "#ffffff", font: SERIF }),
      text(statX(2) + statW / 2, statY + 164, `Class ${data.student.classLabel}`, 20, { color: "#c3c8f2", anchor: "middle" }),
    ].join("")),
  );

  parts.push(
    statCard(statX(3), statY, statW, statH, [
      label(statX(3), statY, "CLASS RANK"),
      rankText(statX(3) + statW / 2, statY + 126, data.classRank, 62, { color: "url(#goldText)", font: SERIF }),
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
        parts.push(text(x, mid + chipFont * 0.36, value == null ? "—" : String(value), chipFont, { color: ink, weight: 800, anchor: "middle" }));
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
      font: SERIF,
    }),
  );
  const rowsEnd = totalTop + totalH;

  // Remark.
  const remarkY = rowsEnd + 40;
  parts.push(`<rect x="64" y="${remarkY}" width="${W - 128}" height="118" rx="22" fill="#fbf6e6" stroke="${GOLD}" stroke-opacity="0.5" stroke-width="1.5"/>`);
  parts.push(`<rect x="64" y="${remarkY + 22}" width="6" height="74" rx="3" fill="url(#gold)"/>`);
  parts.push(text(104, remarkY + 92, "\u201C", 110, { color: GOLD, weight: 700, font: SERIF, opacity: 0.5 }));
  parts.push(text(166, remarkY + 44, "REMARK", 16, { color: GOLD_DARK, weight: 800, spacing: 4 }));
  parts.push(text(166, remarkY + 86, remark(data.percentage), 27, { color: NAVY, italic: true, font: SERIF }));

  // Signatures and footer.
  const signY = H - 176;
  ["Class Teacher", "Principal"].forEach((value, index) => {
    const x = 260 + index * 720;
    parts.push(`<line x1="${x - 120}" y1="${signY}" x2="${x + 120}" y2="${signY}" stroke="#bfb592" stroke-width="1.5"/>`);
    parts.push(text(x, signY + 30, value, 20, { color: MUTED, weight: 600, anchor: "middle", spacing: 1 }));
  });
  const footY = H - 108;
  parts.push(`<path d="M40 ${footY} H${W - 40} V${H - 62} a22 22 0 0 1 -22 22 H62 a22 22 0 0 1 -22 -22 Z" fill="url(#band)"/>`);
  parts.push(`<line x1="40" y1="${footY}" x2="${W - 40}" y2="${footY}" stroke="url(#gold)" stroke-width="2"/>`);
  parts.push(
    text(W / 2, footY + 44, "COMPUTER-GENERATED RANK CARD", 17, {
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
  const layers: OverlayOptions[] = [];
  if (logos.vitaran) layers.push({ input: await logoTile(logos.vitaran, 230, 104), left: 66, top: 68 });
  let schoolLogo = false;
  if (logos.school) {
    try {
      layers.push({ input: await logoTile(logos.school, 150, 128), left: W - 216, top: 58 });
      schoolLogo = true;
    } catch {
      // Unreadable school logo: falls back to the initials badge.
    }
  }
  return sharp(Buffer.from(cardSvg(data, !schoolLogo, await loadTitleFont())))
    .composite(layers)
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** One A4 page per card. */
export async function rankCardsPdf(cards: Buffer[]) {
  const pdf = await PDFDocument.create();
  for (const card of cards) {
    const image = await pdf.embedJpg(card);
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return Buffer.from(await pdf.save());
}
