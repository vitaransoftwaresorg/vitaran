/**
 * Safe, readable download filenames for Content-Disposition.
 * Parts are joined with `-`; empty parts are skipped.
 */
export function fileSafe(value: string, fallback = "file") {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

export function downloadFileName(
  parts: Array<string | number | null | undefined>,
  extension: string,
) {
  const stem = parts
    .map((part) => {
      if (part == null) return "";
      const text = String(part).trim();
      return text ? fileSafe(text) : "";
    })
    .filter(Boolean)
    .join("-");
  const ext = extension.replace(/^\./, "").toLowerCase() || "bin";
  return `${stem || "download"}.${ext}`;
}
