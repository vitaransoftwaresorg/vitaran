import * as answerKeyService from "./answer-key.service.js";
import * as resultService from "./result.service.js";
import * as schoolService from "./school.service.js";

/** Counts + slim recent schools for the admin home. No list payloads. */
export async function getAdminDashboard() {
  const [schools, answerKeys, results] = await Promise.all([
    schoolService.getSchoolStats(),
    answerKeyService.getAnswerKeyStats(),
    resultService.getResultStats(),
  ]);
  return { schools, answerKeys, results };
}
