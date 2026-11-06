/** Default section when a class has no named sections (whole class). */
export const DEFAULT_SECTION_NAME = "A";

/** Display name for a student/class section — whole class shows as A. */
export function displaySectionName(sectionName?: string | null) {
  const name = sectionName?.trim();
  return name && name.length > 0 ? name : DEFAULT_SECTION_NAME;
}

/** e.g. Class 8-A */
export function classWithSectionLabel(classLevel: number, sectionName?: string | null) {
  return `Class ${classLevel}-${displaySectionName(sectionName)}`;
}
