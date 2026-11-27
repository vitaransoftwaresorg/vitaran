import { redirect } from "next/navigation";
import { HEAD_OFFICE_LOGIN_PATH } from "@/constants/auth";

/** Legacy route — shared portal login lives on the marketing home. */
export default function HeadOfficeLoginPage() {
  redirect(HEAD_OFFICE_LOGIN_PATH);
}
