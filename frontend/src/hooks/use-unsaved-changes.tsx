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
import { useLeaveGuard } from "@/lib/leave-guard";

type PendingNav = { leave: () => void };

/**
 * Blocks leaving a dirty edit form via Cancel, sidebar links, or portal Back.
 * Shows Leave / Keep editing. Call `markClean()` after a successful save.
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
    setPending(null);
  }, []);

  useEffect(() => {
    if (!dirty) allowLeave.current = false;
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeave.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useLeaveGuard(
    dirty,
    (proceed) => {
      if (allowLeave.current || !dirtyRef.current) {
        proceed();
        return;
      }
      setPending({ leave: proceed });
    },
    (href) => router.push(href),
  );

  const guardCancelClick = useCallback(
    (href: string) => (event: React.MouseEvent) => {
      if (!dirtyRef.current || allowLeave.current) return;
      event.preventDefault();
      setPending({ leave: () => router.push(href) });
    },
    [router],
  );

  const leave = () => {
    if (!pending) return;
    allowLeave.current = true;
    const next = pending.leave;
    setPending(null);
    next();
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
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved edits. Leave to discard them, or stay and save from the page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" variant="ghost" onClick={() => setPending(null)}>
            Keep editing
          </Button>
          <Button type="button" variant="outline" onClick={leave}>
            Leave
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { formRef, markClean, guardCancelClick, dialog };
}
