/**
 * True when the PDF base name contains `testNumber` as a whole number
 * (not embedded in a longer digit run like 56 or 15).
 *
 * Accepts: "v school t -5.pdf", "v school 5.pdf", "schoolsrk5.pdf"
 * Rejects: "school srk56.pdf", "sschool srk.pdf", "achool srk7.pdf"
 */
export function fileNameHasTestNumber(fileName: string, testNumber: number): boolean {
  if (!Number.isInteger(testNumber) || testNumber < 1) return false;
  const base = fileName.replace(/\.[^.\\/]+$/, "");
  const needle = String(testNumber);
  return new RegExp(`(^|\\D)${needle}(\\D|$)`).test(base);
}
