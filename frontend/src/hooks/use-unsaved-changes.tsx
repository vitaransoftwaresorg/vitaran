"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type PendingNav = { href: string } | { back: true };

type UnsavedOptions = {
  formRef?: RefObject<HTMLFormElement | null>;
  /** Return false (or throw) to stay on the page after Save. */
  onSave?: () => boolean | void | Promise<boolean | void>;
};

function resolveHref(raw: string) {
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Blocks leaving a dirty page via sidebar links or browser back.
 * Shows Discard / Save. Call `markClean()` after a successful save.
 */
export function useUnsavedChanges(
  dirty: boolean,
  formOrOptions?: RefObject<HTMLFormElement | null> | UnsavedOptions,
) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingNav | null>(null);
  const [savingLeave, setSavingLeave] = useState(false);
  const options: UnsavedOptions =
    formOrOptions && "current" in formOrOptions
      ? { formRef: formOrOptions }
      : (formOrOptions ?? {});
  const internalRef = useRef<HTMLFormElement | null>(null);
  const formRef = options.formRef ?? internalRef;
  const onSaveRef = useRef(options.onSave);
  onSaveRef.current = options.onSave;
  const allowLeave = useRef(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const markClean = useCallback(() => {
    allowLeave.current = true;
  }, []);

  useEffect(() => {
    if (!dirty) {
      allowLeave.current = false;
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeave.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (!dirtyRef.current || allowLeave.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = resolveHref(anchor.getAttribute("href") ?? "");
      if (!href) return;

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (href === current) return;

      event.preventDefault();
      event.stopPropagation();
      setPending({ href });
    };

    window.history.pushState({ unsavedGuard: true }, "");
    const onPopState = () => {
      if (!dirtyRef.current || allowLeave.current) return;
      window.history.pushState({ unsavedGuard: true }, "");
      setPending({ back: true });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);

  const guardCancelClick = useCallback(
    (href: string) => (event: React.MouseEvent) => {
      if (!dirtyRef.current || allowLeave.current) return;
      event.preventDefault();
      setPending({ href });
    },
    [],
  );

  const leaveTo = (next: PendingNav) => {
    allowLeave.current = true;
    setPending(null);
    if ("href" in next) router.push(next.href);
    else router.back();
  };

  const discard = () => {
    if (!pending) return;
    leaveTo(pending);
  };

  const saveAndLeave = () => {
    if (!pending || savingLeave) return;
    const next = pending;
    const onSave = onSaveRef.current;
    if (onSave) {
      setSavingLeave(true);
      void (async () => {
        try {
          const result = await onSave();
          if (result === false) {
            setPending(null);
            return;
          }
          leaveTo(next);
        } catch {
          setPending(null);
        } finally {
          setSavingLeave(false);
        }
      })();
      return;
    }
    const form = formRef.current;
    if (!form) return;
    allowLeave.current = true;
    setPending(null);
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.submit();
  };

  const dialog = (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open && !savingLeave) setPending(null);
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Save changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved edits. Save them or discard and leave.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" variant="outline" disabled={savingLeave} onClick={discard}>
            Discard
          </Button>
          <Button type="button" disabled={savingLeave} onClick={saveAndLeave}>
            Save
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { formRef, markClean, guardCancelClick, dialog };
}
