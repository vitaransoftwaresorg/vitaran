import { redirect } from "next/navigation";

export default function LegacySectionStudentRedirect() {
  redirect("/school/classes");
}
