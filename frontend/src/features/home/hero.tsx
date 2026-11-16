"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { openLoginDropdown } from "@/features/auth/login-dropdown";

const trustItems = ["Corporates", "Industries", "K-12"] as const;

/** Transparent cutout only — no baked/CSS background on the image. */
const HERO_IMG = "/marketing/hero-student.png?v=8";

function HeroPhoto({ className }: { className?: string }) {
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- cutout PNG needs raw alpha */}
      <img
        src={HERO_IMG}
        alt="Students studying together with books"
        width={1392}
        height={929}
        className="relative z-10 size-full object-contain object-bottom"
      />
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-center overflow-x-clip bg-[#ebe6f8] pt-[5.5rem] pb-12 sm:pt-28 sm:pb-16 lg:pb-20">
      <div id="about" className="pointer-events-none absolute top-24" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_78%_42%,rgba(139,92,246,0.32),transparent_58%),radial-gradient(ellipse_45%_35%_at_8%_18%,rgba(167,139,250,0.22),transparent_52%),linear-gradient(180deg,#e4dff4_0%,#ebe6f8_55%,#f3f0fa_100%)]"
      />

      {/* Mobile — copy first, image below (no side-by-side overlap) */}
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:hidden">
        <div className="flex flex-col gap-6 pt-2 pb-4">
          <div className="relative z-10">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="text-[1.75rem] leading-[1.18] font-extrabold tracking-tight text-[#1a1750]"
            >
              Transforming the way of{" "}
              <span className="relative inline-block text-[#7c3aed]">
                learning.
                <svg
                  aria-hidden
                  className="absolute inset-x-0 -bottom-0.5 h-2 w-full"
                  viewBox="0 0 220 14"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 9c50-8 98 5 145-2 28-4 50-3 71 3"
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.06 }}
              className="mt-3 max-w-[22rem] text-[0.9rem] leading-relaxed text-[#6b7280]"
            >
              From curriculum design to assessments and art production, we create learning content
              that students genuinely enjoy.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12 }}
              className="mt-5"
            >
              <button
                type="button"
                onClick={() => openLoginDropdown()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#2a2670] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(42,38,112,0.65)]"
              >
                Log in
                <ArrowRight className="size-3.5" />
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="relative mx-auto w-full max-w-sm"
          >
            <HeroPhoto className="relative mx-auto aspect-[3/2] w-full" />
          </motion.div>
        </div>
      </div>

      {/* Tablet / desktop — stacked until lg, then two columns */}
      <div className="relative mx-auto hidden w-full max-w-7xl flex-1 items-center gap-8 px-5 sm:grid sm:min-h-[calc(100svh-8rem)] sm:gap-10 sm:px-8 lg:grid-cols-2 lg:gap-10">
        <div className="order-1">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl leading-[1.1] font-extrabold tracking-tight text-[#1a1750] lg:text-[3.35rem] lg:leading-[1.08]"
          >
            Transforming the way of{" "}
            <span className="relative inline-block bg-linear-to-r from-[#7c3aed] via-[#9333ea] to-[#db2777] bg-clip-text text-transparent">
              learning.
              <svg
                aria-hidden
                className="absolute inset-x-0 -bottom-1.5 h-3 w-full"
                viewBox="0 0 220 14"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 9c50-8 98 5 145-2 28-4 50-3 71 3"
                  fill="none"
                  stroke="url(#swooshGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="swooshGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#db2777" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-5 max-w-md text-lg leading-relaxed text-[#6b7280]"
          >
            From curriculum design to assessments and art production, we create learning content
            that students genuinely enjoy.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-8"
          >
            <button
              type="button"
              onClick={() => openLoginDropdown()}
              className="group inline-flex items-center gap-2 rounded-full bg-[#2a2670] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_36px_-12px_rgba(42,38,112,0.65)] transition hover:bg-[#1a1750]"
            >
              Log in
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="mt-10"
          >
            <div className="flex items-center gap-4">
              <span className="shrink-0 text-sm font-medium text-[#9ca3af]">Trusted by</span>
              <span className="h-px flex-1 bg-[#e5e7eb]" />
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {trustItems.map((item) => (
                <li key={item} className="inline-flex items-center gap-2 text-sm font-semibold text-[#2a2670]">
                  <CheckCircle2 className="size-4 text-[#7c3aed]" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative order-2 mx-auto flex w-full max-w-[40rem] items-end justify-center lg:max-w-none lg:min-h-[28rem]"
        >
          <HeroPhoto className="relative w-full lg:min-h-[28rem]" />
        </motion.div>
      </div>
    </section>
  );
}
