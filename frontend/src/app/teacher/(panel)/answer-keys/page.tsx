import { TEACHER_ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";
import { PortalAnswerKeysBoard } from "@/features/answer-keys/portal-answer-keys-board";
import { verifyTeacherSession } from "@/features/teacher-auth/session";
import { portalProgramIds } from "@/features/teachers-resources/portal-programs";

export default async function TeacherAnswerKeysPage() {
  const teacher = await verifyTeacherSession();

  const programCodes = portalProgramIds(
    teacher.school.type === "CUSTOMIZED" || teacher.assignments.length === 0
      ? teacher.school.programCodes
      : [...new Set(teacher.assignments.map((row) => row.programCode))],
  );
  const programNames = Object.fromEntries([
    ...teacher.school.schoolPrograms.map((program) => [program.programCode, program.programName] as const),
    ...teacher.assignments.map((row) => [row.programCode, row.programName] as const),
  ]);

  return (
    <PortalAnswerKeysBoard
      role="teacher"
      basePath={TEACHER_ANSWER_KEYS_PATH}
      programIds={programCodes}
      programNames={programNames}
      ownerLabel={teacher.school.type === "CUSTOMIZED" ? teacher.school.name : undefined}
      description="Published answer keys for your assigned classes."
    />
  );
}
