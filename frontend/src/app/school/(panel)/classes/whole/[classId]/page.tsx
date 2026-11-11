import { redirect } from "next/navigation";

export default function LegacyWholeClassRedirect() {
  redirect("/school/classes");
}
