"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteHeadOfficeAction } from "./actions";

type HeadOfficeDetailActionsProps = {
  office: { id: string; name: string };
  inverted?: boolean;
};

const INVERTED_BASE =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-white/40 [&_svg]:size-4 [&_svg]:shrink-0";
const INVERTED_OUTLINE = `${INVERTED_BASE} border border-white/25 bg-transparent text-white hover:bg-white/10`;
const INVERTED_SOLID = `${INVERTED_BASE} border border-white bg-white text-neutral-950 hover:bg-neutral-200`;

export function HeadOfficeDetailActions({
  office,
  inverted = false,
}: HeadOfficeDetailActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editHref = `/admin/head-offices/${office.id}/edit`;

  const onConfirm = () =>
    startTransition(async () => {
      const result = await deleteHeadOfficeAction(office.id);
      if (result.ok) {
        toast.success(`${office.name} was deleted`);
        setConfirmOpen(false);
        router.push("/admin/head-offices");
        router.refresh();
        return;
      }
      toast.error(result.message);
      setConfirmOpen(false);
    });

  return (
    <>
      {inverted ? (
        <>
          <button type="button" onClick={() => setConfirmOpen(true)} className={INVERTED_OUTLINE}>
            <Trash2 />
            Delete
          </button>
          <Link href={editHref} className={INVERTED_SOLID}>
            <Pencil />
            Edit office
          </Link>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={() => setConfirmOpen(true)}>
            <Trash2 />
            Delete
          </Button>
          <Link href={editHref} className={buttonVariants()}>
            <Pencil />
            Edit office
          </Link>
        </>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={(next) => !pending && setConfirmOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this head office?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{office.name}</span> will be removed.
              Attached schools stay in the system and are unlinked from this office.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={onConfirm}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Delete office
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
