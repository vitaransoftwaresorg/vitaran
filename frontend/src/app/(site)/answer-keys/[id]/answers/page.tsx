import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { AnswerKeyPortalView } from "@/features/answer-keys/answer-key-portal-view";
import { AnswerKeyPdfActions } from "@/features/answer-keys/answer-key-pdf-actions";
import { programLabel } from "@/features/schools/constants";
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

  if (!answerKey.published) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-5 pt-24 pb-8 sm:px-8 sm:pt-26">
        <PublicAccessGuard flag="answerKeysPublic" />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-amber-950">Not Published</p>
          <p className="mt-1 text-sm text-amber-800">
            This answer key is not published yet. It will open here once it is published.
          </p>
        </div>
      </div>
    );
  }

  const questionCount =
    answerKey.subjectRanges.length > 0
      ? answerKey.subjectRanges.reduce(
          (sum, range) => sum + Math.max(0, range.to - range.from + 1),
          0,
        )
      : Object.keys(answerKey.answers).length;

  const meta = [
    { label: "Program", value: programLabel(answerKey.program, answerKey.programName) },
    { label: "Test", value: String(answerKey.testNumber) },
    ...(answerKey.testId ? [{ label: "Test ID", value: answerKey.testId }] : []),
    { label: "Class", value: String(answerKey.classLevel) },
    { label: "Questions", value: String(questionCount) },
    { label: "Correct", value: `+${answerKey.correctMarks}` },
    { label: "Wrong", value: `−${answerKey.wrongMarks}` },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-5 pt-24 pb-8 sm:px-8 sm:pt-26">
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
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {meta.map((item) => (
            <div
              key={item.label}
              className={item.label === "Program" ? "min-w-0 col-span-2 sm:col-span-1 xl:col-span-1" : "min-w-0"}
            >
              <dt className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                {item.label}
              </dt>
              <dd
                className={
                  item.label === "Program"
                    ? "text-sm font-bold break-words text-neutral-950"
                    : "truncate text-sm font-bold text-neutral-950 tabular-nums"
                }
                title={item.label === "Program" ? item.value : undefined}
              >
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
        allowObjections={false}
      />
    </div>
  );
}
