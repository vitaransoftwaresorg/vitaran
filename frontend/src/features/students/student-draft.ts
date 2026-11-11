"use client";

import { useSyncExternalStore } from "react";

export type StudentDraftRow = {
  name: string;
  rollNo: string;
  parentName: string;
  parentPhone: string;
  email: string;
};

export type StudentDraft = {
  savedAt: string;
  programId: string;
  classLevel: number | null;
  sectionId: string;
  rows: StudentDraftRow[];
};

const PREFIX = "vitaran:students-draft:";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function studentDraftKey(...parts: Array<string | number | null | undefined>) {
  return PREFIX + parts.map((part) => part ?? "").join(":");
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStudentDraft(key: string, draft: Omit<StudentDraft, "savedAt">) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    // Storage full or blocked: the leave prompt still offers Save.
  }
  emit();
}

export function clearStudentDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
  emit();
}

export function parseStudentDraft(raw: string | null): StudentDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as StudentDraft;
    return Array.isArray(draft.rows) && draft.rows.length ? draft : null;
  } catch {
    return null;
  }
}

/** Raw stored draft for this key; null on the server and when nothing is kept. */
export function useStoredStudentDraft(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}
