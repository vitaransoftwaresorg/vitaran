import {
  BookMarked,
  CirclePlus,
  GraduationCap,
  KeyRound,
  KeySquare,
  LayoutDashboard,
  MessageSquareWarning,
  ScanLine,
  School,
  Settings,
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
      { title: "School Keys", href: "/admin/school-keys", icon: KeySquare },
      { title: "Key Objections", href: "/admin/objections", icon: MessageSquareWarning },
      { title: "Results and Ranks", href: "/admin/results", icon: Trophy },
      { title: "OMR Scan", href: "/admin/omr-scan", icon: ScanLine },
    ],
  },
  {
    label: "System",
    items: [{ title: "Admin settings", href: "/admin/settings", icon: Settings }],
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
  answers: "Enter answers",
  enter: "Enter marks",
  "answer-keys": "Answer Keys",
  "school-keys": "School Keys",
  objections: "Key Objections",
  upload: "Upload",
  results: "Results and Ranks",
  "omr-scan": "OMR Scan",
  classes: "Classes",
  students: "Students",
  settings: "Admin settings",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function crumbLabel(segment: string, previous: string | undefined) {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  if (previous === "answer-keys" || previous === "school-keys") return "Key";
  return "Details";
}

export type AdminBreadcrumb = { label: string; href: string };

export function getAdminBreadcrumbs(pathname: string): AdminBreadcrumb[] {
  const crumbs: AdminBreadcrumb[] = [{ label: "Dashboard", href: "/admin" }];

  // URL is /admin/schools/students, but Students is a sibling of Schools in the sidebar —
  // do not insert a clickable "Schools" crumb that jumps to the schools list.
  if (pathname === "/admin/schools/students" || pathname.startsWith("/admin/schools/students/")) {
    crumbs.push({ label: "Students", href: "/admin/schools/students" });
    const rest = pathname
      .slice("/admin/schools/students".length)
      .split("/")
      .filter(Boolean);
    rest.forEach((segment, index) => {
      if (UUID.test(segment)) return;
      const previous = rest[index - 1];
      crumbs.push({
        label: crumbLabel(segment, previous),
        href: `/admin/schools/students/${rest.slice(0, index + 1).join("/")}`,
      });
    });
    return crumbs;
  }

  const segments = pathname.split("/").filter(Boolean).slice(1);

  segments.forEach((segment, index) => {
    const previous = segments[index - 1];
    // UUID detail ids are resolved by name in the top nav (school / program / answer key).
    if (previous === "answer-keys" && UUID.test(segment)) return;
    if (previous === "school-keys" && UUID.test(segment)) return;
    if (previous === "programs" && UUID.test(segment)) return;
    if (previous === "schools" && UUID.test(segment)) return;
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
  if (/^\/admin\/school-keys\/[^/]+\/answers$/.test(pathname)) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const from = params.get("from");
    return from && from.startsWith("/admin/school-keys") ? from : "/admin/school-keys";
  }
  // Class enter board — back to the school’s test folder (school-first drive).
  if (pathname === "/admin/results/enter") {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    params.delete("class");
    params.delete("program");
    const query = params.toString();
    return query ? `/admin/results?${query}` : "/admin/results";
  }
  // Students drive: class → school → schools list.
  if (pathname === "/admin/schools/students") {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (params.has("class") || params.has("section")) {
      params.delete("class");
      params.delete("section");
      const query = params.toString();
      return query ? `/admin/schools/students?${query}` : "/admin/schools/students";
    }
    if (params.has("school")) return "/admin/schools/students";
    return "/admin";
  }
  // Teachers drive: school roster → schools list.
  if (pathname === "/admin/teachers") {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (params.has("school") || params.has("schoolId")) return "/admin/teachers";
    return "/admin";
  }
  // Add teacher lives under /schools/:id/teachers/new — back to the school’s teachers drive.
  const addTeacherMatch = pathname.match(/^\/admin\/schools\/([^/]+)\/teachers\/new$/);
  if (addTeacherMatch) {
    return `/admin/teachers?school=${encodeURIComponent(addTeacherMatch[1])}`;
  }
  if (pathname === "/admin/answer-keys" || pathname === "/admin/results") {
    return adminDriveParentHref(pathname, search);
  }
  if (pathname === "/admin/school-keys") {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (params.has("section") || params.has("class")) {
      params.delete("section");
      params.delete("class");
      const query = params.toString();
      return query ? `/admin/school-keys?${query}` : "/admin/school-keys";
    }
    if (params.has("test")) {
      params.delete("test");
      const query = params.toString();
      return query ? `/admin/school-keys?${query}` : "/admin/school-keys";
    }
    if (params.has("school")) return "/admin/school-keys";
    return "/admin";
  }
  return getAdminBreadcrumbs(pathname).at(-2)?.href ?? null;
}
