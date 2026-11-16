import { CheckCircle2 } from "lucide-react";
import { HeroLoginButton } from "./hero-login-button";

const TRUST_REGIONS = ["Andhra Pradesh", "Telangana", "Karnataka"] as const;

/** Transparent cutout — cache-bust when the asset changes. */
const HERO_IMG = "/marketing/hero-student.png?v=10";

function HeroPhoto({ className }: { className?: string }) {
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- cutout PNG needs raw alpha */}
      <img
        src={HERO_IMG}
        alt="Student learning online with Vitaran Learning on a laptop"
        width={900}
        height={599}
        fetchPriority="high"
        decoding="async"
        className="relative z-10 size-full origin-bottom object-contain object-bottom"
      />
    </div>
  );
}

function LearningMark({
  className,
  swooshClassName,
  stroke,
  strokeUrl,
}: {
  className: string;
  swooshClassName: string;
  stroke?: string;
  strokeUrl?: boolean;
}) {
  return (
    <span className={className}>
      learning.
      <svg
        aria-hidden
        className={swooshClassName}
        viewBox="0 0 220 14"
        preserveAspectRatio="none"
      >
        <path
          d="M2 9c50-8 98 5 145-2 28-4 50-3 71 3"
          fill="none"
          stroke={strokeUrl ? "url(#swooshGrad)" : stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {strokeUrl ? (
          <defs>
            <linearGradient id="swooshGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
          </defs>
        ) : null}
      </svg>
    </span>
  );
}

/** Same trust block as desktop (≥1025px) — stays inside the purple hero on every width. */
function HeroTrust({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="shrink-0 text-[0.8rem] font-medium text-[#9ca3af] sm:text-[0.9625rem]">
          Trusted by top schools across
        </span>
        <span className="h-px min-w-4 flex-1 bg-[#d4d0e8]" />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 sm:mt-4 sm:gap-x-8">
        {TRUST_REGIONS.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-[#2a2670] sm:gap-2 sm:text-[0.9625rem]"
          >
            <CheckCircle2 className="size-3.5 shrink-0 text-[#7c3aed] sm:size-4" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Server-rendered hero — visible on first HTML paint (no opacity-0 wait for JS). */
export function Hero() {
  return (
    <section className="relative overflow-x-clip bg-[#ebe6f8] pt-[5.5rem] pb-10 sm:pt-28 sm:pb-14 lg:pb-16">
      <link rel="preload" as="image" href={HERO_IMG} fetchPriority="high" />
      <div id="about" className="pointer-events-none absolute top-24" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_78%_42%,rgba(139,92,246,0.32),transparent_58%),radial-gradient(ellipse_45%_35%_at_8%_18%,rgba(167,139,250,0.22),transparent_52%),linear-gradient(180deg,#e4dff4_0%,#ebe6f8_55%,#f3f0fa_100%)]"
      />

      {/* Mobile — copy → trust → image (all inside purple hero) */}
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:hidden">
        <div className="flex flex-col gap-6 pt-2">
          <div className="relative z-10">
            <h1 className="text-[1.815rem] leading-[1.18] font-extrabold tracking-tight text-[#1a1750]">
              Transforming the way of{" "}
              <LearningMark
                className="relative inline-block pb-2.5 text-[#7c3aed]"
                swooshClassName="absolute inset-x-0 bottom-0 h-2 w-full"
                stroke="#a78bfa"
              />
            </h1>
            <p className="mt-3 max-w-[22rem] text-[0.9rem] leading-relaxed text-[#6b7280]">
              From curriculum design to assessments and art production, we create learning content
              that students genuinely enjoy.
            </p>
            <div className="mt-5">
              <HeroLoginButton
                className="inline-flex items-center gap-1.5 rounded-full bg-[#2a2670] px-5 py-2.5 text-[0.825rem] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(42,38,112,0.65)]"
                iconClassName="size-3.5"
              />
            </div>
            <HeroTrust className="mt-8" />
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <HeroPhoto className="relative mx-auto aspect-3/2 w-full" />
          </div>
        </div>
      </div>

      {/* Tablet / desktop — same trust block as ≥1025px, always in the copy column */}
      <div className="relative mx-auto hidden w-full max-w-7xl items-center gap-8 px-5 sm:grid sm:gap-10 sm:px-8 lg:grid-cols-2 lg:gap-10 lg:min-h-[calc(100svh-8rem)]">
        <div className="relative z-10 order-1">
          <h1 className="text-[2.75rem] leading-[1.1] font-extrabold tracking-tight text-[#1a1750] md:text-[3.3rem] lg:text-[3.685rem] lg:leading-[1.08]">
            Transforming the way of{" "}
            <LearningMark
              className="relative inline-block bg-linear-to-r from-[#7c3aed] via-[#9333ea] to-[#db2777] bg-clip-text pb-3 text-transparent"
              swooshClassName="absolute inset-x-0 bottom-0 h-3 w-full"
              strokeUrl
            />
          </h1>

          <p className="mt-5 max-w-md text-lg leading-relaxed text-[#6b7280] md:text-[1.2375rem]">
            From curriculum design to assessments and art production, we create learning content
            that students genuinely enjoy.
          </p>

          <div className="mt-8">
            <HeroLoginButton
              className="group inline-flex items-center gap-2 rounded-full bg-[#2a2670] px-7 py-3.5 text-[0.9625rem] font-semibold text-white shadow-[0_14px_36px_-12px_rgba(42,38,112,0.65)] transition hover:bg-[#1a1750]"
              iconClassName="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </div>

          <HeroTrust className="mt-10" />
        </div>

        <div className="relative order-2 mx-auto flex w-full max-w-[48rem] items-end justify-center self-center lg:max-w-none lg:w-[130%] lg:translate-x-6">
          <HeroPhoto className="relative w-full scale-[0.99] lg:scale-[1.08]" />
        </div>
      </div>
    </section>
  );
}
