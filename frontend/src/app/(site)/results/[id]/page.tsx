import { redirect } from "next/navigation";

export default async function ResultRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ class?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const qs = query.class ? `?class=${encodeURIComponent(query.class)}` : "";
  redirect(`/teacher/results/${id}${qs}`);
}
