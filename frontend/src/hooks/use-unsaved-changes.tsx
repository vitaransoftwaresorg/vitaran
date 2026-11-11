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
 * Blocks leaving a dirty edit form via Cancel, sidebar links, or browser back.
 * Shows Save / Discard / Keep editing. Call `markClean()` after a successful save.
 */
export function useUnsavedChanges(
  dirty: boolean,
  externalFormRef?: RefObject<HTMLFormElement | null>,
) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingNav | null>(null);
  const internalRef = useRef<HTMLFormElement | null>(null);
  const formRef = externalFormRef ?? internalRef;
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

  const discard = () => {
    if (!pending) return;
    allowLeave.current = true;
    const next = pending;
    setPending(null);
    if ("href" in next) router.push(next.href);
    else router.back();
  };

  const saveAndLeave = () => {
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
        if (!open) setPending(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved edits on this page. Save them, discard, or keep editing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" variant="ghost" onClick={() => setPending(null)}>
            Keep editing
          </Button>
          <Button type="button" variant="outline" onClick={discard}>
            Discard
          </Button>
          <Button type="button" onClick={saveAndLeave}>
            Save changes
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { formRef, markClean, guardCancelClick, dialog };
}
