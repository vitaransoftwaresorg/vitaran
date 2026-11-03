import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";
import { AnswerKeyForm } from "@/features/answer-keys/answer-key-form";
import { documentAnswersHref } from "@/features/documents/constants";
import { getAnswerKey } from "@/services/answer-keys";
import { listAdminPrograms } from "@/services/programs";
import { listCustomizedSchoolOptions } from "@/services/schools";

export const metadata: Metadata = { title: "Edit Answer Key" };

export default async function EditAnswerKeyPage({ params }: PageProps<"/admin/answer-keys/[id]/edit">) {
  const { id } = await params;
  const [answerKey, schools, programs] = await Promise.all([
    getAnswerKey(id),
    listCustomizedSchoolOptions(),
    listAdminPrograms(),
  ]);
  if (!answerKey) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Edit answer key"
        description="Update the program, test or class. Use Edit answers to change options and explanations."
        actions={
          <Link href={documentAnswersHref(ANSWER_KEYS_PATH, id)} className={buttonVariants({ variant: "outline" })}>
            Edit answers
          </Link>
        }
      />
      <AnswerKeyForm schools={schools} programs={programs} answerKey={answerKey} />
    </div>
  );
}
