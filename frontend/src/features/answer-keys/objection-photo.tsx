"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- authenticated proxy route, not a static asset */

/** Thumbnail of an objection's attached photo; opens full size in a dialog. */
export function ObjectionPhoto({ href, className }: { href: string; className?: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        title="View photo"
        className={cn(
          "mt-1.5 inline-block cursor-zoom-in overflow-hidden rounded-md border border-black/10 bg-white",
          className,
        )}
      >
        <img src={href} alt="Attached photo" loading="lazy" className="h-24 max-w-[12rem] object-contain" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/70 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[60] flex h-[90vh] w-[94vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-white p-3 pt-12 shadow-2xl outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <Dialog.Title className="absolute top-3.5 left-4 text-sm font-semibold text-neutral-800">
            Attached photo
          </Dialog.Title>
          <img src={href} alt="Attached photo" className="size-full object-contain" />
          <Dialog.Close
            aria-label="Close"
            className="absolute top-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
