import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  ADMIN_BASE_PATH,
  ADMIN_SESSION_COOKIE,
  SCHOOL_HOME_PATH,
  SCHOOL_SESSION_COOKIE,
  TEACHER_HOME_PATH,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();

  // Signed-in users stay in their portal until they log out — no public landing.
  if (jar.has(ADMIN_SESSION_COOKIE)) redirect(ADMIN_BASE_PATH);
  if (jar.has(SCHOOL_SESSION_COOKIE)) redirect(SCHOOL_HOME_PATH);
  if (jar.has(TEACHER_SESSION_COOKIE)) redirect(TEACHER_HOME_PATH);

  return (
    <>
      <SiteHeader session={null} />
      <main className="bg-white">{children}</main>
      <SiteFooter />
    </>
  );
}
