export const ROLL_LENGTH = 7;
/** Shared blank / unknown registration — many students may use this value. */
export const SHARED_BLANK_ROLL = "0000000";

export function rollInput(value: string) {
  return value.replace(/\D/g, "").slice(0, ROLL_LENGTH);
}

export function isSharedBlankRoll(rollNo: string) {
  const digits = rollInput(rollNo);
  return digits.length === 0 || /^0+$/.test(digits);
}

/** Empty or all zeros → 0000000; otherwise the typed 7 digits. */
export function normalizeRollNo(rollNo: string) {
  const digits = rollInput(rollNo);
  return isSharedBlankRoll(digits) ? SHARED_BLANK_ROLL : digits;
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

/** Same registration as another page — allow entering the correct one for each sheet. */
export function isDuplicateRollError(message: string) {
  return (
    /same registration number as page/i.test(message) ||
    /duplicate registration number/i.test(message)
  );
}

/** Same registration matches more than one student — pick one from the list. */
export function isAmbiguousRollError(message: string) {
  return /matches \d+ students/i.test(message) || /ambiguous.?roll/i.test(message);
}

/**
 * Test ID / student placement mismatch (wrong class or program for this sheet).
 * Examiner can enter a different registration for the same OMR.
 */
export function isStudentMismatchError(message: string) {
  return (
    /is for Class .+ but .+ is in Class/i.test(message) ||
    /belongs to a different program than/i.test(message) ||
    /check the test ID or the student's (class|program)/i.test(message)
  );
}

/** Unknown registration on the sheet — examiner can enter a different one. */
export function isNoStudentRollError(message: string) {
  return /no student with registration number/i.test(message);
}

/** Drop instructional tails from scan errors for the list UI. */
export function displayScanError(message: string) {
  return message
    .replace(/\s*Fill exactly one bubble in each of the 7 columns\.?/gi, "")
    .replace(/\s*Check the test ID or the student's (class|program)\.?/gi, "")
    .trim();
}

/** Show enter-registration + Save for every failed sheet that can be rematched. */
export function canRecoverRoll(_message: string) {
  return true;
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
