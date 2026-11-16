"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const items = ["Corporates", "Industries", "K–12"] as const;

/** Mobile-only trust strip under the hero. */
export function TrustBar() {
  return (
    <section className="border-y border-[#eee9ff] bg-white py-3.5 sm:hidden">
      <motion.ul
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto flex max-w-7xl items-center justify-center gap-2.5 px-4 text-[0.8rem] font-semibold text-[#2a2670]"
      >
        {items.map((item, index) => (
          <li key={item} className="inline-flex items-center gap-1.5">
            {index > 0 ? <span className="mr-1 text-[#ddd6fe]">|</span> : null}
            <CheckCircle2 className="size-3.5 text-[#7c3aed]" />
            {item}
          </li>
        ))}
      </motion.ul>
    </section>
  );
}
