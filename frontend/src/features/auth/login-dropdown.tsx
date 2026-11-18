"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PortalLoginForm } from "./portal-login-form";

export const OPEN_LOGIN_EVENT = "vitaran:open-login";

/** Open the desktop header login card (lg+). Mobile uses /school/login instead. */
export function openLoginDropdown() {
  if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
    window.dispatchEvent(new Event(OPEN_LOGIN_EVENT));
    return;
  }
  window.location.assign("/school/login");
}

type LoginDropdownProps = {
  className?: string;
  googleError?: string | null;
};

/** Desktop-only Log in button → compact form card. Mobile uses /school/login. */
export function LoginDropdown({ className, googleError }: LoginDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_LOGIN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_LOGIN_EVENT, onOpen);
  }, []);

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
    <div ref={rootRef} className="relative hidden lg:block">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex cursor-pointer items-center rounded-full bg-[#2a2670] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_36px_-12px_rgba(42,38,112,0.65)] select-none transition-colors hover:bg-[#1a1750]",
          className,
        )}
      >
        Log in
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Sign in"
          className="absolute top-[calc(100%+1.35rem)] right-0 z-[60] w-[22rem] rounded-2xl border border-[#ede9fe] bg-white p-4 shadow-[0_24px_60px_-28px_rgba(42,38,112,0.55)]"
        >
          <PortalLoginForm compact googleError={googleError} />
        </div>
      ) : null}
    </div>
  );
}
