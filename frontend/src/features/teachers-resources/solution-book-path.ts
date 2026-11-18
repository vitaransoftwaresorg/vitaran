/** `/solution-books/a/b.pdf` → `["a","b.pdf"]` */
export function solutionBookPartsFromHref(href: string): string[] | null {
  if (!href.startsWith("/solution-books/")) return null;
  const parts = href
    .slice("/solution-books/".length)
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}
