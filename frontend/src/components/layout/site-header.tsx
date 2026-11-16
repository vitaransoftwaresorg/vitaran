"use client";

import { Suspense, useEffect, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { LoginDropdown, openLoginDropdown } from "@/features/auth/login-dropdown";
import { portalLogout } from "@/features/auth/portal-logout";
import { navLinks } from "@/features/home/content";
import { cn } from "@/lib/utils";

const HEADER_OFFSET = 72;
const mobileLinks = navLinks;

/** Portal pages — when signed out, open the same login dropdown. */
const AUTH_NAV_HREFS = new Set([
  "/teacher/resources",
  "/teacher/answer-keys",
  "/teacher/results",
]);

const hashOf = (href: string) => {
  const i = href.indexOf("#");
  return i >= 0 ? href.slice(i) : null;
};

function scrollToHash(hash: string) {
  const target = document.querySelector<HTMLElement>(hash);
  if (!target) return;

  document.body.style.overflow = "";
  const top =
    target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
  history.replaceState(null, "", hash);
}

const logoutButtonClasses =
  "hidden h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#2a2670] px-5 text-sm font-semibold text-white shadow-[0_10px_30px_-16px_rgba(42,38,112,0.7)] select-none transition-colors hover:bg-[#1a1750] disabled:pointer-events-none disabled:opacity-60 lg:inline-flex";

const mobileLogoutClasses =
  "flex w-full items-center justify-center gap-2 rounded-full bg-[#2a2670] px-4 py-3.5 text-lg font-medium text-white select-none disabled:opacity-60";

type SiteSession = {
  kind: "school" | "teacher";
};

function LogoutButton({
  className,
  onNavigate,
}: {
  className: string;
  onNavigate?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        onNavigate?.();
        startTransition(() => portalLogout());
      }}
      className={className}
    >
      <LogOut className="size-4" />
      <span>{pending ? "Logging out…" : "Log out"}</span>
    </button>
  );
}

export function SiteHeader({ session }: { session: SiteSession | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const pathname = usePathname();
  const onHome = pathname === "/";

  /** When a school is signed in, content links open the school portal. */
  const contentHref = (href: string) => {
    if (!session || session.kind !== "school") return href;
    if (href === "/teacher/resources") return "/school/resources";
    if (href === "/teacher/answer-keys") return "/school/answer-keys";
    if (href === "/teacher/results") return "/school/results";
    return href;
  };

  const resolveHref = (href: string) => {
    const hash = hashOf(href);
    if (hash) return onHome ? hash : href.startsWith("/") ? href : `/${href}`;
    return contentHref(href);
  };

  const isActive = (href: string) => {
    const hash = hashOf(href);
    if (hash) return onHome && active === hash;
    const resolved = contentHref(href);
    return pathname === resolved || pathname.startsWith(`${resolved}/`);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!onHome) return;

    const sections = mobileLinks
      .map((link) => hashOf(link.href))
      .filter((hash): hash is string => Boolean(hash))
      .map((hash) => document.querySelector<HTMLElement>(hash))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((section) => observer.observe(section));

    const onTop = () => {
      if (window.scrollY < 200) setActive(null);
    };
    window.addEventListener("scroll", onTop, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onTop);
    };
  }, [onHome]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const onNavClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    setOpen(false);

    if (!session && AUTH_NAV_HREFS.has(href)) {
      event.preventDefault();
      openLoginDropdown();
      return;
    }

    const hash = hashOf(href);
    if (!hash || !onHome) return;

    event.preventDefault();
    setActive(hash);
    scrollToHash(hash);
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-[#ede9fe]/70 bg-white/95 backdrop-blur-md transition-shadow duration-300",
        (scrolled || open) && "shadow-[0_8px_30px_-12px_rgba(49,46,129,0.14)]",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:h-18 sm:px-8">
        <Logo className="shrink-0" />

        <nav aria-label="Primary" className="hidden min-w-0 flex-1 justify-center lg:flex">
          <ul className="flex flex-wrap items-center justify-center gap-x-0.5">
            {navLinks.map((link) => {
              const linkActive = isActive(link.href);
              return (
                <li key={link.label}>
                  <Link
                    href={resolveHref(link.href)}
                    onClick={(e) => onNavClick(e, link.href)}
                    aria-current={linkActive ? "location" : undefined}
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors select-none xl:px-4 xl:text-[0.95rem]",
                      linkActive
                        ? "bg-[#eceaf8] text-[#1a1750]"
                        : "text-[#1a1750] hover:bg-[#f5f3ff]",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {session ? (
            <LogoutButton className={logoutButtonClasses} />
          ) : (
            <Suspense fallback={null}>
              <LoginDropdown />
            </Suspense>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-11 items-center justify-center rounded-full text-[#2a2670] transition-all hover:bg-[#f5f3ff] active:scale-90 lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={cn(
          "grid overflow-hidden transition-all duration-300 lg:hidden",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <nav aria-label="Mobile" className="min-h-0">
          <ul className="space-y-1 px-5 pt-2 pb-6">
            {mobileLinks.map((link) => {
              const linkActive = isActive(link.href);
              return (
                <li key={link.label}>
                  <Link
                    href={resolveHref(link.href)}
                    onClick={(e) => onNavClick(e, link.href)}
                    aria-current={linkActive ? "location" : undefined}
                    className={cn(
                      "flex items-center rounded-xl px-4 py-3.5 text-lg font-medium transition-all select-none active:scale-[0.98]",
                      linkActive
                        ? "bg-[#2a2670] text-white"
                        : "text-[#2a2670] hover:bg-[#f5f3ff] active:bg-[#ede9fe]",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-t border-[#ede9fe] pt-3">
              {session ? (
                <LogoutButton
                  className={mobileLogoutClasses}
                  onNavigate={() => setOpen(false)}
                />
              ) : (
                <button
                  type="button"
                  className={mobileLogoutClasses}
                  onClick={() => {
                    setOpen(false);
                    openLoginDropdown();
                  }}
                >
                  Log in
                </button>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
