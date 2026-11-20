import { TEACHER_ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";
import { PortalAnswerKeysBoard } from "@/features/answer-keys/portal-answer-keys-board";
import {
  contentSlotsFromSchool,
  programCodesFromSlots,
} from "@/features/schools/content-slots";
import { verifyTeacherSession } from "@/features/teacher-auth/session";
import { portalProgramIds } from "@/features/teachers-resources/portal-programs";
import { listTeacherClassOrganization } from "@/services/sections";

export default async function TeacherAnswerKeysPage() {
  const teacher = await verifyTeacherSession();
  const organization = await listTeacherClassOrganization();

  const schoolSlots = contentSlotsFromSchool(teacher.school.schoolPrograms, organization);
  const teacherKeys = new Set([
    ...teacher.assignments.map((row) => `${row.programCode}:${row.classLevel}`),
    ...teacher.classTeacherSections.map((row) => `${row.programCode}:${row.classLevel}`),
  ]);
  const slots = schoolSlots.filter((slot) =>
    teacherKeys.has(`${slot.programCode}:${slot.classLevel}`),
  );
  const programCodes = programCodesFromSlots(slots);

  return (
    <PortalAnswerKeysBoard
      role="teacher"
      basePath={TEACHER_ANSWER_KEYS_PATH}
      programIds={portalProgramIds(programCodes)}
      programNames={Object.fromEntries(
        slots.map((slot) => [slot.programCode, slot.programName]),
      )}
      ownerLabel={
        teacher.school.type === "CUSTOMIZED" ? teacher.school.name : undefined
      }
      description="Published answer keys for your assigned programs and classes."
    />
  );
}
