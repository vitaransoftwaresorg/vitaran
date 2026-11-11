"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DeleteResult } from "@/types/document";
import { capitalize } from "./constants";

type DeleteDocumentButtonProps = {
  fileName: string;
  /** Lowercase, e.g. "answer key". */
  noun: string;
  /** Server action already bound to the document id. */
  onDelete: () => Promise<DeleteResult>;
};

export function DeleteDocumentButton({ fileName, noun, onDelete }: DeleteDocumentButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const onConfirm = () =>
    startTransition(async () => {
      const result = await onDelete();
      if (result.ok) toast.success(`${capitalize(noun)} deleted`);
      else toast.error(result.message);
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <button
        type="button"
        title="Delete"
        aria-label={`Delete ${fileName}`}
        onClick={() => setOpen(true)}
        className="inline-flex size-8 items-center justify-center text-neutral-500 transition-colors hover:bg-destructive/10 hover:text-destructive [&_svg]:size-4"
      >
        <Trash2 />
      </button>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this {noun}?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{fileName}</span> will be
              permanently removed. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={onConfirm}>
              {pending && <Loader2 className="animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
