export const ROLL_LENGTH = 7;

export function rollInput(value: string) {
  return value.replace(/\D/g, "").slice(0, ROLL_LENGTH);
}

/** Bubbles / OCR could not produce a registration number — allow manual entry. */
export function isRollUnreadError(message: string) {
  return (
    /could not read the registration/i.test(message) ||
    /unable to (find|read) the registration/i.test(message) ||
    /registration bubbles are not filled/i.test(message) ||
    /fill the registration bubbles/i.test(message) ||
    /fill exactly one bubble/i.test(message) ||
    /not bubble filled/i.test(message)
  );
}

/** Same registration as an earlier page — allow entering the correct one. */
export function isDuplicateRollError(message: string) {
  return /same registration number as page/i.test(message);
}

/** Same registration matches more than one student — pick one from the list. */
export function isAmbiguousRollError(message: string) {
  return /matches \d+ students/i.test(message) || /ambiguous.?roll/i.test(message);
}

/** Show the enter-registration recovery panel for unread, duplicate, or ambiguous rolls. */
export function canRecoverRoll(message: string) {
  return (
    isRollUnreadError(message) || isDuplicateRollError(message) || isAmbiguousRollError(message)
  );
}

export type AmbiguousRollDetails = {
  code?: string;
  rollNo?: string;
  matches?: Array<{
    id?: string;
    name: string;
    rollNo: string;
    classLevel: number;
    sectionName?: string | null;
    programName?: string | null;
    schoolId: string;
    schoolName: string;
  }>;
};

/** Pull ambiguous-roll matches from an API error details payload. */
export function ambiguousMatchesFromDetails(details: unknown): AmbiguousRollDetails["matches"] {
  if (!details || typeof details !== "object") return undefined;
  const row = details as AmbiguousRollDetails;
  if (row.code && row.code !== "AMBIGUOUS_ROLL") return undefined;
  if (!Array.isArray(row.matches) || row.matches.length === 0) return undefined;
  return row.matches.filter(
    (match) =>
      match &&
      typeof match.name === "string" &&
      typeof match.rollNo === "string" &&
      typeof match.schoolId === "string" &&
      typeof match.schoolName === "string" &&
      Number.isInteger(match.classLevel),
  );
}
