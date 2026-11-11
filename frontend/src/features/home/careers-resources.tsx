import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { programs } from "@/features/teachers-resources/content";

export function CareersAndResources() {
  return (
    <section className="py-10 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-4 px-5 sm:gap-6 sm:px-8 lg:grid-cols-2">
        <Reveal>
          <article
            id="careers"
            className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-linear-to-br from-brand-800 to-brand-950 p-6 text-white sm:rounded-[2rem] sm:p-12"
          >
            <div className="bg-grid absolute inset-0 opacity-60" />
            <div className="absolute -right-20 -bottom-20 size-72 rounded-full bg-glow/25 blur-3xl" />
            <div className="relative">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white/15 sm:size-12 sm:rounded-2xl">
                <Briefcase className="size-4.5 sm:size-5" />
              </span>
              <h2 className="mt-4 text-xl font-bold sm:mt-8 sm:text-4xl">
                Grow with us
              </h2>
              <p className="mt-4 hidden max-w-md text-lg leading-relaxed text-brand-200/85 sm:block">
                We foster a culture of continuous learning and growth. Join
                subject experts, instructional designers, writers and artists shaping
                the future of learning.
              </p>
            </div>
            <Link
              href="/contact"
              className="group relative mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-100 sm:mt-10 sm:px-6 sm:py-3"
            >
              View open roles
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </article>
        </Reveal>

        <Reveal delay={120}>
          <article
            id="resources"
            className="flex h-full flex-col rounded-3xl border border-brand-100 bg-brand-50 p-6 sm:rounded-[2rem] sm:p-12"
          >
            <h2 className="text-xl font-bold text-brand-900 sm:text-4xl">
              Teachers Resources
            </h2>
            <p className="mt-4 hidden max-w-md text-lg leading-relaxed text-muted-foreground sm:block">
              Solution books for all our programs, in one place.
            </p>
            <ul className="mt-4 space-y-2 sm:mt-8 sm:space-y-3">
              {programs.slice(0, 3).map((program) => (
                <li key={program.title}>
                  <Link
                    href="/teachers-resources"
                    className="group flex items-center gap-3 rounded-xl border border-brand-100 bg-white p-3 transition-all hover:border-brand-300 hover:shadow-[0_12px_30px_-15px_rgb(25_28_95/0.35)] sm:gap-4 sm:rounded-2xl sm:p-4"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800 sm:size-11 sm:rounded-xl">
                      <program.icon className="size-4.5 sm:size-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-brand-900 sm:text-base">
                        {program.title}
                      </span>
                      <span className="hidden text-sm text-muted-foreground sm:block">
                        Solution books
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-brand-400 transition-transform group-hover:translate-x-1 group-hover:text-brand-800" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/teachers-resources"
              className="group mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-95 sm:mt-8 sm:px-6 sm:py-3"
            >
              View all programs
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
