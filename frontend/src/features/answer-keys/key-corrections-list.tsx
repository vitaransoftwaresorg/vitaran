import { subjectLabel } from "@/features/schools/constants";
import type { AnswerKeyDetail } from "@/types/answer-key";

type KeyCorrectionsListProps = {
  answerKey: AnswerKeyDetail;
};

export function KeyCorrectionsList({ answerKey }: KeyCorrectionsListProps) {
  const corrections = answerKey.corrections ?? [];
  const subjectFor = (question: number) =>
    answerKey.subjectRanges.find((range) => question >= range.from && question <= range.to)?.subject;

  if (corrections.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        No key corrections yet. Follow the PDF.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-900">
          Key corrections · {corrections.length}
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Options and explanations admin saved for this test. Follow the PDF for every other question.
        </p>
      </header>
      <ol className="divide-y divide-neutral-100">
        {corrections.map((row) => (
          <li key={row.question} className="grid gap-2 px-4 py-3 md:grid-cols-[7rem_auto_minmax(0,1fr)] md:items-start">
            <div>
              <p className="text-sm font-bold text-neutral-800 tabular-nums">Q{row.question}</p>
              {subjectFor(row.question) && (
                <p className="text-[11px] text-neutral-500">{subjectLabel(subjectFor(row.question)!)}</p>
              )}
            </div>
            <p className="text-sm font-semibold text-neutral-900">{row.to ?? "—"}</p>
            <p className="whitespace-pre-wrap text-sm text-neutral-700">
              {row.explanation || <span className="text-neutral-400">No explanation</span>}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
