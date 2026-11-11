import type { ReactNode } from "react";

/** Compact dark brand banner with the page title, at the top of inner site pages. */
export function PageHero({ title }: { title: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-950 pt-24 pb-7 text-white sm:pt-26 sm:pb-8">
      <div className="bg-grid absolute inset-0 -z-10 mask-[radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="absolute -top-40 left-1/2 -z-10 size-120 -translate-x-1/2 rounded-full bg-brand-700/40 blur-[120px]" />

      <h1 className="mx-auto max-w-3xl px-5 text-center text-2xl leading-tight font-bold sm:px-8 sm:text-3xl">
        {title}
      </h1>
    </section>
  );
}
