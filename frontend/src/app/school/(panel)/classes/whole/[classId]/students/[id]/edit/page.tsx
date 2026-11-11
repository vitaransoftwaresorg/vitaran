import { redirect } from "next/navigation";

export default function LegacyWholeStudentEditRedirect() {
  redirect("/school/classes");
}
