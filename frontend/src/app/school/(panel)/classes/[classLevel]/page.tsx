import { redirect } from "next/navigation";

/** Old class-level drill-down — Classes board is the entry now. */
export default function LegacyClassLevelRedirect() {
  redirect("/school/classes");
}
