import { subjectsForClassLevel } from "@/features/schools/constants";
import { programs } from "@/features/teachers-resources/content";

export type RegularResourceSlot = {
  programCode: string;
  programTitle: string;
  classLevel: number;
  subject: string;
  volume: number;
};

/** Upload slots for each regular program (class × subject × volume). */
export function regularResourceSlots(): RegularResourceSlot[] {
  const slots: RegularResourceSlot[] = [];
  for (const program of programs) {
    const classFrom = program.id === "OLYMPIAD_PRIMARY" ? 1 : 6;
    const classTo = program.id === "OLYMPIAD_PRIMARY" ? 5 : 10;
    const volumes = program.id === "OLYMPIAD" ? [1, 2] : [0];
    for (let classLevel = classFrom; classLevel <= classTo; classLevel++) {
      for (const subject of subjectsForClassLevel(classLevel)) {
        for (const volume of volumes) {
          // Olympiad vol 2 chemistry skips class 7 (matches legacy catalog).
          if (
            program.id === "OLYMPIAD" &&
            volume === 2 &&
            subject === "CHEMISTRY" &&
            classLevel === 7
          ) {
            continue;
          }
          // Olympiad biology only through class 8.
          if (program.id === "OLYMPIAD" && subject === "BIOLOGY" && classLevel > 8) {
            continue;
          }
          slots.push({
            programCode: program.id,
            programTitle: program.title,
            classLevel,
            subject,
            volume,
          });
        }
      }
    }
  }
  return slots;
}
