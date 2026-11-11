import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ProfilePortal = "admin" | "school" | "teacher";

/** Student profile by id, in the signed-in portal. */
export const studentProfileHref = (portal: ProfilePortal, id: string) =>
  portal === "admin" ? `/admin/schools/students/${id}` : `/${portal}/students/${id}`;

/** Student profile by registration number (result sheets only know the roll). */
export const studentRollHref = (portal: ProfilePortal, roll: string, schoolId?: string) => {
  const base = portal === "admin" ? "/admin/schools/students/roll" : `/${portal}/students/roll`;
  const query = portal === "admin" && schoolId ? `?school=${encodeURIComponent(schoolId)}` : "";
  return `${base}/${encodeURIComponent(roll.trim())}${query}`;
};

export const teacherProfileHref = (portal: "admin" | "school", id: string) =>
  portal === "admin" ? `/admin/teachers/${id}` : `/school/teachers/${id}`;

export const schoolProfileHref = (id: string) => `/admin/schools/${id}`;

export const PROFILE_LINK_CLASS =
  "font-medium text-brand-700 underline decoration-brand-300 underline-offset-[3px] transition-colors hover:text-brand-900 hover:decoration-brand-700";

/** Names and registration numbers in tables: always look like links to the profile. */
export function ProfileLink({
  href,
  children,
  className,
  title,
}: {
  href: string | null | undefined;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  if (!href) return <span className={cn("font-medium text-neutral-950", className)}>{children}</span>;
  return (
    <Link
      href={href}
      title={title}
      prefetch={false}
      className={cn(PROFILE_LINK_CLASS, className)}
    >
      {children}
    </Link>
  );
}
