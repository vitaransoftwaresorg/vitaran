import { SchoolType } from "../generated/prisma/enums.js";
import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import { asAnswers } from "../utils/answer-key-parse.js";

type KeyRow = Awaited<ReturnType<typeof answerKeyRepository.findAnswerKeys>>[number];

function keyHasAnswers(key: { answers: unknown }) {
  return Object.keys(asAnswers(key.answers)).length > 0;
}

/**
 * School key answers overlay the platform key for the same questions.
 * Example: Biology filled on the school key, Maths/Physics/Chemistry from platform.
 * Layout / marks / subject ranges stay on the platform key.
 */
export function mergePlatformAndSchoolKey<T extends KeyRow>(platform: T, school: T): T {
  return {
    ...platform,
    id: school.id,
    schoolId: school.schoolId,
    school: school.school,
    sectionId: school.sectionId,
    section: school.section,
    type: school.type,
    answers: {
      ...asAnswers(platform.answers),
      ...asAnswers(school.answers),
    },
    published: school.published || platform.published,
  };
}

/** Platform REGULAR key for the same test / class / program as a school override. */
export async function findPlatformKeyFor(schoolKey: KeyRow): Promise<KeyRow | null> {
  if (!schoolKey.testId?.trim()) return null;
  const keys = await answerKeyRepository.findAnswerKeys({
    schoolId: null,
    type: SchoolType.REGULAR,
    testId: { equals: schoolKey.testId.trim(), mode: "insensitive" },
    classLevel: schoolKey.classLevel,
    programCode: schoolKey.programCode,
    sectionId: null,
  });
  return keys.find((key) => keyHasAnswers(key)) ?? keys[0] ?? null;
}

/** Score with platform + school answers when the stored key is a school override. */
export async function scoringKeyForStored(key: KeyRow): Promise<KeyRow> {
  if (!key.schoolId) return key;
  const platform = await findPlatformKeyFor(key);
  if (!platform) return key;
  return mergePlatformAndSchoolKey(platform, key);
}
