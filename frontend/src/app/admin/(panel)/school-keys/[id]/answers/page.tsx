import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnswerKeyAnswersEditor } from "@/features/answer-keys/answer-key-answers-editor";
import { SCHOOL_KEYS_PATH } from "@/features/answer-keys/constants";
import { SchoolKeyNavTrail } from "@/features/answer-keys/school-key-nav-trail";
import { displaySectionName } from "@/features/schools/section-label";
import { getAnswerKey } from "@/services/answer-keys";
import { listAdminPrograms } from "@/services/programs";

export const metadata: Metadata = { title: "School key answers" };
export const maxDuration = 300;

export default async function SchoolKeyAnswersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [answerKey, programs] = await Promise.all([getAnswerKey(id), listAdminPrograms()]);
  // Deleted or missing school keys — return to the drive instead of a hard 404.
  if (!answerKey || !answerKey.school) redirect(SCHOOL_KEYS_PATH);

  const program = programs.find((row) => row.code === answerKey.program);
  const sectionLabel = answerKey.section
    ? `Class ${answerKey.classLevel}-${displaySectionName(answerKey.section.name)}`
    : `Class ${answerKey.classLevel}`;
  const heading = [
    answerKey.school.name,
    sectionLabel,
    program?.name ?? answerKey.program,
    `Test ${answerKey.testNumber}`,
  ].join(" · ");

  return (
    <div className="w-full">
      <SchoolKeyNavTrail
        school={answerKey.school}
        programCode={answerKey.program}
        programName={program?.name}
        classLevel={answerKey.classLevel}
        section={answerKey.section}
        testNumber={answerKey.testNumber}
      />
      <AnswerKeyAnswersEditor answerKey={answerKey} heading={heading} />
    </div>
  );
}
