import { redirect } from "next/navigation";
import { portalLoginHref } from "@/constants/auth";

export default async function GoogleAuthErrorPage({
  searchParams,
}: PageProps<"/auth/google/error">) {
  const { error } = await searchParams;
  const code = typeof error === "string" && error ? error : "google";
  redirect(portalLoginHref(code));
}
