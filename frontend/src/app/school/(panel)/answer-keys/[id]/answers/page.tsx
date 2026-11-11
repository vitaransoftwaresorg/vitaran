import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveAnswerKeyViewer } from "@/features/answer-keys/live-answer-key-viewer";
import { getSchoolAnswerKey } from "@/services/answer-keys";

export const metadata: Metadata = { title: "Answer key" };
export const maxDuration = 300;

export default async function SchoolAnswerKeyAnswersPage({
  params,
}: PageProps<"/school/answer-keys/[id]/answers">) {
  const { id } = await params;
  const answerKey = await getSchoolAnswerKey(id);
  if (!answerKey) notFound();

  return (
    <div className="w-full">
      <LiveAnswerKeyViewer role="school" answerKey={answerKey} />
    </div>
  );
}
