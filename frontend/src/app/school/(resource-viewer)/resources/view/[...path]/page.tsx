import { SolutionBookViewerPage } from "@/features/teachers-resources/solution-book-viewer";

type PageProps = { params: Promise<{ path: string[] }> };

export default async function SchoolSolutionBookViewPage({ params }: PageProps) {
  const { path } = await params;
  return <SolutionBookViewerPage pathParts={path ?? []} backHref="/school/resources" />;
}
