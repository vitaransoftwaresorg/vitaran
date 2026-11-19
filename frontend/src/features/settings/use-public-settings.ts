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
};

function isPublicSettings(value: unknown): value is PublicSettings {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.maintenanceMode === "boolean" &&
    typeof row.teacherResourcesPublic === "boolean" &&
    typeof row.answerKeysPublic === "boolean" &&
    typeof row.resultsPublic === "boolean"
  );
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
      if (isPublicSettings(payload?.settings)) {
        setSettings(payload.settings);
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
