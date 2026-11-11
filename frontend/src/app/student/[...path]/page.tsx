import { redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";

/** Student portal login was removed. */
export default function StudentPortalRemoved() {
  redirect(SCHOOL_LOGIN_PATH);
}
