"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { IconOpenBook } from "./marketing-icons";

export function Contact() {
  return (
    <section id="contact" className="bg-white px-5 pb-14 sm:px-8 sm:pb-20">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto flex max-w-7xl flex-col overflow-hidden rounded-[1.6rem] bg-[linear-gradient(120deg,#2a2670_0%,#3b2d8f_42%,#2e1065_100%)] p-7 text-white shadow-[0_28px_70px_-34px_rgba(42,38,112,0.8)] sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:rounded-[1.85rem] sm:p-11 lg:p-14"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_12%_18%,rgba(167,139,250,0.32),transparent_34%),radial-gradient(circle_at_88%_78%,rgba(192,38,211,0.16),transparent_28%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -bottom-10 h-40 w-56 rounded-[40%] bg-white/5 blur-2xl sm:h-48 sm:w-72"
        />
        <IconOpenBook className="pointer-events-none absolute right-3 bottom-1 h-24 w-32 opacity-25 sm:right-8 sm:bottom-3 sm:h-28 sm:w-40" />

        <div className="relative max-w-2xl">
          <h2 className="text-[1.55rem] font-extrabold tracking-tight text-balance sm:text-3xl lg:text-[2.45rem]">
            Let&apos;s build a smarter learning future{" "}
            <span className="bg-linear-to-r from-[#e9d5ff] to-[#f5d0fe] bg-clip-text text-transparent">
              together.
            </span>
          </h2>
          <p className="mt-3 text-sm text-white/70 sm:text-base">
            Partner with Vitaran Learning for innovative and effective solutions.
          </p>
        </div>

        <Link
          href="/contact"
          className="group relative mt-6 inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1a1750] transition hover:bg-[#f8fafc] sm:mt-0 sm:px-7 sm:py-3.5"
        >
          Get in Touch
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </section>
  );
}
