"use client";

import { useCallback, useRef, type RefObject } from "react";

/**
 * Shared form helpers for edit pages. Leave-without-saving prompts are disabled —
 * callers still use `formRef` / `markClean` / `dialog` so existing forms keep working.
 */
export function useUnsavedChanges(
  _dirty: boolean,
  externalFormRef?: RefObject<HTMLFormElement | null>,
) {
  const internalRef = useRef<HTMLFormElement | null>(null);
  const formRef = externalFormRef ?? internalRef;

  const markClean = useCallback(() => {}, []);
  const guardCancelClick = useCallback(
    (_href: string) => (_event: React.MouseEvent) => {},
    [],
  );

  return { formRef, markClean, guardCancelClick, dialog: null };
}
