import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { AnswerKeyForm } from "@/features/answer-keys/answer-key-form";
import { listAdminPrograms } from "@/services/programs";
import { listCustomizedSchoolOptions } from "@/services/schools";

export const metadata: Metadata = { title: "Add Answer Key" };
export const maxDuration = 300;

export default async function UploadAnswerKeyPage() {
  const [schools, programs] = await Promise.all([
    listCustomizedSchoolOptions(),
    listAdminPrograms(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Add answer key"
        description="Choose the program, type, test and class, then fill 100 questions with A, B, C, D or ADD plus explanations."
      />
      <AnswerKeyForm schools={schools} programs={programs} />
    </div>
  );
}
