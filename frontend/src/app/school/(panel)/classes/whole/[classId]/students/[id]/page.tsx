import { redirect } from "next/navigation";

export default function LegacyWholeStudentRedirect() {
  redirect("/school/classes");
}
