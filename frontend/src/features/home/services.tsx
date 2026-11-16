"use client";

import type { ComponentType } from "react";
import { motion } from "framer-motion";
import {
  IconBook,
  IconChart,
  IconClipboard,
  IconHeadset,
  IconPalette,
  IconShield,
} from "./marketing-icons";

const cards: Array<{
  title: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  tone: string;
}> = [
  {
    title: "Curriculum Design",
    description: "Well-structured and age-appropriate content.",
    Icon: IconBook,
    tone: "bg-[#f3e8ff]",
  },
  {
    title: "Assessments",
    description: "Evaluate with accuracy and ease.",
    Icon: IconClipboard,
    tone: "bg-[#dbeafe]",
  },
  {
    title: "Art Production",
    description: "Creative and interactive learning materials.",
    Icon: IconPalette,
    tone: "bg-[#ffedd5]",
  },
  {
    title: "Student Engagement",
    description: "Interactive content that students love.",
    Icon: IconChart,
    tone: "bg-[#dcfce7]",
  },
  {
    title: "Trusted Quality",
    description: "Built for better learning outcomes.",
    Icon: IconShield,
    tone: "bg-[#ede9fe]",
  },
  {
    title: "Dedicated Support",
    description: "We're here to support your learning journey.",
    Icon: IconHeadset,
    tone: "bg-[#ccfbf1]",
  },
];

export function Services() {
  return (
    <section id="services" className="scroll-mt-24 bg-white py-12 sm:py-16 lg:py-20">
      <div id="features" className="mx-auto max-w-7xl scroll-mt-24 px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-[#d4d4d8] sm:w-12" />
            <p className="text-sm font-medium text-[#6b7280]">Our Solutions</p>
            <span className="h-px w-8 bg-[#d4d4d8] sm:w-12" />
          </div>
          <h2 className="mt-3 text-[1.55rem] font-extrabold tracking-tight text-[#1a1750] sm:text-4xl lg:text-[2.75rem]">
            Smart &amp; Engaging{" "}
            <span className="bg-linear-to-r from-[#7c3aed] to-[#c026d3] bg-clip-text text-transparent">
              Learning
            </span>{" "}
            Solutions
          </h2>
          <p className="mx-auto mt-3 hidden max-w-xl text-base text-[#6b7280] sm:block">
            Powerful tools and content to make learning effective and enjoyable.
          </p>
        </motion.div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-5 lg:grid-cols-3">
          {cards.map((card, i) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: (i % 3) * 0.06, duration: 0.35 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`flex items-center gap-2.5 rounded-2xl bg-[#f8f6ff] p-3 shadow-[0_10px_28px_-16px_rgba(42,38,112,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] sm:items-start sm:gap-4 sm:rounded-[1.35rem] sm:p-5 sm:shadow-[0_14px_40px_-24px_rgba(42,38,112,0.4)] lg:p-6 ${card.tone} max-sm:!bg-[#f8f6ff]`}
            >
              <card.Icon className="size-9 shrink-0 sm:size-14 lg:size-16" />
              <div className="min-w-0 sm:pt-0.5">
                <h3 className="text-[0.78rem] leading-snug font-bold text-[#1a1750] sm:text-base lg:text-lg">
                  {card.title}
                </h3>
                <p className="mt-1.5 hidden text-sm leading-relaxed text-[#4b5563] sm:block">
                  {card.description}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
