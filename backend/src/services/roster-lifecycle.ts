import * as scanRepository from "../scan/repository.js";
import { notifyContentChanged } from "../utils/content-events.js";
import * as resultService from "./result.service.js";

/**
 * Single school roster is the source of truth for students everywhere
 * (Students, Results, OMR, ranks, reports).
 * Call this whenever rolls leave the roster so dependent data is removed too.
 */
export async function removeRollsFromSchoolData(schoolId: string, rollNos: string[]) {
  const rolls = [...new Set(rollNos.map((roll) => roll.trim()).filter(Boolean))];
  if (rolls.length === 0) return;

  await resultService.purgeRollsFromResults(schoolId, rolls);
  await scanRepository.deleteOmScansByRolls(schoolId, rolls);
  notifyContentChanged({ kind: "students", schoolId });
}

/** Class removed from school setup — drop that class's roster rows from results/OMR too. */
export async function removeClassFromSchoolData(
  schoolId: string,
  classLevel: number,
  programCode?: string | null,
) {
  await resultService.purgeClassFromResults(schoolId, classLevel, programCode ?? undefined);
  await scanRepository.deleteOmScansByClass(schoolId, classLevel);
  notifyContentChanged({ kind: "students", schoolId });
}
