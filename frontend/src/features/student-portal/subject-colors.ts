const KNOWN: Record<string, string> = {
  MATHEMATICS: "#191c5f",
  PHYSICS: "#3b3f8f",
  CHEMISTRY: "#38bdf8",
  BIOLOGY: "#15803d",
  SCIENCE: "#a16207",
  ENGLISH: "#7c3aed",
};

const PALETTE = ["#191c5f", "#3b3f8f", "#38bdf8", "#15803d", "#a16207", "#7c3aed", "#be185d"];

export const SUBJECT_COLORS: Record<string, string> = KNOWN;

export function subjectColor(subject: string) {
  if (KNOWN[subject]) return KNOWN[subject];
  let hash = 0;
  for (const ch of subject) hash = (hash + ch.charCodeAt(0)) % PALETTE.length;
  return PALETTE[hash] ?? PALETTE[0];
}

/** Paper order: Maths, Physics, Chemistry, Biology. */
export const MPCB = ["MATHEMATICS", "PHYSICS", "CHEMISTRY", "BIOLOGY"] as const;

/** Known paper order first, then any other subject codes from the data. */
export function orderedSubjects(ids: Iterable<string>): string[] {
  const seen = new Set(ids);
  const known = MPCB.filter((id) => seen.has(id));
  const extra = [...seen].filter((id) => !(MPCB as readonly string[]).includes(id));
  return [...known, ...extra];
}

export const MIX_COLORS = {
  Correct: "#059669",
  Wrong: "#e11d48",
  Blank: "#a1a1aa",
  Invalid: "#d97706",
} as const;
