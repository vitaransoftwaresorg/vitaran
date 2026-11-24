import { prisma } from "../config/database.js";
import * as scanRepository from "../scan/repository.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { deleteObject } from "./object-storage.js";
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

export type OfferingSnapshot = {
  programId: string;
  programCode: string;
  programName: string;
  classLevels: number[];
};

export type ProgramRemap = {
  /** `${oldProgramId}:${classLevel}` → new programId */
  programIdBySlot: Map<string, string>;
  /** old catalog code → new catalog code when the swap is unambiguous */
  programCodeByOldCode: Map<string, string>;
  /** old catalog code → new program name */
  programNameByOldCode: Map<string, string>;
};

/**
 * When admin swaps catalog programs (e.g. INTEGRATED → NEWINTEGRATED), map each
 * removed program+class onto the replacement offering that covers that class.
 */
export function buildProgramRemap(
  previous: OfferingSnapshot[],
  next: OfferingSnapshot[],
): ProgramRemap {
  const programIdBySlot = new Map<string, string>();
  const programCodeByOldCode = new Map<string, string>();
  const programNameByOldCode = new Map<string, string>();

  const prevIds = new Set(previous.map((row) => row.programId));
  const nextIds = new Set(next.map((row) => row.programId));
  const added = next.filter((row) => !prevIds.has(row.programId));

  for (const prev of previous) {
    for (const classLevel of prev.classLevels) {
      const key = `${prev.programId}:${classLevel}`;
      const stillOffered = next.some(
        (row) => row.programId === prev.programId && row.classLevels.includes(classLevel),
      );
      if (stillOffered) {
        programIdBySlot.set(key, prev.programId);
        continue;
      }

      const fromAdded = added.filter((row) => row.classLevels.includes(classLevel));
      if (fromAdded.length === 1) {
        programIdBySlot.set(key, fromAdded[0]!.programId);
        continue;
      }

      // Last resort: exactly one remaining offering covers this class.
      const any = next.filter((row) => row.classLevels.includes(classLevel));
      if (any.length === 1) {
        programIdBySlot.set(key, any[0]!.programId);
      }
    }
  }

  for (const prev of previous) {
    if (nextIds.has(prev.programId)) continue;
    const targets = new Set<string>();
    for (const classLevel of prev.classLevels) {
      const target = programIdBySlot.get(`${prev.programId}:${classLevel}`);
      if (target && target !== prev.programId) targets.add(target);
    }
    if (targets.size !== 1) continue;
    const newId = [...targets][0]!;
    const neu = next.find((row) => row.programId === newId);
    if (!neu) continue;
    programCodeByOldCode.set(prev.programCode, neu.programCode);
    programNameByOldCode.set(prev.programCode, neu.programName);
  }

  return { programIdBySlot, programCodeByOldCode, programNameByOldCode };
}

function slotKey(programId: string, classLevel: number) {
  return `${programId}:${classLevel}`;
}

function resolveTargetProgramId(
  remap: ProgramRemap,
  programId: string,
  classLevel: number,
  next: OfferingSnapshot[],
) {
  const mapped = remap.programIdBySlot.get(slotKey(programId, classLevel));
  if (mapped) return mapped;
  if (next.some((row) => row.programId === programId && row.classLevels.includes(classLevel))) {
    return programId;
  }
  // Orphaned roster row (program no longer offered): unique new offering for this class.
  const candidates = next.filter((row) => row.classLevels.includes(classLevel));
  return candidates.length === 1 ? candidates[0]!.programId : null;
}

/**
 * Keep students, classes/sections, teachers, results, and school keys on the
 * same logical roster when school program offerings are replaced.
 */
export async function realignSchoolRosterToOfferings(
  schoolId: string,
  previous: OfferingSnapshot[],
  next: OfferingSnapshot[],
) {
  const remap = buildProgramRemap(previous, next);
  const nextIds = new Set(next.map((row) => row.programId));
  const needsPass =
    remap.programIdBySlot.size > 0 ||
    remap.programCodeByOldCode.size > 0 ||
    previous.some((row) => !nextIds.has(row.programId));
  if (!needsPass) {
    return { remapped: false as const };
  }

  await prisma.$transaction(async (tx) => {
    // Sections
    const sections = await tx.schoolSection.findMany({
      where: { schoolId },
      select: { id: true, programId: true, classLevel: true },
    });
    for (const row of sections) {
      const target = resolveTargetProgramId(remap, row.programId, row.classLevel, next);
      if (!target || target === row.programId) continue;
      await tx.schoolSection.update({
        where: { id: row.id },
        data: { programId: target },
      });
    }

    // Whole classes
    const wholes = await tx.schoolClass.findMany({
      where: { schoolId },
      select: { id: true, programId: true, classLevel: true },
    });
    for (const row of wholes) {
      const target = resolveTargetProgramId(remap, row.programId, row.classLevel, next);
      if (!target || target === row.programId) continue;
      await tx.schoolClass.update({
        where: { id: row.id },
        data: { programId: target },
      });
    }

    // Students
    const students = await tx.student.findMany({
      where: { schoolId },
      select: { id: true, programId: true, classLevel: true },
    });
    for (const row of students) {
      const target = resolveTargetProgramId(remap, row.programId, row.classLevel, next);
      if (!target || target === row.programId) continue;
      await tx.student.update({
        where: { id: row.id },
        data: { programId: target },
      });
    }

    // Class teachers (unique on school+program+class — skip if target slot taken)
    const classTeachers = await tx.classTeacher.findMany({
      where: { schoolId },
      select: { id: true, programId: true, classLevel: true, teacherId: true },
    });
    for (const row of classTeachers) {
      const target = resolveTargetProgramId(remap, row.programId, row.classLevel, next);
      if (!target || target === row.programId) continue;
      const clash = await tx.classTeacher.findFirst({
        where: { schoolId, programId: target, classLevel: row.classLevel },
        select: { id: true },
      });
      if (clash) {
        await tx.classTeacher.delete({ where: { id: row.id } });
        continue;
      }
      await tx.classTeacher.update({
        where: { id: row.id },
        data: { programId: target },
      });
    }

    // Teacher assignments
    const assignments = await tx.teacherAssignment.findMany({
      where: { teacher: { schoolId } },
      select: { id: true, teacherId: true, programId: true, classLevel: true, subject: true },
    });
    for (const row of assignments) {
      const target = resolveTargetProgramId(remap, row.programId, row.classLevel, next);
      if (!target || target === row.programId) continue;
      const clash = await tx.teacherAssignment.findFirst({
        where: {
          teacherId: row.teacherId,
          programId: target,
          classLevel: row.classLevel,
          subject: row.subject,
        },
        select: { id: true },
      });
      if (clash) {
        await tx.teacherAssignment.delete({ where: { id: row.id } });
        continue;
      }
      await tx.teacherAssignment.update({
        where: { id: row.id },
        data: { programId: target },
      });
    }

    // Result sets (programCode + programKey)
    for (const [oldCode, newCode] of remap.programCodeByOldCode) {
      const newName = remap.programNameByOldCode.get(oldCode) ?? null;
      const sets = await tx.resultSet.findMany({
        where: { schoolId, programCode: oldCode },
        select: { id: true, testNumber: true, programKey: true },
      });
      for (const set of sets) {
        const clash = await tx.resultSet.findFirst({
          where: {
            schoolId,
            programKey: newCode,
            testNumber: set.testNumber,
            NOT: { id: set.id },
          },
          select: { id: true },
        });
        if (clash) continue;
        await tx.resultSet.update({
          where: { id: set.id },
          data: {
            programCode: newCode,
            programName: newName,
            programKey: newCode,
          },
        });
      }
    }

    // School-owned answer keys
    for (const [oldCode, newCode] of remap.programCodeByOldCode) {
      await tx.answerKey.updateMany({
        where: { schoolId, programCode: oldCode },
        data: { programCode: newCode },
      });
    }

    // Customized teacher resources — remap program code when catalog swap is unambiguous.
    for (const [oldCode, newCode] of remap.programCodeByOldCode) {
      if (oldCode === newCode) continue;
      const rows = await tx.schoolStudentResource.findMany({
        where: { schoolId, programCode: oldCode },
        select: { id: true, classLevel: true, subject: true, data: true },
      });
      for (const row of rows) {
        const clash = await tx.schoolStudentResource.findFirst({
          where: {
            schoolId,
            programCode: newCode,
            classLevel: row.classLevel,
            subject: row.subject,
            NOT: { id: row.id },
          },
          select: { id: true },
        });
        if (clash) {
          // Target slot already has a PDF — drop the old program's copy.
          await deleteObject(row.data);
          await tx.schoolStudentResource.delete({ where: { id: row.id } });
          continue;
        }
        await tx.schoolStudentResource.update({
          where: { id: row.id },
          data: { programCode: newCode },
        });
      }
    }
  });

  notifyContentChanged({ kind: "students", schoolId });
  notifyContentChanged({ kind: "sections", schoolId });
  notifyContentChanged({ kind: "results", schoolId });
  notifyContentChanged({ kind: "answer-keys", schoolId });
  notifyContentChanged({ kind: "teachers", schoolId });

  return { remapped: true as const, remap };
}
