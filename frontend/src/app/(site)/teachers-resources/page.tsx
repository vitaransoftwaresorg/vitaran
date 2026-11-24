import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { SUBJECT_LABELS } from "@/features/schools/constants";
import { PublicAccessGuard } from "@/features/settings/public-access-guard";
import { programs } from "@/features/teachers-resources/content";
import { loadSolutionBooksFromDb } from "@/features/teachers-resources/load-solution-books";
import { ResourcePage } from "@/features/teachers-resources/resource-page";
import { getPublicSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teachers Resources",
  description:
    "Solution books for the Integrated, Advanced, Revised Advanced and Olympiad programs.",
};

export default async function TeachersResourcesPage() {
  const { teacherResourcesPublic } = await getPublicSettings();
  if (!teacherResourcesPublic) {
    redirect(SCHOOL_LOGIN_PATH);
  }
  const books = await loadSolutionBooksFromDb();

  return (
    <>
      <PublicAccessGuard flag="teacherResourcesPublic" />
      <ResourcePage
        title="Teachers"
        highlight="Resources"
        books={books}
        programIds={programs.map((program) => program.id)}
        subjectIds={Object.keys(SUBJECT_LABELS)}
        label="Solution Books"
        emptyMessage="Solution books for this program will be available here soon."
      />
    </>
  );
}
