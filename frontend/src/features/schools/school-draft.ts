import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { readFormValues, withoutPasswords, type SchoolFormValues } from "./schema";

const DRAFT_KEY = "vitaran:school-registration-draft";

const draftSchema = z
  .object({
    offerings: z.array(z.string()).optional(),
    customClasses: z.array(z.string()).optional(),
  })
  .catchall(z.string());

const subscribe = () => () => {};

function readRawDraft(): string | null {
  try {
    return sessionStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

function parseDraft(raw: string | null | undefined): SchoolFormValues | null {
  if (!raw) return null;
  try {
    const result = draftSchema.safeParse(JSON.parse(raw));
    return result.success ? (result.data as SchoolFormValues) : null;
  } catch {
    return null;
  }
}

export function saveSchoolDraft(form: HTMLFormElement) {
  try {
    const values = withoutPasswords(readFormValues(new FormData(form)));
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  } catch {
    // Storage can be full or blocked; the draft is a convenience only.
  }
}

export function clearSchoolDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // See saveSchoolDraft.
  }
}

/** `loading` is true only while server-rendering, where sessionStorage is unavailable. */
export function useSchoolDraft(enabled: boolean) {
  const raw = useSyncExternalStore(
    subscribe,
    () => (enabled ? readRawDraft() : null),
    () => (enabled ? undefined : null),
  );
  const values = useMemo(() => parseDraft(raw), [raw]);

  return { loading: raw === undefined, values };
}
