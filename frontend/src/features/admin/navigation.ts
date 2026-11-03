import {
  BookMarked,
  CirclePlus,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  ScanLine,
  School,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { readAnswerKeysReturnHref } from "@/features/answer-keys/drive-path";

export type AdminNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Schools",
    items: [
      { title: "Register School", href: "/admin/schools/new", icon: CirclePlus },
      { title: "Schools", href: "/admin/schools", icon: School },
      { title: "Students", href: "/admin/schools/students", icon: GraduationCap },
      { title: "Teachers", href: "/admin/teachers", icon: Users },
      { title: "Programs", href: "/admin/programs", icon: BookMarked },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Answer Keys", href: "/admin/answer-keys", icon: KeyRound },
      { title: "Results", href: "/admin/results", icon: Trophy },
      { title: "OMR Scan", href: "/admin/omr-scan", icon: ScanLine },
    ],
  },
];

const allItems = adminNavGroups.flatMap((group) => group.items);

function isStudentAdminPath(pathname: string) {
  return (
    pathname === "/admin/schools/students" ||
    pathname.startsWith("/admin/schools/students/") ||
    /^\/admin\/schools\/[^/]+\/students(\/|$)/.test(pathname)
  );
}

export function isNavItemActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin") return false;

  // Only Students should highlight on student pages (not Schools).
  if (href === "/admin/schools/students") {
    return isStudentAdminPath(pathname);
  }
  if (href === "/admin/schools") {
    if (isStudentAdminPath(pathname)) return false;
    if (pathname === "/admin/schools/new" || pathname.startsWith("/admin/schools/new/")) {
      return false;
    }
  }

  const longerMatch = allItems.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(href) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );

  return !longerMatch && pathname.startsWith(`${href}/`);
}

const SEGMENT_LABELS: Record<string, string> = {
  schools: "Schools",
  teachers: "Teachers",
  programs: "Programs",
  new: "Register",
  edit: "Edit",
  answers: "Answers",
  "answer-keys": "Answer Keys",
  upload: "Upload",
  results: "Results",
  "omr-scan": "OMR Scan",
  classes: "Classes",
  students: "Students",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function crumbLabel(segment: string, previous: string | undefined) {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  if (previous === "answer-keys") return "Key";
  return "Details";
}

export type AdminBreadcrumb = { label: string; href: string };

export function getAdminBreadcrumbs(pathname: string): AdminBreadcrumb[] {
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const crumbs: AdminBreadcrumb[] = [{ label: "Dashboard", href: "/admin" }];

  segments.forEach((segment, index) => {
    const previous = segments[index - 1];
    // `/admin/answer-keys/:id` is not a page — including it trapped Back and the Key crumb on Edit.
    if (previous === "answer-keys" && UUID.test(segment)) return;
    crumbs.push({
      label: crumbLabel(segment, previous),
      href: `/admin/${segments.slice(0, index + 1).join("/")}`,
    });
  });

  return crumbs;
}

/** Drive folders live in the query string, so pathname-only Back would skip to Dashboard. */
function adminDriveParentHref(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.has("test")) {
    params.delete("test");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }
  if (params.has("program") || params.has("school") || params.has("type")) {
    return pathname;
  }
  return getAdminBreadcrumbs(pathname).at(-2)?.href ?? null;
}

export function getAdminParentHref(pathname: string, search = ""): string | null {
  if (/^\/admin\/answer-keys\/[^/]+\/(edit|answers)$/.test(pathname)) {
    return readAnswerKeysReturnHref() ?? "/admin/answer-keys";
  }
  if (pathname === "/admin/answer-keys" || pathname === "/admin/results") {
    return adminDriveParentHref(pathname, search);
  }
  return getAdminBreadcrumbs(pathname).at(-2)?.href ?? null;
}
