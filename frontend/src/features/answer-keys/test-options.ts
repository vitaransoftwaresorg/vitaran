import { classLevelsFromProgram } from "@/features/schools/constants";

export { classLevelsFromProgram };

/** How many Test No options to show for a catalog program code. */
export function testNumberCountForProgram(_programCode?: string): number {
  return 18;
}

export function testNumberItemsForProgram(programCode: string | undefined) {
  const count = testNumberCountForProgram(programCode);
  return Array.from({ length: count }, (_, index) => {
    const value = String(index + 1);
    return { value, label: `Test ${value}` };
  });
}

export function classItemsFromLevels(levels: number[]) {
  return [...new Set(levels)]
    .sort((a, b) => a - b)
    .map((level) => ({ value: String(level), label: `Class ${level}` }));
}
