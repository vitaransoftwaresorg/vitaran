import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { AnswerKeyPortalView } from "@/features/answer-keys/answer-key-portal-view";
import { AnswerKeyPdfActions } from "@/features/answer-keys/answer-key-pdf-actions";
import { PublicAccessGuard } from "@/features/settings/public-access-guard";
import { getPublicAnswerKey } from "@/services/answer-keys";
import { getPublicSettings } from "@/services/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Answer key" };

export default async function PublicAnswerKeyAnswersPage({
  params,
}: PageProps<"/answer-keys/[id]/answers">) {
  const { answerKeysPublic } = await getPublicSettings();
  if (!answerKeysPublic) {
    redirect(SCHOOL_LOGIN_PATH);
  }

  const { id } = await params;
  const answerKey = await getPublicAnswerKey(id);
  if (!answerKey) notFound();

  const questionCount =
    answerKey.subjectRanges.length > 0
      ? answerKey.subjectRanges.reduce(
          (sum, range) => sum + Math.max(0, range.to - range.from + 1),
          0,
        )
      : Object.keys(answerKey.answers).length;

  const meta = [
    { label: "Test", value: String(answerKey.testNumber) },
    ...(answerKey.testId ? [{ label: "Test ID", value: answerKey.testId }] : []),
    { label: "Class", value: String(answerKey.classLevel) },
    { label: "Questions", value: String(questionCount) },
    { label: "Correct", value: `+${answerKey.correctMarks}` },
    { label: "Wrong", value: `−${answerKey.wrongMarks}` },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-5 py-8 sm:px-8">
      <PublicAccessGuard flag="answerKeysPublic" />
      <header className="rounded-xl border border-brand-200 bg-white px-3 py-3 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)] sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
            Answer key
          </p>
          <AnswerKeyPdfActions
            basePath="/answer-keys"
            id={answerKey.id}
            disabled={Object.keys(answerKey.answers).length === 0}
            className="w-full sm:w-auto"
          />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
          {meta.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                {item.label}
              </dt>
              <dd className="truncate text-sm font-bold text-neutral-950 tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <AnswerKeyPortalView
        answerKey={answerKey}
        role="teacher"
        objections={[]}
        onRaiseObjection={() => undefined}
        allowObjections={false}
      />
    </div>
  );
}
