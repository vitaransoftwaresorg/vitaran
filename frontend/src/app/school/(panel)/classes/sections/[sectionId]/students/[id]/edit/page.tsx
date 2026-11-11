import { redirect } from "next/navigation";

export default function LegacySectionStudentEditRedirect() {
  redirect("/school/classes");
}
