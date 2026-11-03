/** Add key used to fill PROGRAM[-xxxxxxxx]-C6-T1. Those are not real test IDs. */
const GENERATED_TEST_ID = /^[A-Z0-9_]+(?:-[a-f0-9]{8})?-C\d{1,2}-T\d{1,2}$/i;

export function enteredTestId(testId: string | null | undefined) {
  const value = testId?.trim() ?? "";
  return value && !GENERATED_TEST_ID.test(value) ? value : "";
}
