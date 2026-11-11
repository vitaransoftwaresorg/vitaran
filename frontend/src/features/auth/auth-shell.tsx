import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";

type AuthShellProps = {
  badge: string;
  title: ReactNode;
  description?: string;
  highlights: { icon: LucideIcon; title: string; description: string }[];
  footnote: ReactNode;
  /** Visible jump to the other portal login. */
  switcher?: { href: string; label: string; hint: string };
  /** The sign-in form. */
  children: ReactNode;
};

/** Full-screen sign-in layout shared by the admin and school logins. */
export function AuthShell({
  badge,
  title,
  description,
  highlights,
  footnote,
  switcher,
  children,
}: AuthShellProps) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-brand-950 text-white">
      <div className="bg-grid absolute inset-0 -z-10 mask-[radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="absolute -top-40 left-1/2 -z-10 size-200 -translate-x-1/2 rounded-full bg-brand-700/40 blur-[140px]" />
      <div className="absolute right-0 bottom-0 -z-10 size-120 rounded-full bg-glow/20 blur-[120px]" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo variant="white" />
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-brand-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          Back to website
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-5 pt-4 pb-20 sm:px-8 lg:grid-cols-[1fr_1fr] lg:pt-0">
        <div className="hidden lg:block">
          <p className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-200 backdrop-blur duration-700">
            <ShieldCheck className="size-3.5 text-glow" />
            {badge}
          </p>
          <h1 className="animate-in fade-in slide-in-from-bottom-6 mt-7 text-4xl leading-tight font-extrabold text-balance duration-700 sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="animate-in fade-in slide-in-from-bottom-8 mt-5 max-w-md text-lg leading-relaxed text-brand-200/85 duration-1000">
              {description}
            </p>
          ) : null}

          <ul className="mt-10 space-y-5">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                  <item.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-sm text-brand-300">{item.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-md duration-700 lg:mx-0 lg:justify-self-end">
          {children}
          {switcher ? (
            <div className="mt-4 space-y-2">
              <p className="text-center text-sm text-brand-200">{switcher.hint}</p>
              <Link
                href={switcher.href}
                className="flex h-11 w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {switcher.label}
              </Link>
            </div>
          ) : null}
          <p className="mt-4 text-center text-xs leading-relaxed text-brand-300">{footnote}</p>
        </div>
      </div>
    </main>
  );
}
