import { redirect } from "next/navigation";
import { ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";

/** `/admin/answer-keys/:id` is not a page — send leftover links to the table, not back to Edit. */
export default async function AnswerKeyPage() {
  redirect(ANSWER_KEYS_PATH);
}
