import { redirect } from "next/navigation";

export default function LegacyWholeStudentNewRedirect() {
  redirect("/school/classes");
}