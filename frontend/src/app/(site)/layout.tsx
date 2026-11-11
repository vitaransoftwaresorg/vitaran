import { cookies } from "next/headers";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  SCHOOL_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  // Cookie presence is enough for the header; protected pages verify the token itself.
  const jar = await cookies();
  const schoolIn = jar.has(SCHOOL_SESSION_COOKIE);
  const teacherIn = jar.has(TEACHER_SESSION_COOKIE);
  const session = schoolIn
    ? ({ kind: "school" as const })
    : teacherIn
      ? ({ kind: "teacher" as const })
      : null;

  return (
    <>
      <SiteHeader session={session} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
