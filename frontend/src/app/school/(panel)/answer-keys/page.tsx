import { SCHOOL_ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";
import { PortalAnswerKeysBoard } from "@/features/answer-keys/portal-answer-keys-board";
import { verifySchoolSession } from "@/features/school-auth/session";
import { portalProgramIds } from "@/features/teachers-resources/portal-programs";

export default async function SchoolAnswerKeysPage() {
  const school = await verifySchoolSession();

  return (
    <PortalAnswerKeysBoard
      role="school"
      basePath={SCHOOL_ANSWER_KEYS_PATH}
      programIds={portalProgramIds(school.programCodes)}
      programNames={Object.fromEntries(
        school.schoolPrograms.map((program) => [program.programCode, program.programName]),
      )}
      ownerLabel={school.type === "CUSTOMIZED" ? school.name : undefined}
      description="Published answer keys for your programs."
    />
  );
}
