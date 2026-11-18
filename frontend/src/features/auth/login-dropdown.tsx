"use client";

import { Suspense, useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { googleErrorMessage } from "./google-errors";
import { PortalLoginForm } from "./portal-login-form";
import { resumePortalSession } from "./resume-portal-session";

export const OPEN_LOGIN_EVENT = "vitaran:open-login";

/** Open the header login dropdown (or resume an existing session). */
export function openLoginDropdown() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_LOGIN_EVENT));
}

type LoginDropdownProps = {
  className?: string;
  googleError?: string | null;
};

function LoginDropdownInner({ className, googleError }: LoginDropdownProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const errorFromUrl = googleErrorMessage(searchParams.get("error"));
  const resolvedError = googleError ?? errorFromUrl;
  const autoOpenTried = useRef(false);

  const resumeOrOpenForm = () => {
    startTransition(async () => {
      const dest = await resumePortalSession();
      if (dest) {
        window.location.assign(dest);
        return;
      }
      setOpen(true);
    });
  };

  const resumeOrOpenRef = useRef(resumeOrOpenForm);
  resumeOrOpenRef.current = resumeOrOpenForm;

  useEffect(() => {
    const onOpen = () => resumeOrOpenRef.current();
    window.addEventListener(OPEN_LOGIN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_LOGIN_EVENT, onOpen);
  }, []);

  // Deep links / Auth redirects: /?login=1 or /?error=…
  useEffect(() => {
    if (pathname !== "/") return;
    if (!searchParams.has("login") && !searchParams.has("error")) return;
    if (autoOpenTried.current) return;
    autoOpenTried.current = true;
    // Google/Auth error → show the form with the message (don't silently bounce).
    if (searchParams.has("error")) {
      setOpen(true);
      return;
    }
    resumeOrOpenRef.current();
  }, [pathname, searchParams]);

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

  function clearLoginQuery() {
    if (pathname !== "/") return;
    if (!searchParams.has("login") && !searchParams.has("error")) return;
    router.replace("/", { scroll: false });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={pending}
        onClick={() => {
          if (open) {
            setOpen(false);
            clearLoginQuery();
            return;
          }
          resumeOrOpenForm();
        }}
        className={cn(
          "inline-flex cursor-pointer items-center rounded-full bg-[#2a2670] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_36px_-12px_rgba(42,38,112,0.65)] select-none transition-colors hover:bg-[#1a1750] disabled:opacity-70",
          className,
        )}
      >
        {pending ? "Signing in…" : "Log in"}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Sign in"
          className="fixed top-[4.75rem] right-4 left-4 z-[60] max-h-[min(32rem,calc(100dvh-5.5rem))] overflow-y-auto rounded-2xl border border-[#ede9fe] bg-white p-4 shadow-[0_24px_60px_-28px_rgba(42,38,112,0.55)] sm:absolute sm:top-[calc(100%+1.35rem)] sm:right-0 sm:left-auto sm:w-[22rem] sm:max-h-none sm:overflow-visible"
        >
          <PortalLoginForm compact googleError={resolvedError} />
        </div>
      ) : null}
    </div>
  );
}

/** Log in button → resume session or compact form card. */
export function LoginDropdown(props: LoginDropdownProps) {
  return (
    <Suspense fallback={null}>
      <LoginDropdownInner {...props} />
    </Suspense>
  );
}
