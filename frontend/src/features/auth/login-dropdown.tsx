"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { googleErrorMessage } from "./google-errors";
import { PortalLoginForm } from "./portal-login-form";

export const OPEN_LOGIN_EVENT = "vitaran:open-login";

/** Open the header login card from anywhere (e.g. hero CTA). */
export function openLoginDropdown() {
  window.dispatchEvent(new Event(OPEN_LOGIN_EVENT));
}

type LoginDropdownProps = {
  className?: string;
  googleError?: string | null;
};

/** Log in button → compact form card (no separate marketing login page). */
export function LoginDropdown({ className, googleError }: LoginDropdownProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stickyError, setStickyError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const formError = googleError ?? stickyError;

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_LOGIN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_LOGIN_EVENT, onOpen);
  }, []);

  // /school/login and auth redirects land on /?login=1 (optional ?error=).
  useEffect(() => {
    if (searchParams.get("login") !== "1" && !searchParams.get("error")) return;
    const err = googleErrorMessage(searchParams.get("error"));
    if (err) setStickyError(err);
    setOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("login");
    next.delete("error");
    const query = next.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => document.addEventListener("mousedown", onPointer), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "hidden cursor-pointer items-center rounded-full bg-[#2a2670] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_36px_-12px_rgba(42,38,112,0.65)] select-none transition-colors hover:bg-[#1a1750] lg:inline-flex",
          className,
        )}
      >
        Log in
      </button>

      {open ? (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-[60] bg-black/35 lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            role="dialog"
            aria-label="Sign in"
            className="fixed inset-x-4 top-24 z-[70] w-auto max-w-sm rounded-2xl border border-[#ede9fe] bg-white p-4 shadow-[0_24px_60px_-28px_rgba(42,38,112,0.55)] sm:inset-x-auto sm:right-4 lg:absolute lg:inset-x-auto lg:top-[calc(100%+1.35rem)] lg:right-0 lg:z-[60] lg:w-[22rem] lg:max-w-none"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-full text-[#2a2670] hover:bg-[#f5f3ff] lg:hidden"
            >
              <X className="size-4" />
            </button>
            <PortalLoginForm compact googleError={formError} />
          </div>
        </>
      ) : null}
    </div>
  );
}
