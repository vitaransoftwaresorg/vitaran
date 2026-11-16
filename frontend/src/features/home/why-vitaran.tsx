"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, GraduationCap, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const features: Array<{
  title: string;
  description: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  {
    title: "Expert-Led Content",
    description: "Learning materials developed with subject expertise.",
    Icon: GraduationCap,
  },
  {
    title: "Quality-Focused Approach",
    description: "Carefully designed and reviewed educational content.",
    Icon: BadgeCheck,
  },
  {
    title: "Creative Learning Experiences",
    description: "Engaging visuals and interactive materials that make learning enjoyable.",
    Icon: Sparkles,
  },
  {
    title: "End-to-End Solutions",
    description: "From curriculum planning to assessment and production.",
    Icon: Layers,
  },
];

/** Why Choose Vitaran — sits between Our Solutions and School Partners. */
export function WhyVitaran() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="why-vitaran"
      aria-labelledby="why-vitaran-heading"
      className="relative scroll-mt-24 overflow-hidden py-12 sm:py-16 lg:py-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_12%_20%,rgba(167,139,250,0.28),transparent_55%),radial-gradient(ellipse_50%_45%_at_88%_70%,rgba(192,38,211,0.12),transparent_50%),linear-gradient(165deg,#ebe6f8_0%,#f3f0fa_48%,#faf8ff_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-8%] size-[22rem] rounded-full bg-[rgb(124_58_237/0.1)] blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 sm:gap-12 sm:px-8 lg:grid-cols-2 lg:gap-14 xl:gap-16">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.45 }}
          className="max-w-xl"
        >
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#c4b5fd] sm:w-10" />
            <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-[#7c3aed] uppercase">
              Why Vitaran Learning
            </p>
          </div>

          <h2
            id="why-vitaran-heading"
            className="mt-3 text-[1.55rem] font-extrabold tracking-tight text-balance text-[#1a1750] sm:mt-4 sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15]"
          >
            Learning Designed Around{" "}
            <span className="bg-linear-to-r from-[#7c3aed] to-[#c026d3] bg-clip-text text-transparent">
              Every Learner
            </span>
          </h2>

          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6b7280] sm:mt-4 sm:text-base">
            We combine educational expertise, creative thinking, and technology to create
            meaningful learning experiences.
          </p>

          <div className="relative mt-8 overflow-hidden rounded-2xl border border-[#ddd6fe]/80 shadow-[0_24px_60px_-28px_rgba(42,38,112,0.45)] sm:mt-10 sm:rounded-[1.75rem]">
            <Image
              src="/marketing/why-vitaran-classroom.jpg"
              alt="Teacher and students learning together in a bright classroom"
              width={1376}
              height={768}
              sizes="(max-width: 1024px) 100vw, 36rem"
              className="aspect-16/10 w-full object-cover object-center"
            />
          </div>
        </motion.div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {features.map((feature, i) => (
            <motion.li
              key={feature.title}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: reduceMotion ? 0 : i * 0.07, duration: 0.4 }}
            >
              <motion.article
                whileHover={reduceMotion ? undefined : { y: -4, transition: { duration: 0.2 } }}
                className={cn(
                  "group h-full rounded-2xl border border-[#ede9fe] bg-white p-4 shadow-[0_14px_36px_-22px_rgba(42,38,112,0.4)]",
                  "transition-[border-color,box-shadow] duration-200",
                  "hover:border-[#ddd6fe] hover:shadow-[0_22px_48px_-24px_rgba(42,38,112,0.5)]",
                  "sm:rounded-[1.35rem] sm:p-5",
                )}
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-[#ede9fe] to-[#ddd6fe] text-[#6d28d9] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-200 group-hover:scale-105 sm:size-12 sm:rounded-2xl">
                  <feature.Icon className="size-5 sm:size-[1.35rem]" aria-hidden />
                </div>
                <h3 className="mt-3.5 text-[0.95rem] font-bold text-[#1a1750] sm:mt-4 sm:text-base">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6b7280]">{feature.description}</p>
              </motion.article>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
