/** Add key used to fill PROGRAM[-xxxxxxxx]-C6-T1. Those are not real test IDs. */
const GENERATED_TEST_ID = /^[A-Z0-9_]+(?:-[a-f0-9]{8})?-C\d{1,2}-T\d{1,2}$/i;

export function enteredTestId(testId: string | null | undefined) {
  const value = testId?.trim() ?? "";
  return value && !GENERATED_TEST_ID.test(value) ? value : "";
}

export const TEST_ID_LENGTH = 6;
export const TEST_ID_PATTERN = /^\d{6}$/;
export const TEST_ID_MESSAGE = "Test ID must be exactly 6 digits.";

/** Keeps only digits, capped at 6, as the admin types. */
export const testIdDigits = (value: string) => value.replace(/\D/g, "").slice(0, TEST_ID_LENGTH);
