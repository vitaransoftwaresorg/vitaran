import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveAnswerKeyViewer } from "@/features/answer-keys/live-answer-key-viewer";
import { getTeacherAnswerKey } from "@/services/answer-keys";

export const metadata: Metadata = { title: "Answer key" };
export const maxDuration = 300;

export default async function TeacherAnswerKeyAnswersPage({
  params,
}: PageProps<"/teacher/answer-keys/[id]/answers">) {
  const { id } = await params;
  const answerKey = await getTeacherAnswerKey(id);
  if (!answerKey) notFound();

  return (
    <div className="w-full">
      <LiveAnswerKeyViewer role="teacher" answerKey={answerKey} />
    </div>
  );
}
