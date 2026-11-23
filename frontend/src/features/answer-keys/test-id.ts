/** Add key used to fill PROGRAM[-xxxxxxxx]-C6-T1. Those are not real test IDs. */
const GENERATED_TEST_ID = /^[A-Z0-9_]+(?:-[a-f0-9]{8})?-C\d{1,2}-T\d{1,2}$/i;

export function enteredTestId(testId: string | null | undefined) {
  const value = testId?.trim() ?? "";
  return value && !GENERATED_TEST_ID.test(value) ? value : "";
}

export const TEST_ID_MIN_LENGTH = 6;
export const TEST_ID_MAX_LENGTH = 7;
/** @deprecated Prefer TEST_ID_MAX_LENGTH — kept for maxLength props. */
export const TEST_ID_LENGTH = TEST_ID_MAX_LENGTH;
export const TEST_ID_PATTERN = /^\d{6,7}$/;
export const TEST_ID_MESSAGE = "Test ID must be 6 or 7 digits.";

/** Keeps only digits, capped at 7, as the admin types. */
export const testIdDigits = (value: string) => value.replace(/\D/g, "").slice(0, TEST_ID_MAX_LENGTH);
