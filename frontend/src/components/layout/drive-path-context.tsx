"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  isAnswerKeyEditorPath,
  readAnswerKeysFolderCrumbs,
  writeAnswerKeysFolderTrail,
} from "@/features/answer-keys/drive-path";

export type DrivePathCrumb = { label: string; href: string };

type DrivePathContextValue = {
  crumbs: DrivePathCrumb[];
  setCrumbs: (crumbs: DrivePathCrumb[]) => void;
};

const DrivePathContext = createContext<DrivePathContextValue | null>(null);

function sameCrumbs(a: DrivePathCrumb[], b: DrivePathCrumb[]) {
  return (
    a.length === b.length &&
    a.every((crumb, index) => crumb.href === b[index]?.href && crumb.label === b[index]?.label)
  );
}

/** Lets folder drives push path into the top navbar instead of a second crumb row. */
export function DrivePathProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [crumbs, setCrumbsState] = useState<DrivePathCrumb[]>([]);

  const setCrumbs = useCallback(
    (next: DrivePathCrumb[]) => {
      setCrumbsState((current) => (sameCrumbs(current, next) ? current : next));
      // Persist while browsing answer-key folders so the enter page can continue the trail.
      if (pathname.includes("/answer-keys") && !isAnswerKeyEditorPath(pathname)) {
        const href =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : pathname;
        writeAnswerKeysFolderTrail(href, next);
      }
    },
    [pathname],
  );

  useEffect(() => {
    if (isAnswerKeyEditorPath(pathname)) {
      // Keep folder trail when opening Enter answers / Edit — don't wipe to "Answers".
      setCrumbsState(readAnswerKeysFolderCrumbs());
      return;
    }
    // Paths that push their own trail (SchoolNavTrail / ProgramNavTrail / drives).
    // Keep their crumbs across Suspense remounts; clear only when leaving those areas.
    if (
      pathname.includes("/answer-keys") ||
      pathname.includes("/results") ||
      pathname.includes("/students") ||
      pathname.includes("/teachers") ||
      pathname.includes("/schools/") ||
      /\/programs\/[^/]+/.test(pathname)
    ) {
      return;
    }
    setCrumbsState([]);
  }, [pathname]);

  const value = useMemo(() => ({ crumbs, setCrumbs }), [crumbs, setCrumbs]);

  return <DrivePathContext.Provider value={value}>{children}</DrivePathContext.Provider>;
}

export function useDrivePathCrumbs() {
  return useContext(DrivePathContext)?.crumbs ?? [];
}

export function useSetDrivePathCrumbs() {
  return useContext(DrivePathContext)?.setCrumbs;
}
