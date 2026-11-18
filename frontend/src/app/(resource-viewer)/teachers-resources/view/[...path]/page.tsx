import { redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { SolutionBookViewerPage } from "@/features/teachers-resources/solution-book-viewer";
import { getPublicSettings } from "@/services/settings";

type PageProps = { params: Promise<{ path: string[] }> };

export default async function PublicSolutionBookViewPage({ params }: PageProps) {
  const { teacherResourcesPublic } = await getPublicSettings().catch(() => ({
    teacherResourcesPublic: false,
  }));
  if (!teacherResourcesPublic) redirect(SCHOOL_LOGIN_PATH);

  const { path } = await params;
  return (
    <SolutionBookViewerPage pathParts={path ?? []} backHref="/teachers-resources" />
  );
}
