"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useDrivePathCrumbs } from "@/components/layout/drive-path-context";
import { schoolIdFromAdminPath, useAdminNavLabel } from "@/features/admin/nav-labels";
import {
  isAnswerKeyEditorPath,
  readAnswerKeysReturnHref,
} from "@/features/answer-keys/drive-path";

/** false during SSR + hydration; true after mount so sessionStorage reads can't mismatch HTML. */
function useHasClientStore() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export type PortalNavCrumb = { label: string; href: string };

function isResultsEnterPath(pathname: string) {
  return pathname === "/admin/results/enter";
}

function isResultsFolderPath(pathname: string) {
  return /\/results$/.test(pathname);
}

function isSectionRootLabel(label: string) {
  const value = label.trim().toLowerCase();
  return (
    value === "results" ||
    value === "results and ranks" ||
    value === "answer keys" ||
    value === "teachers" ||
    value === "programs" ||
    value === "schools"
  );
}

function isClassLeafLabel(label: string) {
  return /^class\s+\d+/i.test(label.trim());
}

function dedupeCrumbs(crumbs: PortalNavCrumb[]) {
  const out: PortalNavCrumb[] = [];
  for (const crumb of crumbs) {
    const prev = out[out.length - 1];
    if (prev && prev.href === crumb.href && prev.label === crumb.label) continue;
    // Drop a repeated school/test block if the section root leaked back in.
    if (isSectionRootLabel(crumb.label) && out.some((row) => /\/results$|\/answer-keys$/.test(row.href))) {
      continue;
    }
    out.push(crumb);
  }
  return out;
}

function sectionThrough(
  routeCrumbs: PortalNavCrumb[],
  match: (href: string) => boolean,
): PortalNavCrumb[] {
  const index = routeCrumbs.findIndex((crumb) => match(crumb.href));
  return index >= 0 ? routeCrumbs.slice(0, index + 1) : routeCrumbs.slice(0, 2);
}

/**
 * One continuous top-navbar trail: route section + drive folders.
 * Folder lists never keep a Class leaf; enter pages never repeat "Results".
 */
export function usePortalNavCrumbs(routeCrumbs: PortalNavCrumb[]): PortalNavCrumb[] {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const driveCrumbs = useDrivePathCrumbs();
  const schoolId = schoolIdFromAdminPath(pathname);
  // Must use getServerSnapshot=null so SSR HTML matches the first client paint.
  const schoolName = useAdminNavLabel("school", schoolId);
  const hasClientStore = useHasClientStore();
  const answerKeysReturnHref = hasClientStore ? readAnswerKeysReturnHref() : null;

  return useMemo(() => {
    const folders = driveCrumbs.filter((crumb) => !isSectionRootLabel(crumb.label));

    if (isAnswerKeyEditorPath(pathname)) {
      const section = sectionThrough(routeCrumbs, (href) => /\/answer-keys$/.test(href));
      const withFolderHome = section.map((crumb) =>
        /\/answer-keys$/.test(crumb.href) && answerKeysReturnHref
          ? { ...crumb, href: answerKeysReturnHref }
          : crumb,
      );
      const leafLabel = pathname.endsWith("/edit") ? "Edit" : "Enter answers";
      return dedupeCrumbs([...withFolderHome, ...folders, { label: leafLabel, href: pathname }]);
    }

    if (isResultsEnterPath(pathname)) {
      const section = sectionThrough(routeCrumbs, (href) => /\/results$/.test(href));
      return dedupeCrumbs([...section, ...folders]);
    }

    // Results folder list: School → Test only. Class rows are list items, not nav.
    if (isResultsFolderPath(pathname)) {
      const section = sectionThrough(routeCrumbs, (href) => /\/results$/.test(href));
      const listFolders = folders.filter((crumb) => !isClassLeafLabel(crumb.label));
      // If query has no test yet, keep only school (drop stale test crumbs).
      const test = searchParams.get("test");
      const school = searchParams.get("school");
      const scoped = listFolders.filter((crumb) => {
        if (!school && !test) return false;
        if (!test && /test\s+\d+/i.test(crumb.label)) return false;
        return true;
      });
      return dedupeCrumbs([...section, ...(school || test ? scoped : [])]);
    }

    // Result detail: drop the UUID "Details"/"Result" route leaf — drive already has School → Test.
    if (/\/results\/[^/]+$/.test(pathname)) {
      const section = sectionThrough(routeCrumbs, (href) => /\/results$/.test(href));
      const rest = routeCrumbs
        .slice(section.length)
        .filter((crumb) => crumb.label !== "Details" && crumb.label !== "Result");
      return dedupeCrumbs([...section, ...folders, ...rest]);
    }

    // Students drive: "Schools" = this page’s school list (/admin/schools/students), not /admin/schools.
    if (pathname === "/admin/schools/students" || pathname.startsWith("/admin/schools/students/")) {
      const dashboard = routeCrumbs[0] ? [routeCrumbs[0]] : [];
      const schoolsHere = { label: "Schools", href: "/admin/schools/students" };
      const school = searchParams.get("school");
      if (!school && pathname === "/admin/schools/students") {
        return dedupeCrumbs([...dashboard, schoolsHere]);
      }
      const rest = routeCrumbs
        .slice(2)
        .filter((crumb) => crumb.label !== "Students" && crumb.label !== "Details");
      return dedupeCrumbs([...dashboard, schoolsHere, ...folders, ...rest]);
    }

    // Teachers drive: "Schools" = this page’s school list (/admin/teachers), not /admin/schools.
    // Inside a school: one leaf (school name), not School › Teachers.
    if (/\/teachers$/.test(pathname)) {
      const dashboard = routeCrumbs[0] ? [routeCrumbs[0]] : [];
      const schoolsHere = { label: "Schools", href: "/admin/teachers" };
      const school = searchParams.get("school") ?? searchParams.get("schoolId");
      if (!school) {
        return dedupeCrumbs([...dashboard, schoolsHere]);
      }
      return dedupeCrumbs([...dashboard, schoolsHere, ...folders]);
    }

    // Program detail / edit: Dashboard › Programs › Name [› Edit]
    if (/\/programs\/[^/]+(\/edit)?$/.test(pathname) && !pathname.endsWith("/programs/new")) {
      const section = sectionThrough(routeCrumbs, (href) => /\/programs$/.test(href));
      return dedupeCrumbs([...section, ...folders]);
    }

    // School detail / edit: Dashboard › Schools › Name [› Edit]
    // Nested school routes (programs, classes, …) keep school name before the leaf.
    // Skip the Students drive — handled above (URL is /admin/schools/students).
    if (
      /\/schools\/[^/]+/.test(pathname) &&
      !pathname.endsWith("/schools/new") &&
      pathname !== "/admin/schools/students" &&
      !pathname.startsWith("/admin/schools/students/")
    ) {
      const section = sectionThrough(routeCrumbs, (href) => /\/schools$/.test(href));
      const rest = routeCrumbs.slice(section.length).filter((crumb) => crumb.label !== "Details");
      const schoolHref = schoolId ? `/admin/schools/${schoolId}` : null;
      const named =
        schoolName && schoolHref && !folders.some((crumb) => crumb.href === schoolHref)
          ? [{ label: schoolName, href: schoolHref }, ...folders]
          : folders;
      return dedupeCrumbs([...section, ...named, ...rest]);
    }

    return dedupeCrumbs([...routeCrumbs, ...folders]);
  }, [
    routeCrumbs,
    driveCrumbs,
    pathname,
    searchParams,
    schoolId,
    schoolName,
    answerKeysReturnHref,
  ]);
}
