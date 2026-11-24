/** `/solution-books/a/b.pdf` → `["a","b.pdf"]` (legacy static files). */
export function solutionBookPartsFromHref(href: string): string[] | null {
  if (href.startsWith("/solution-books/")) {
    const parts = href
      .slice("/solution-books/".length)
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length ? parts : null;
  }
  if (href.startsWith("/teacher-resources/")) {
    const parts = href
      .slice("/teacher-resources/".length)
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length ? parts : null;
  }
  return null;
}

export function teacherResourceHref(
  programCode: string,
  classLevel: number,
  subject: string,
  volume?: number | null,
) {
  const base = `/teacher-resources/${encodeURIComponent(programCode)}/${classLevel}/${encodeURIComponent(subject)}`;
  return volume != null && volume > 0 ? `${base}/v${volume}` : base;
}

/** Parse `/teacher-resources/INTEGRATED/6/MATHEMATICS` or `.../v1`. */
export function parseTeacherResourceHref(href: string): {
  programCode: string;
  classLevel: number;
  subject: string;
  volume: number;
} | null {
  if (!href.startsWith("/teacher-resources/")) return null;
  const parts = href
    .slice("/teacher-resources/".length)
    .split("/")
    .map((part) => decodeURIComponent(part.trim()))
    .filter(Boolean);
  if (parts.length < 3) return null;
  const programCode = parts[0]!.toUpperCase();
  const classLevel = Number(parts[1]);
  const subject = parts[2]!.toUpperCase();
  const volumePart = parts[3];
  const volume =
    volumePart && /^v?\d+$/i.test(volumePart)
      ? Number(volumePart.replace(/^v/i, ""))
      : 0;
  if (!programCode || !Number.isInteger(classLevel) || !subject) return null;
  return { programCode, classLevel, subject, volume };
}
