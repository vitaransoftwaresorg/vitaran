"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useDrivePathCrumbs } from "@/components/layout/drive-path-context";
import {
  officeIdFromAdminPath,
  schoolIdFromAdminPath,
  useAdminNavLabel,
} from "@/features/admin/nav-labels";
import {
  isAnswerKeyEditorPath,
  readAnswerKeysReturnHref,
} from "@/features/answer-keys/drive-path";
import { readResultsReturnHref } from "@/features/results/portal-drive-path";

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
    value === "school keys" ||
    value === "key objections" ||
    value === "teachers" ||
    value === "programs" ||
    value === "schools" ||
    value === "head offices" ||
    value === "students" ||
    value === "resources" ||
    value === "teacher resources" ||
    value === "omr scan" ||
    value === "classes"
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
  const hasClientStore = useHasClientStore();
  const answerKeysReturnHref = hasClientStore ? readAnswerKeysReturnHref() : null;
  const resultsReturnHref = hasClientStore ? readResultsReturnHref() : null;
  // School Keys editor keeps school id in ?from=, not in the answers path.
  const schoolIdFromReturn =
    answerKeysReturnHref && pathname.includes("/school-keys/")
      ? new URLSearchParams(answerKeysReturnHref.split("?")[1] ?? "").get("school")
      : null;
  const schoolId =
    schoolIdFromAdminPath(pathname) ?? schoolIdFromReturn ?? searchParams.get("school");
  const officeIdFromQuery =
    searchParams.get("from") === "head-office" ? searchParams.get("office") : null;
  const officeId = officeIdFromAdminPath(pathname) ?? officeIdFromQuery;
  // Must use getServerSnapshot=null so SSR HTML matches the first client paint.
  const schoolName = useAdminNavLabel("school", schoolId);
  const officeName = useAdminNavLabel("office", officeId);

  return useMemo(() => {
    const folders = driveCrumbs.filter((crumb) => !isSectionRootLabel(crumb.label));

    if (isAnswerKeyEditorPath(pathname)) {
      const isSchoolKey = pathname.includes("/school-keys/");
      const sectionRe = isSchoolKey ? /\/school-keys$/ : /\/answer-keys$/;
      const section = sectionThrough(routeCrumbs, (href) => sectionRe.test(href));
      const withFolderHome = section.map((crumb) =>
        sectionRe.test(crumb.href) && answerKeysReturnHref
          ? { ...crumb, href: answerKeysReturnHref }
          : crumb,
      );
      // Rebuild School → Test from ?from= when session crumbs were not written yet.
      let trail = folders;
      if (trail.length === 0 && answerKeysReturnHref) {
        const params = new URLSearchParams(answerKeysReturnHref.split("?")[1] ?? "");
        const schoolParam = params.get("school");
        const testParam = params.get("test");
        if (isSchoolKey && schoolParam) {
          const schoolHref = `${answerKeysReturnHref.split("?")[0]}?school=${encodeURIComponent(schoolParam)}`;
          trail = [
            {
              label: schoolName ?? "School",
              href: schoolHref,
            },
          ];
          if (testParam) {
            trail.push({
              label: `Test ${testParam}`,
              href: answerKeysReturnHref,
            });
          }
        } else if (testParam) {
          trail = [{ label: `Test ${testParam}`, href: answerKeysReturnHref }];
        }
      }
      const leafLabel = pathname.endsWith("/edit") ? "Edit" : "Enter answers";
      return dedupeCrumbs([...withFolderHome, ...trail, { label: leafLabel, href: pathname }]);
    }

    // School Keys folders: Dashboard › School Keys › School › Test (same pattern as Answer Keys).
    if (pathname === "/admin/school-keys") {
      const section = sectionThrough(routeCrumbs, (href) => /\/school-keys$/.test(href));
      const school = searchParams.get("school");
      const test = searchParams.get("test");
      const scoped = folders.filter((crumb) => {
        if (!school && !test) return false;
        if (!test && /test\s+\d+/i.test(crumb.label)) return false;
        return true;
      });
      return dedupeCrumbs([...section, ...(school || test ? scoped : [])]);
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

    // Result detail: Results → Test → Class (Test links back to the class list).
    if (/\/results\/[^/]+$/.test(pathname)) {
      const section = sectionThrough(routeCrumbs, (href) => /\/results$/.test(href));
      const rest = routeCrumbs
        .slice(section.length)
        .filter((crumb) => crumb.label !== "Details" && crumb.label !== "Result");
      const trail =
        folders.length > 0
          ? folders
          : resultsReturnHref
            ? [
                {
                  label: (() => {
                    const test = new URLSearchParams(resultsReturnHref.split("?")[1] ?? "").get("test");
                    return test ? `Test ${test}` : "Test";
                  })(),
                  href: resultsReturnHref,
                },
                ...rest,
              ]
            : rest;
      return dedupeCrumbs([...section, ...trail]);
    }

    // Students drive: from Students page vs from school profile (?from=school).
    if (pathname === "/admin/schools/students" || pathname.startsWith("/admin/schools/students/")) {
      const dashboard = routeCrumbs[0] ? [routeCrumbs[0]] : [];
      const school = searchParams.get("school");
      const fromSchool = searchParams.get("from") === "school";
      if (!school && pathname === "/admin/schools/students") {
        return dedupeCrumbs([
          ...dashboard,
          { label: "Schools", href: "/admin/schools/students" },
        ]);
      }
      const rest = routeCrumbs
        .slice(2)
        .filter((crumb) => crumb.label !== "Students" && crumb.label !== "Details");
      return dedupeCrumbs([
        ...dashboard,
        {
          label: "Schools",
          href: fromSchool ? "/admin/schools" : "/admin/schools/students",
        },
        ...folders,
        ...rest,
      ]);
    }

    // Teachers drive: from Teachers page vs from school profile (?from=school).
    if (/\/teachers$/.test(pathname)) {
      const dashboard = routeCrumbs[0] ? [routeCrumbs[0]] : [];
      const school = searchParams.get("school") ?? searchParams.get("schoolId");
      const fromSchool = searchParams.get("from") === "school";
      if (!school) {
        return dedupeCrumbs([
          ...dashboard,
          { label: "Schools", href: "/admin/teachers" },
        ]);
      }
      return dedupeCrumbs([
        ...dashboard,
        { label: "Schools", href: fromSchool ? "/admin/schools" : "/admin/teachers" },
        ...folders,
      ]);
    }

    // Program detail / edit: Dashboard › Programs › Name [› Edit]
    if (/\/programs\/[^/]+(\/edit)?$/.test(pathname) && !pathname.endsWith("/programs/new")) {
      const section = sectionThrough(routeCrumbs, (href) => /\/programs$/.test(href));
      return dedupeCrumbs([...section, ...folders]);
    }

    // Head office: Dashboard › Head Offices › Name profile [› Edit]
    if (
      /\/head-offices\/[^/]+/.test(pathname) &&
      !pathname.endsWith("/head-offices/new")
    ) {
      const section = sectionThrough(routeCrumbs, (href) => /\/head-offices$/.test(href));
      const rest = routeCrumbs.slice(section.length).filter(
        (crumb) =>
          crumb.label !== "Details" &&
          crumb.label !== "Office" &&
          crumb.label !== "Edit" &&
          crumb.label !== "Profile",
      );
      const officeHref = officeId ? `/admin/head-offices/${officeId}` : null;
      const profileLabel = officeName
        ? officeName
            .trim()
            .split(/\s+/)
            .concat("profile")
            .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
            .join(" ")
        : null;
      const named =
        profileLabel &&
        officeHref &&
        !folders.some((crumb) => crumb.href === officeHref)
          ? [{ label: profileLabel, href: officeHref }, ...folders]
          : folders;
      return dedupeCrumbs([...section, ...named, ...rest]);
    }

    // School detail / edit: Dashboard › Schools › Name [› Edit]
    // Nested school routes (programs, classes, …) keep school name before the leaf.
    // Skip the Students drive — handled above (URL is /admin/schools/students).
    // From a head office: still show Schools trail; Back uses ?from=head-office&office=.
    if (
      /\/schools\/[^/]+/.test(pathname) &&
      !pathname.endsWith("/schools/new") &&
      pathname !== "/admin/schools/students" &&
      !pathname.startsWith("/admin/schools/students/")
    ) {
      const fromHeadOffice = searchParams.get("from") === "head-office";
      const officeParam = searchParams.get("office");
      const schoolQuery =
        fromHeadOffice && officeParam
          ? `?from=head-office&office=${encodeURIComponent(officeParam)}`
          : "";
      const schoolHref = schoolId ? `/admin/schools/${schoolId}${schoolQuery}` : null;
      const named =
        schoolName && schoolHref && !folders.some((crumb) => crumb.href.split("?")[0] === `/admin/schools/${schoolId}`)
          ? [{ label: schoolName, href: schoolHref }, ...folders]
          : folders.map((crumb) =>
              crumb.href.startsWith("/admin/schools/") && schoolQuery && !crumb.href.includes("?")
                ? { ...crumb, href: `${crumb.href}${schoolQuery}` }
                : crumb,
            );

      const section = sectionThrough(routeCrumbs, (href) => /\/schools$/.test(href));
      const rest = routeCrumbs.slice(section.length).filter((crumb) => crumb.label !== "Details");
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
    officeId,
    officeName,
    answerKeysReturnHref,
    resultsReturnHref,
  ]);
}
