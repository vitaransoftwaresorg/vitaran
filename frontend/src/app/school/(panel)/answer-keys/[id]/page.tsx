import { redirect } from "next/navigation";
import { SCHOOL_ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";
import { documentAnswersHref } from "@/features/documents/constants";

/** `/school/answer-keys/:id` has no details view — Key corrections is the page. */
export default async function SchoolAnswerKeyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect(documentAnswersHref(SCHOOL_ANSWER_KEYS_PATH, (await params).id));
}
