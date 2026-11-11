import { redirect } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";

export default async function GoogleAuthErrorPage({
  searchParams,
}: PageProps<"/auth/google/error">) {
  const { error } = await searchParams;
  const code = typeof error === "string" && error ? error : "google";
  redirect(`${SCHOOL_LOGIN_PATH}?error=${encodeURIComponent(code)}`);
}
