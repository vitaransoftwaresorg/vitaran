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

/** Show the enter-registration recovery panel for unread or duplicate rolls. */
export function canRecoverRoll(message: string) {
  return isRollUnreadError(message) || isDuplicateRollError(message);
}
