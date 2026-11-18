import "server-only";
import path from "node:path";

/** Safe absolute path under public/solution-books, or null if the request is invalid. */
export function resolveSolutionBookFile(parts: string[]): string | null {
  if (parts.length === 0) return null;
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes("\0"))) {
    return null;
  }
  if (!parts.at(-1)?.toLowerCase().endsWith(".pdf")) return null;

  const root = path.resolve(process.cwd(), "public", "solution-books");
  const file = path.resolve(root, ...parts);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}
