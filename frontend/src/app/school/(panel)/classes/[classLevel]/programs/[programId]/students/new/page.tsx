import { redirect } from "next/navigation";

export default function LegacyNewStudentRedirect() {
  redirect("/school/classes");
}
