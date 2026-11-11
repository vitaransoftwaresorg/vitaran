import { z } from "zod";

/**
 * "allu naveen kumar" → "Allu Naveen Kumar": capitalises the first letter of every word, also
 * after "." "-" or "(" ("k.naveen" → "K.Naveen"). Text typed all in one case is fully re-cased;
 * mixed case keeps the user's inner capitals (ZPHS, McDonald).
 */
export function titleCase(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  const oneCase = text === text.toLowerCase() || text === text.toUpperCase();
  const base = oneCase ? text.toLowerCase() : text;
  return base.replace(/(^|[\s.\-(])(\p{L})/gu, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

export const titleText = (min: number, max: number) => z.string().trim().min(min).max(max).transform(titleCase);
