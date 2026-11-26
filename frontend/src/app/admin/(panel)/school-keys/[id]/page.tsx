import { redirect } from "next/navigation";
import { SCHOOL_KEYS_PATH } from "@/features/answer-keys/constants";

/** `/admin/school-keys/:id` is not a page — send leftover links to the school keys drive. */
export default async function SchoolKeyPage() {
  redirect(SCHOOL_KEYS_PATH);
}
