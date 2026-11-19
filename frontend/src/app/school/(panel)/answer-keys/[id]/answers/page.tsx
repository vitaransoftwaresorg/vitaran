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

  if (!answerKey.published) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-amber-950">Not Published</p>
        <p className="mt-1 text-sm text-amber-800">
          This answer key is not published yet. It will open here once the admin publishes it.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <LiveAnswerKeyViewer role="school" answerKey={answerKey} />
    </div>
  );
}
