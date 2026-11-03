import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnswerKeyAnswersEditor } from "@/features/answer-keys/answer-key-answers-editor";
import { customizedOwnerLabel } from "@/features/schools/constants";
import { getAnswerKey } from "@/services/answer-keys";
import { listAdminPrograms } from "@/services/programs";

export const metadata: Metadata = { title: "Edit answers" };
export const maxDuration = 300;

export default async function AnswerKeyAnswersPage({
  params,
}: PageProps<"/admin/answer-keys/[id]/answers">) {
  const { id } = await params;
  const [answerKey, programs] = await Promise.all([getAnswerKey(id), listAdminPrograms()]);
  if (!answerKey) notFound();

  const program = programs.find((row) => row.code === answerKey.program);
  const heading = [
    customizedOwnerLabel(answerKey, program),
    `Test ${answerKey.testNumber}`,
    `Class ${answerKey.classLevel}`,
  ].join(" · ");

  return (
    <div className="w-full">
      <AnswerKeyAnswersEditor answerKey={answerKey} heading={heading} />
    </div>
  );
}
