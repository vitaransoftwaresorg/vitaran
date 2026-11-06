import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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

const ordinal = (rank: number | null) => {
  if (rank == null) return "—";
  const tail = rank % 100;
  if (tail >= 11 && tail <= 13) return `${rank}th`;
  return `${rank}${["th", "st", "nd", "rd"][rank % 10] ?? "th"}`;
};

function grade(percent: number | null) {
  if (percent == null) return { grade: "—", title: "Result pending", remark: "Result pending." };
  if (percent >= 90) return { grade: "A+", title: "Outstanding", remark: "Outstanding performance! A brilliant example — keep shining." };
  if (percent >= 80) return { grade: "A", title: "Excellent", remark: "Excellent work! Your hard work is clearly paying off." };
  if (percent >= 70) return { grade: "B+", title: "Very Good", remark: "Very good! A little more practice will take you to the top." };
  if (percent >= 60) return { grade: "B", title: "Good", remark: "Good job! Keep building on your strengths every day." };
  if (percent >= 50) return { grade: "C", title: "Nice Effort", remark: "Nice effort! Steady revision will help you score even higher." };
  if (percent >= 35) return { grade: "D", title: "Progressing", remark: "You're making progress! Daily practice will build your confidence." };
  return { grade: "E", title: "Keep Going", remark: "Every step counts! With focus and support, you'll do better next time." };
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

function cardSvg(data: RankCardData, schoolBadge: boolean) {
  const g = grade(data.percentage);
  const hasOmr = data.subjects.some((row) => row.right != null);
  const parts: string[] = [];

  parts.push(`<defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe9a6"/><stop offset="0.5" stop-color="#d9ad38"/><stop offset="1" stop-color="#a47912"/></linearGradient>
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
  const name = schoolNameLines(data.schoolName.toUpperCase());
  name.lines.forEach((line, index) => {
    parts.push(text(W / 2, name.top + index * (name.size + 6), line, name.size, { color: NAVY, weight: 800, anchor: "middle", spacing: 1.5 }));
  });
  parts.push(text(W / 2, 168, fit(data.programName, 44), 23, { color: MUTED, weight: 600, anchor: "middle", spacing: 1 }));
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
  parts.push(text(W / 2, bandY + 82, "RANK CARD", 60, { color: "url(#goldText)", weight: 700, anchor: "middle", spacing: 14, font: SERIF }));
  parts.push(
    text(W / 2, bandY + 114, `ACADEMIC PERFORMANCE REPORT  •  TEST ${data.testNumber}`, 19, {
      color: "#d8dcff",
      weight: 600,
      anchor: "middle",
      spacing: 4,
    }),
  );

  // Student hero with class-rank medal.
  const heroY = 386;
  const heroH = 236;
  parts.push(`<rect x="64" y="${heroY}" width="${W - 128}" height="${heroH}" rx="26" fill="#ffffff" stroke="#e8dcb4" stroke-width="2"/>`);
  parts.push(text(100, heroY + 50, "STUDENT", 17, { color: GOLD_DARK, weight: 800, spacing: 5 }));
  parts.push(text(100, heroY + 108, fit(data.student.name.toUpperCase(), 24), 50, { color: NAVY, weight: 700, font: SERIF }));
  parts.push(`<rect x="100" y="${heroY + 124}" width="110" height="4" rx="2" fill="url(#gold)"/>`);
  const chips: Array<[string, string]> = [
    ["REG. NO", data.student.rollNo || "—"],
    ["CLASS", data.student.classLabel || "—"],
    ["TEST ID", data.testId || `Test ${data.testNumber}`],
  ];
  chips.forEach(([label, value], index) => {
    const x = 100 + index * 228;
    parts.push(`<rect x="${x}" y="${heroY + 148}" width="212" height="64" rx="14" fill="#f8f4e8" stroke="#ece2c2" stroke-width="1.5"/>`);
    parts.push(text(x + 18, heroY + 172, label, 15, { color: MUTED, weight: 700, spacing: 2.5 }));
    parts.push(text(x + 18, heroY + 202, value, 25, { color: INK, weight: 800 }));
  });

  const mx = W - 220;
  const my = heroY + 112;
  parts.push(`<path d="M${mx - 60} ${my + 52} L${mx - 84} ${my + 138} L${mx - 60} ${my + 126} L${mx - 44} ${my + 148} L${mx - 14} ${my + 72} Z" fill="url(#ribbonL)"/>`);
  parts.push(`<path d="M${mx + 60} ${my + 52} L${mx + 84} ${my + 138} L${mx + 60} ${my + 126} L${mx + 44} ${my + 148} L${mx + 14} ${my + 72} Z" fill="url(#ribbonR)"/>`);
  parts.push(`<circle cx="${mx}" cy="${my + 6}" r="104" fill="#000000" fill-opacity="0.12"/>`);
  parts.push(`<circle cx="${mx}" cy="${my}" r="104" fill="url(#gold)" stroke="#a47912" stroke-width="3"/>`);
  parts.push(`<circle cx="${mx}" cy="${my}" r="88" fill="none" stroke="#fff6d6" stroke-opacity="0.9" stroke-width="2.5" stroke-dasharray="3 7"/>`);
  parts.push(`<circle cx="${mx}" cy="${my}" r="76" fill="#fff8dd" fill-opacity="0.22"/>`);
  parts.push(text(mx, my - 34, "CLASS RANK", 16, { color: "#5a3e00", weight: 800, anchor: "middle", spacing: 3 }));
  parts.push(text(mx, my + 42, ordinal(data.classRank), 68, { color: "#3a2700", weight: 700, anchor: "middle", font: SERIF }));

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
      text(statX(2) + statW / 2, statY + 124, ordinal(data.sectionRank), 60, { color: "#ffffff", weight: 700, anchor: "middle", font: SERIF }),
      text(statX(2) + statW / 2, statY + 164, `Class ${data.student.classLabel}`, 20, { color: "#c3c8f2", anchor: "middle" }),
    ].join("")),
  );

  parts.push(
    statCard(statX(3), statY, statW, statH, [
      label(statX(3), statY, "GRADE"),
      text(statX(3) + statW / 2, statY + 126, g.grade, 66, { color: "url(#goldText)", weight: 700, anchor: "middle", font: SERIF }),
      text(statX(3) + statW / 2, statY + 164, g.title, 20, { color: "#c3c8f2", anchor: "middle", weight: 600 }),
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

  const rowGap = 12;
  const rowH = Math.min(70, Math.floor(360 / Math.max(1, data.subjects.length)) - rowGap);
  const rowsTop = headY + 18;
  data.subjects.forEach((row, index) => {
    const y = rowsTop + index * (rowH + rowGap);
    const mid = y + rowH / 2;
    const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length]!;
    parts.push(`<rect x="64" y="${y}" width="${W - 128}" height="${rowH}" rx="16" fill="#ffffff" stroke="#ece4c9" stroke-width="1.5"/>`);
    parts.push(`<circle cx="104" cy="${mid}" r="${Math.min(22, rowH / 2 - 8)}" fill="${color}"/>`);
    parts.push(text(104, mid + 8, row.label.slice(0, 1), 22, { color: "#ffffff", weight: 800, anchor: "middle" }));
    parts.push(text(cols.name, mid + 9, fit(row.label, 16), 25, { color: INK, weight: 800, spacing: 0.5 }));
    parts.push(
      text(cols.marks, mid + 9, `${num(row.marks)}${row.max ? ` / ${num(row.max)}` : ""}`, 25, {
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
        parts.push(`<rect x="${x - 30}" y="${mid - 20}" width="60" height="40" rx="12" fill="${fill}"/>`);
        parts.push(text(x, mid + 8, value == null ? "—" : String(value), 22, { color: ink, weight: 800, anchor: "middle" }));
      };
      chip(cols.right, row.right, "#e3f6ea", "#16794a");
      chip(cols.wrong, row.wrong, "#fde8e6", "#b42318");
      chip(cols.blank, row.blank, "#f1f1ee", "#5b6070");
    }
  });
  const rowsEnd = rowsTop + data.subjects.length * (rowH + rowGap) - rowGap;

  // Remark.
  const remarkY = rowsEnd + 40;
  parts.push(`<rect x="64" y="${remarkY}" width="${W - 128}" height="118" rx="22" fill="#fbf6e6" stroke="${GOLD}" stroke-opacity="0.5" stroke-width="1.5"/>`);
  parts.push(`<rect x="64" y="${remarkY + 22}" width="6" height="74" rx="3" fill="url(#gold)"/>`);
  parts.push(text(104, remarkY + 92, "\u201C", 110, { color: GOLD, weight: 700, font: SERIF, opacity: 0.5 }));
  parts.push(text(166, remarkY + 44, "REMARK", 16, { color: GOLD_DARK, weight: 800, spacing: 4 }));
  parts.push(text(166, remarkY + 86, g.remark, 27, { color: NAVY, italic: true, font: SERIF }));

  // Signatures and footer.
  const signY = H - 176;
  ["Class Teacher", "Principal", "Vitaran Learning"].forEach((value, index) => {
    const x = 210 + index * 410;
    parts.push(`<line x1="${x - 120}" y1="${signY}" x2="${x + 120}" y2="${signY}" stroke="#bfb592" stroke-width="1.5"/>`);
    parts.push(text(x, signY + 30, value, 20, { color: MUTED, weight: 600, anchor: "middle", spacing: 1 }));
  });
  const footY = H - 108;
  parts.push(`<path d="M40 ${footY} H${W - 40} V${H - 62} a22 22 0 0 1 -22 22 H62 a22 22 0 0 1 -22 -22 Z" fill="url(#band)"/>`);
  parts.push(`<line x1="40" y1="${footY}" x2="${W - 40}" y2="${footY}" stroke="url(#gold)" stroke-width="2"/>`);
  parts.push(
    text(W / 2, footY + 44, "POWERED BY VITARAN LEARNING  •  COMPUTER-GENERATED RANK CARD", 17, {
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
  return sharp(Buffer.from(cardSvg(data, !schoolLogo)))
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
