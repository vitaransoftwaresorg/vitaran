import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { SUBJECT_LABELS } from "@/features/schools/constants";
import { PublicAccessGuard } from "@/features/settings/public-access-guard";
import { programs } from "@/features/teachers-resources/content";
import { ResourcePage } from "@/features/teachers-resources/resource-page";
import { solutionBooks } from "@/features/teachers-resources/solution-books";
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

  return (
    <>
      <PublicAccessGuard flag="teacherResourcesPublic" />
      <ResourcePage
        title="Teachers"
        highlight="Resources"
        books={solutionBooks}
        programIds={programs.map((program) => program.id)}
        subjectIds={Object.keys(SUBJECT_LABELS)}
        label="Solution Books"
        emptyMessage="Solution books for this program will be available here soon."
      />
    </>
  );
}
