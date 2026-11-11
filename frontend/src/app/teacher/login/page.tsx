import { redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";

/** Teacher login uses the shared school/teacher portal. */
export default function TeacherLoginRedirectPage() {
  redirect(SCHOOL_LOGIN_PATH);
}
