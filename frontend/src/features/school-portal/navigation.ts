import {
  BookOpen,
  KeyRound,
  LayoutDashboard,
  ScanLine,
  School2,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SchoolNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type SchoolNavGroup = {
  label: string;
  items: SchoolNavItem[];
};

export const schoolNavGroups: SchoolNavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/school", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { title: "Teachers", href: "/school/teachers", icon: Users },
      { title: "Classes", href: "/school/classes", icon: School2 },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Resources", href: "/school/resources", icon: BookOpen },
      { title: "Answer Keys", href: "/school/answer-keys", icon: KeyRound },
      { title: "Results", href: "/school/results", icon: Trophy },
      { title: "OMR Scan", href: "/school/omr-scan", icon: ScanLine },
    ],
  },
];

const allItems = schoolNavGroups.flatMap((group) => group.items);

export function isSchoolNavActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (href === "/school") return false;

  const longerMatch = allItems.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(href) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );

  return !longerMatch && pathname.startsWith(`${href}/`);
}

const SEGMENT_LABELS: Record<string, string> = {
  teachers: "Teachers",
  classes: "Classes",
  organize: "Organize",
  sections: "Section",
  whole: "Class",
  programs: "Programs",
  students: "Students",
  new: "Add student",
  edit: "Edit",
  answers: "Answer key",
  resources: "Resources",
  "answer-keys": "Answer Keys",
  results: "Results",
  "omr-scan": "OMR Scan",
};

function crumbLabel(segment: string, previous: string | undefined) {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  if (previous === "answer-keys") return "Key";
  return "Details";
}

export type SchoolBreadcrumb = { label: string; href: string };

export function getSchoolBreadcrumbs(pathname: string): SchoolBreadcrumb[] {
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const crumbs: SchoolBreadcrumb[] = [{ label: "Dashboard", href: "/school" }];

  segments.forEach((segment, index) => {
    crumbs.push({
      label: SEGMENT_LABELS[segment] ?? "Details",
      href: `/school/${segments.slice(0, index + 1).join("/")}`,
    });
  });

  return crumbs;
}

/** Only the dashboard is a root — resources and other sections get Back → Dashboard. */
export function getSchoolParentHref(pathname: string): string | null {
  const dashboard = "/school";
  if (pathname === dashboard) return null;
  if (allItems.some((item) => item.href === pathname)) return dashboard;
  if (/\/answer-keys\/[^/]+\/answers$/.test(pathname)) return pathname.replace(/\/[^/]+\/answers$/, "");
  return getSchoolBreadcrumbs(pathname).at(-2)?.href ?? dashboard;
}
