"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { usePublicSettings } from "./use-public-settings";

type PublicAccessGuardProps = {
  flag: "teacherResourcesPublic" | "answerKeysPublic" | "resultsPublic";
};

/**
 * While viewing a public catalog page, kick the guest to login the moment
 * admin flips that catalog to private.
 */
export function PublicAccessGuard({ flag }: PublicAccessGuardProps) {
  const router = useRouter();
  const { settings, ready } = usePublicSettings();

  useEffect(() => {
    if (!ready) return;
    if (settings[flag]) return;
    router.replace(SCHOOL_LOGIN_PATH);
  }, [flag, ready, router, settings]);

  return null;
}
