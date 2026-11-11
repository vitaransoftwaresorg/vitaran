"use client";

import { useEffect, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { portalLogout } from "@/features/auth/portal-logout";
import { navLinks } from "@/features/home/content";
import { cn } from "@/lib/utils";

const HEADER_OFFSET = 72;
const mobileLinks = [...navLinks, { label: "Contact", href: "/contact" }];

const isHash = (href: string) => href.startsWith("#");

function scrollToHash(href: string) {
  const target = document.querySelector<HTMLElement>(href);
  if (!target) return;

  document.body.style.overflow = "";
  const top =
    target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
  history.replaceState(null, "", href);
}

const authButtonClasses =
  "hidden h-10 cursor-pointer items-center gap-2 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white select-none disabled:pointer-events-none disabled:opacity-60 sm:inline-flex";

const mobileAuthClasses =
  "flex w-full items-center gap-3 rounded-xl bg-brand-900 px-4 py-3.5 text-lg font-medium text-white select-none disabled:opacity-60";

const authIconClasses = "size-4";

type SiteSession = {
  kind: "school" | "teacher";
};

/** Log in when signed out; portal + log out when a school/teacher session exists. */
function AuthControl({
  session,
  className,
  onNavigate,
}: {
  session: SiteSession | null;
  className: string;
  onNavigate?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  if (session) {
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
        <LogOut className={authIconClasses} />
        <span>{pending ? "Logging out…" : "Log out"}</span>
      </button>
    );
  }

  return (
    <Link href={SCHOOL_LOGIN_PATH} onClick={onNavigate} className={className}>
      <LogIn className={authIconClasses} />
      <span>Log in</span>
    </Link>
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
    if (isHash(href)) return !onHome ? `/${href}` : href;
    return contentHref(href);
  };

  const isActive = (href: string) =>
    isHash(href) ? onHome && active === href : pathname === contentHref(href);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!onHome) return;

    const sections = mobileLinks
      .filter((link) => isHash(link.href))
      .map((link) => document.querySelector<HTMLElement>(link.href))
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
    if (!isHash(href) || !onHome) return;

    event.preventDefault();
    setActive(href);
    scrollToHash(href);
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-brand-100 bg-white transition-shadow duration-300",
        (scrolled || open) && "shadow-[0_8px_30px_-12px_rgb(25_28_95/0.18)]",
      )}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((link) => {
              const linkActive = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={resolveHref(link.href)}
                    onClick={(e) => onNavClick(e, link.href)}
                    aria-current={linkActive ? "location" : undefined}
                    className={cn(
                      "inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-base font-medium transition-all duration-200 select-none active:scale-95",
                      linkActive
                        ? "bg-brand-50 text-brand-900"
                        : "text-brand-700 hover:bg-brand-50 hover:text-brand-900",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <AuthControl session={session} className={authButtonClasses} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-11 items-center justify-center rounded-full text-brand-900 transition-all hover:bg-brand-50 active:scale-90 lg:hidden"
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
                <li key={link.href}>
                  <Link
                    href={resolveHref(link.href)}
                    onClick={(e) => onNavClick(e, link.href)}
                    aria-current={linkActive ? "location" : undefined}
                    className={cn(
                      "flex items-center rounded-xl px-4 py-3.5 text-lg font-medium transition-all select-none active:scale-[0.98]",
                      linkActive
                        ? "bg-brand-800 text-white"
                        : "text-brand-800 hover:bg-brand-50 active:bg-brand-100",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-t border-brand-100 pt-2">
              <AuthControl
                session={session}
                className={mobileAuthClasses}
                onNavigate={() => setOpen(false)}
              />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
