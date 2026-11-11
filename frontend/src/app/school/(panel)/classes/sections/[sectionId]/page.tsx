import { redirect } from "next/navigation";

export default function LegacySectionRedirect() {
  redirect("/school/classes");
}
