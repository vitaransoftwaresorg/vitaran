import { SCHOOL_ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";
import { PortalAnswerKeysBoard } from "@/features/answer-keys/portal-answer-keys-board";
import { verifySchoolSession } from "@/features/school-auth/session";
import {
  contentSlotsFromSchool,
  programCodesFromSlots,
} from "@/features/schools/content-slots";
import { portalProgramIds } from "@/features/teachers-resources/portal-programs";
import { listSchoolClassOrganization } from "@/services/sections";

export default async function SchoolAnswerKeysPage() {
  const school = await verifySchoolSession();
  const organization = await listSchoolClassOrganization();
  const slots = contentSlotsFromSchool(school.schoolPrograms, organization);
  const programCodes = programCodesFromSlots(slots);

  return (
    <PortalAnswerKeysBoard
      role="school"
      basePath={SCHOOL_ANSWER_KEYS_PATH}
      programIds={portalProgramIds(programCodes)}
      programNames={Object.fromEntries(
        slots.map((slot) => [slot.programCode, slot.programName]),
      )}
      ownerLabel={school.type === "CUSTOMIZED" ? school.name : undefined}
      description="Published answer keys for your programs and classes."
    />
  );
}
