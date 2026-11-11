import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle, Sparkles } from "lucide-react";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
import { LearningMap } from "./learning-map";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-7.125rem)] items-center overflow-hidden bg-brand-950 py-10 text-white sm:block sm:min-h-0 sm:pt-40 sm:pb-24 lg:pb-32">
      <div className="bg-grid absolute inset-0 -z-10 mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute -top-40 left-1/2 -z-10 size-200 -translate-x-1/2 rounded-full bg-brand-700/40 blur-[140px]" />
      <div className="absolute right-0 bottom-0 -z-10 size-120 rounded-full bg-glow/20 blur-[120px]" />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="animate-in fade-in slide-in-from-bottom-4 hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-200 backdrop-blur duration-700 sm:inline-flex">
            <Sparkles className="size-3.5 text-glow" />
            Fostering a culture of continuous learning
          </div>

          <h1 className="animate-in fade-in slide-in-from-bottom-6 text-[1.75rem] leading-[1.15] font-extrabold text-balance duration-700 sm:mt-8 sm:text-6xl sm:leading-[1.05] lg:text-7xl">
            Transforming the way of{" "}
            <span className="text-gradient">learning</span>
            <span className="hidden sm:inline"> through expert-led innovation</span>.
          </h1>

          <p className="animate-in fade-in slide-in-from-bottom-8 mt-4 text-[0.9375rem] leading-relaxed text-brand-200/85 duration-1000 sm:hidden">
            From curriculum design to assessments and art production, we create
            learning content that students genuinely enjoy.
          </p>
          <p className="animate-in fade-in slide-in-from-bottom-8 mt-7 hidden max-w-xl text-lg leading-relaxed text-brand-200/85 duration-1000 sm:block">
            From curriculum and course development to instructional design,
            assessment and art production, we create educational content for{" "}
            <span className="whitespace-nowrap">K-12</span>, corporates and
            industries that learners genuinely enjoy.
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-8 mt-7 flex gap-3 duration-1000 sm:mt-10">
            <Link
              href={SCHOOL_LOGIN_PATH}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-brand-900 shadow-[0_10px_40px_-10px_rgb(143_149_255/0.7)] transition-all hover:bg-brand-100 sm:hidden"
            >
              Log in
            </Link>
            <Link
              href="/contact"
              className="group hidden items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-brand-900 shadow-[0_10px_40px_-10px_rgb(143_149_255/0.7)] transition-all hover:bg-brand-100 sm:inline-flex"
            >
              Contact us
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/#services"
              className="hidden items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:inline-flex"
            >
              <PlayCircle className="size-4" />
              Explore services
            </Link>
          </div>

          <ul className="animate-in fade-in mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-300 duration-1000 sm:mt-12 sm:gap-x-8 sm:gap-y-3">
            {["Corporates", "Industries", "K-12"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-glow" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden sm:block">
          <LearningMap />
        </div>
      </div>
    </section>
  );
}
