"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveContent } from "@/features/live/use-live-content";
import { getPublicSettingsClient } from "@/services/settings-client";
import type { PublicSettings } from "@/types/settings";

const EMPTY: PublicSettings = {
  maintenanceMode: false,
  teacherResourcesPublic: false,
  answerKeysPublic: false,
  resultsPublic: false,
  schoolDesktopOmrEnabled: true,
  teacherDesktopOmrEnabled: true,
  schoolMobileOmrEnabled: true,
  teacherMobileOmrEnabled: true,
};

function asPublicSettings(value: unknown): PublicSettings | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.maintenanceMode !== "boolean" ||
    typeof row.teacherResourcesPublic !== "boolean" ||
    typeof row.answerKeysPublic !== "boolean" ||
    typeof row.resultsPublic !== "boolean"
  ) {
    return null;
  }
  // OMR flags default on when absent so a partial live event cannot wipe them.
  return {
    maintenanceMode: row.maintenanceMode,
    teacherResourcesPublic: row.teacherResourcesPublic,
    answerKeysPublic: row.answerKeysPublic,
    resultsPublic: row.resultsPublic,
    schoolDesktopOmrEnabled:
      typeof row.schoolDesktopOmrEnabled === "boolean" ? row.schoolDesktopOmrEnabled : true,
    teacherDesktopOmrEnabled:
      typeof row.teacherDesktopOmrEnabled === "boolean" ? row.teacherDesktopOmrEnabled : true,
    schoolMobileOmrEnabled:
      typeof row.schoolMobileOmrEnabled === "boolean" ? row.schoolMobileOmrEnabled : true,
    teacherMobileOmrEnabled:
      typeof row.teacherMobileOmrEnabled === "boolean" ? row.teacherMobileOmrEnabled : true,
  };
}

/**
 * Public settings for the marketing site and portal gates.
 * Applies the SSE settings snapshot immediately, then reloads for a full sync.
 */
export function usePublicSettings() {
  const [settings, setSettings] = useState<PublicSettings>(EMPTY);
  const [ready, setReady] = useState(false);

  const reload = useCallback(() => {
    void getPublicSettingsClient()
      .then((next) => {
        setSettings(next);
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useLiveContent(
    "settings",
    (payload) => {
      const next = asPublicSettings(payload?.settings);
      if (next) {
        setSettings(next);
        setReady(true);
      }
      reload();
    },
    "/public-live",
    0,
    { ignoreSilence: true },
  );

  return { settings, ready, reload };
}
