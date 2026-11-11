import { redirect } from "next/navigation";

export default function LegacyStudentRedirect() {
  redirect("/school/classes");
}
