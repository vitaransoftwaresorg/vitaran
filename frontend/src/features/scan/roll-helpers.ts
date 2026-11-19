export const ROLL_LENGTH = 7;

export function rollInput(value: string) {
  return value.replace(/\D/g, "").slice(0, ROLL_LENGTH);
}

/** Bubbles / OCR could not produce a registration number — allow manual entry. */
export function isRollUnreadError(message: string) {
  return (
    /could not read the registration/i.test(message) ||
    /fill the registration bubbles/i.test(message)
  );
}
