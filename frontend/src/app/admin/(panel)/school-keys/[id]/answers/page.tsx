import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnswerKeyAnswersEditor } from "@/features/answer-keys/answer-key-answers-editor";
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
  if (!answerKey || !answerKey.school) notFound();

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
      <AnswerKeyAnswersEditor answerKey={answerKey} heading={heading} />
    </div>
  );
}
