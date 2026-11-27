import {
  BookOpen,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  ScanLine,
  School,
  School2,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type HeadOfficeNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Opens this school-admin section for the selected school. */
  schoolPath?: string;
};

export type HeadOfficeNavGroup = {
  label: string;
  items: HeadOfficeNavItem[];
};

/**
 * Head office = multi-school operator.
 * Portfolio = all schools. Everything else = same tools as school admin for the selected school.
 */
export const headOfficeNavGroups: HeadOfficeNavGroup[] = [
  {
    label: "Portfolio",
    items: [
      { title: "Office Dashboard", href: "/head-office", icon: LayoutDashboard },
      { title: "All Schools", href: "/head-office/schools", icon: School },
    ],
  },
  {
    label: "School",
    items: [
      {
        title: "School dashboard",
        href: "/school",
        icon: LayoutDashboard,
        schoolPath: "/school",
      },
      { title: "Teachers", href: "/school/teachers", icon: Users, schoolPath: "/school/teachers" },
      {
        title: "Students",
        href: "/school/students",
        icon: GraduationCap,
        schoolPath: "/school/students",
      },
      { title: "Classes", href: "/school/classes", icon: School2, schoolPath: "/school/classes" },
      {
        title: "Resources",
        href: "/school/resources",
        icon: BookOpen,
        schoolPath: "/school/resources",
      },
      {
        title: "Answer Keys",
        href: "/school/answer-keys",
        icon: KeyRound,
        schoolPath: "/school/answer-keys",
      },
      {
        title: "Results and Ranks",
        href: "/school/results",
        icon: Trophy,
        schoolPath: "/school/results",
      },
      {
        title: "OMR Scan",
        href: "/school/omr-scan",
        icon: ScanLine,
        schoolPath: "/school/omr-scan",
      },
    ],
  },
];

const allItems = headOfficeNavGroups.flatMap((group) => group.items);

export function isHeadOfficeNavActive(href: string, pathname: string): boolean {
  if (href === "/head-office") {
    return pathname === "/head-office" || pathname === "/head-office/";
  }
  if (href === "/head-office/schools") {
    return pathname === "/head-office/schools" || pathname.startsWith("/head-office/schools/");
  }
  if (href === "/school") {
    return pathname === "/school" || pathname === "/school/";
  }
  if (href.startsWith("/school")) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (pathname === href) return true;
  const longerMatch = allItems.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(href) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
  return !longerMatch && pathname.startsWith(`${href}/`);
}

export type HeadOfficeBreadcrumb = { label: string; href: string };

export function getHeadOfficeBreadcrumbs(pathname: string): HeadOfficeBreadcrumb[] {
  const crumbs: HeadOfficeBreadcrumb[] = [{ label: "Office Dashboard", href: "/head-office" }];
  if (pathname === "/head-office" || pathname === "/head-office/") return crumbs;

  if (pathname.startsWith("/head-office/schools")) {
    crumbs.push({ label: "All Schools", href: "/head-office/schools" });
    const rest = pathname.slice("/head-office/schools".length).split("/").filter(Boolean);
    if (rest[0]) {
      crumbs.push({
        label: "School",
        href: `/head-office/schools/${rest[0]}`,
      });
    }
  }

  return crumbs;
}

export function schoolIdFromHeadOfficePath(pathname: string) {
  const match = pathname.match(/^\/head-office\/schools\/([^/]+)/);
  return match?.[1] ?? null;
}
