"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveContent } from "@/features/live/use-live-content";
import { getPublicSettingsClient } from "@/services/settings-client";
import type { PublicSettings } from "@/types/settings";

const EMPTY: PublicSettings = {
  maintenanceMode: false,
  teacherResourcesPublic: false,
  answerKeysPublic: false,
};

/**
 * Public settings for the marketing site.
 * Reloads immediately when admin saves (via /public-live settings events).
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

  useLiveContent("settings", reload, "/public-live", 150);

  return { settings, ready, reload };
}
