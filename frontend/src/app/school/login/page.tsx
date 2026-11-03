import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BookOpenCheck, ClipboardCheck, School2, Trophy } from "lucide-react";
import {
  SCHOOL_HOME_PATH,
  SCHOOL_SESSION_COOKIE,
  TEACHER_HOME_PATH,
  TEACHER_SESSION_COOKIE,
} from "@/constants/auth";
import { AuthShell } from "@/features/auth/auth-shell";
import { googleErrorMessage } from "@/features/auth/google-errors";
import { PortalLoginForm } from "@/features/auth/portal-login-form";

export const metadata: Metadata = {
  title: "Portal Sign In",
};

const highlights = [
  {
    icon: BookOpenCheck,
    title: "Resources",
    description: "Solution books for every program and assigned class.",
  },
  {
    icon: ClipboardCheck,
    title: "Answer keys",
    description: "Published answer keys for your school or classes.",
  },
  {
    icon: Trophy,
    title: "Results",
    description: "Test results for your school and assigned classes.",
  },
  {
    icon: School2,
    title: "Classes",
    description: "Teachers, sections and students for your school.",
  },
];

export default async function PortalLoginPage({
  searchParams,
}: PageProps<"/school/login">) {
  // Cookie presence is enough here; the panel layouts verify the token.
  const cookieStore = await cookies();
  if (cookieStore.has(SCHOOL_SESSION_COOKIE)) redirect(SCHOOL_HOME_PATH);
  if (cookieStore.has(TEACHER_SESSION_COOKIE)) redirect(TEACHER_HOME_PATH);
  const { error } = await searchParams;

  return (
    <AuthShell
      badge="School & teacher portal"
      title={
        <>
          Sign in to your <span className="text-gradient">portal</span>
        </>
      }
      description="One login for schools and teachers. Continue with Google only if that Gmail is already on the account."
      highlights={highlights}
      footnote="Use the login details shared by Vitaran or your school."
    >
      <PortalLoginForm googleError={googleErrorMessage(error)} />
    </AuthShell>
  );
}
