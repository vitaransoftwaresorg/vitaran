import { redirect } from "next/navigation";
import { TEACHER_ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";
import { documentAnswersHref } from "@/features/documents/constants";

/** `/teacher/answer-keys/:id` has no details view — Key corrections is the page. */
export default async function TeacherAnswerKeyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect(documentAnswersHref(TEACHER_ANSWER_KEYS_PATH, (await params).id));
}
