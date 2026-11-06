import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import sharp, { type OverlayOptions } from "sharp";

/** A4 at 150 dpi. */
export const W = 1240;
export const H = 1754;
export const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
export const SERIF = "Georgia, 'Times New Roman', serif";

export const NAVY = "#141a52";
export const INK = "#1c2033";
export const MUTED = "#7a7f99";
export const GOLD = "#c9a227";
export const GOLD_DARK = "#8a6a10";
export const SUBJECT_COLORS = ["#2f5bea", "#0f9f6e", "#e8622c", "#d63384", "#7048e8", "#0b93b8", "#c28a0a"];

export type BrandLogos = { vitaran: Buffer | null; school: Buffer | null };

export const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const fit = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

type TextOptions = {
  color?: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  spacing?: number;
  opacity?: number;
  font?: string;
  italic?: boolean;
};

export function text(x: number, y: number, value: string, size: number, options: TextOptions = {}) {
  return `<text x="${x}" y="${y}" font-family="${options.font ?? SANS}" font-size="${size}" font-weight="${options.weight ?? 400}"${options.italic ? ' font-style="italic"' : ""} fill="${options.color ?? INK}" text-anchor="${options.anchor ?? "start"}"${options.spacing ? ` letter-spacing="${options.spacing}"` : ""}${options.opacity != null ? ` fill-opacity="${options.opacity}"` : ""}>${esc(value)}</text>`;
}

export function initials(name: string) {
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
export const diamond = (x: number, y: number, r: number) =>
  `<path d="M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z" fill="url(#gold)"/>`;

export function sectionTitle(y: number, label: string, x = 78) {
  return [
    diamond(x, y - 8, 9),
    text(x + 22, y, label, 23, { color: NAVY, weight: 800, spacing: 4 }),
    `<line x1="${x + 42 + label.length * 20}" y1="${y - 8}" x2="${W - 64}" y2="${y - 8}" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="2"/>`,
  ].join("");
}

export const BRAND_DEFS = `<defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe9a6"/><stop offset="0.5" stop-color="#d9ad38"/><stop offset="1" stop-color="#a47912"/></linearGradient>
    <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1bd"/><stop offset="1" stop-color="#e0b23e"/></linearGradient>
    <linearGradient id="navy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#232a78"/><stop offset="1" stop-color="#0d1140"/></linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d1140"/><stop offset="0.5" stop-color="#232a78"/><stop offset="1" stop-color="#0d1140"/></linearGradient>
    <linearGradient id="ribbonL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3290"/><stop offset="1" stop-color="#121752"/></linearGradient>
    <linearGradient id="ribbonR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3261e"/><stop offset="1" stop-color="#6e120d"/></linearGradient>
    <pattern id="lines" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="22" stroke="#ffffff" stroke-opacity="0.045" stroke-width="8"/></pattern>
  </defs>`;

/** Ivory page with a double gold frame. */
export function pageFrame() {
  return [
    `<rect width="${W}" height="${H}" fill="#f6f2e7"/>`,
    `<rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="30" fill="#fffdf8" stroke="url(#gold)" stroke-width="4"/>`,
    `<rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="22" fill="none" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="1.5"/>`,
  ].join("");
}

/** School name and program centred between the logo boxes; initials crest when the school has no logo. */
export function brandHeader(schoolName: string, subtitle: string, schoolBadge: boolean) {
  const parts: string[] = [];
  const name = schoolNameLines(schoolName.toUpperCase());
  name.lines.forEach((line, index) => {
    parts.push(text(W / 2, name.top + index * (name.size + 6), line, name.size, { color: NAVY, weight: 800, anchor: "middle", spacing: 1.5 }));
  });
  parts.push(text(W / 2, 168, fit(subtitle, 44), 23, { color: MUTED, weight: 600, anchor: "middle", spacing: 1 }));
  if (schoolBadge) {
    const cx = W - 140;
    parts.push(`<circle cx="${cx}" cy="122" r="62" fill="url(#navy)" stroke="url(#gold)" stroke-width="4"/>`);
    parts.push(`<circle cx="${cx}" cy="122" r="51" fill="none" stroke="${GOLD}" stroke-opacity="0.6" stroke-width="1.5"/>`);
    parts.push(text(cx, 138, initials(schoolName), 44, { color: "url(#goldText)", weight: 800, anchor: "middle", font: SERIF }));
  }
  return parts.join("");
}

/** Navy title band with gold rules, e.g. "RANK CARD" over a spaced caption. */
export function titleBand(y: number, title: string, caption: string) {
  return [
    `<rect x="40" y="${y}" width="${W - 80}" height="136" fill="url(#band)"/>`,
    `<rect x="40" y="${y}" width="${W - 80}" height="136" fill="url(#lines)"/>`,
    `<line x1="40" y1="${y + 8}" x2="${W - 40}" y2="${y + 8}" stroke="url(#gold)" stroke-width="2"/>`,
    `<line x1="40" y1="${y + 128}" x2="${W - 40}" y2="${y + 128}" stroke="url(#gold)" stroke-width="2"/>`,
    diamond(300, y + 64, 8),
    diamond(W - 300, y + 64, 8),
    text(W / 2, y + 82, title, 60, { color: "url(#goldText)", weight: 700, anchor: "middle", spacing: 14, font: SERIF }),
    text(W / 2, y + 114, caption, 19, { color: "#d8dcff", weight: 600, anchor: "middle", spacing: 4 }),
  ].join("");
}

/** Navy footer strip along the bottom edge of the frame. */
export function footerBand(caption: string) {
  const y = H - 108;
  return [
    `<path d="M40 ${y} H${W - 40} V${H - 62} a22 22 0 0 1 -22 22 H62 a22 22 0 0 1 -22 -22 Z" fill="url(#band)"/>`,
    `<line x1="40" y1="${y}" x2="${W - 40}" y2="${y}" stroke="url(#gold)" stroke-width="2"/>`,
    text(W / 2, y + 44, caption, 17, { color: "#f1d980", weight: 700, anchor: "middle", spacing: 3 }),
  ].join("");
}

export const svgPage = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${BRAND_DEFS}${body}</svg>`;

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

/** Header logo layers; `schoolLogo` is false when the school has none (or it can't be read). */
export async function brandLogoLayers(logos: BrandLogos) {
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
  return { layers, schoolLogo };
}

export function renderPage(svg: string, layers: OverlayOptions[]) {
  return sharp(Buffer.from(svg)).composite(layers).jpeg({ quality: 92 }).toBuffer();
}

/** One A4 page per JPEG. */
export async function jpegPagesPdf(pages: Buffer[], title?: string) {
  const pdf = await PDFDocument.create();
  if (title) pdf.setTitle(title);
  for (const page of pages) {
    const image = await pdf.embedJpg(page);
    pdf.addPage([595.28, 841.89]).drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return Buffer.from(await pdf.save());
}
