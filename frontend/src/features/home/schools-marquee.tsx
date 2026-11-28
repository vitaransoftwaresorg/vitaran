"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { School } from "lucide-react";
import { usePublicSettings } from "@/features/settings/use-public-settings";
import { cn } from "@/lib/utils";
import { PARTNER_SCHOOLS, type PartnerSchool } from "@/features/home/partner-schools";

type SchoolsMarqueeProps = {
  className?: string;
};

function SchoolLogoItem({
  school,
  duplicate,
  eager,
}: {
  school: PartnerSchool;
  duplicate?: boolean;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure
      aria-hidden={duplicate || undefined}
      className="group flex w-[8.5rem] shrink-0 flex-col items-center gap-3 sm:w-[10.5rem]"
    >
      <div className="relative flex size-[5.5rem] items-center justify-center sm:size-28">
        {!failed ? (
          <Image
            src={school.logoSrc}
            alt={duplicate ? "" : `${school.name} logo`}
            width={160}
            height={160}
            sizes="(max-width: 640px) 88px, 112px"
            quality={75}
            priority={eager && !duplicate}
            loading={eager && !duplicate ? "eager" : "lazy"}
            draggable={false}
            onError={() => setFailed(true)}
            className="size-full object-contain transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <School className="size-10 text-brand-300 sm:size-12" aria-hidden />
        )}
      </div>
      <figcaption className="w-full text-center">
        <span className="line-clamp-2 text-[0.78rem] leading-snug font-semibold text-brand-900 sm:text-sm">
          {school.name}
        </span>
      </figcaption>
    </figure>
  );
}

function MarqueeTrack({
  schools,
  durationSec,
}: {
  schools: PartnerSchool[];
  durationSec: number;
}) {
  const loop = useMemo(() => [...schools, ...schools], [schools]);

  return (
    <div
      className={cn(
        "animate-marquee flex w-max items-start gap-8 sm:gap-12",
        "hover:[animation-play-state:paused] motion-reduce:animate-none",
      )}
      style={{ animationDuration: `${durationSec}s` }}
    >
      {loop.map((school, index) => (
        <SchoolLogoItem
          key={`${school.id}-${index}`}
          school={school}
          duplicate={index >= schools.length}
          eager={index < 4}
        />
      ))}
    </div>
  );
}

export function SchoolsMarquee({ className }: SchoolsMarqueeProps) {
  const reduceMotion = useReducedMotion();
  const { settings, ready } = usePublicSettings();
  const schools = PARTNER_SCHOOLS;

  // Default on until settings load; hide when admin disables "Our network".
  if (ready && !settings.homeNetworkEnabled) return null;
  if (schools.length === 0) return null;

  const durationSec = Math.max(32, schools.length * 7);

  return (
    <section
      aria-label="Schools we partner with"
      className={cn(
        "relative overflow-hidden border-y border-brand-100/60 bg-white py-10 sm:py-14",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_50%_-10%,rgba(124,58,237,0.06),transparent_60%)]"
      />

      <div className="relative mx-auto mb-8 max-w-7xl px-5 text-center sm:mb-10 sm:px-8">
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.35 }}
          className="text-[0.7rem] font-semibold tracking-[0.18em] text-brand-400 uppercase"
        >
          Our network
        </motion.p>
        <motion.h2
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.4, delay: 0.04 }}
          className="mt-2 font-heading text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl"
        >
          Our School Partners
        </motion.h2>
      </div>

      {reduceMotion ? (
        <ul className="relative mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-5 sm:grid-cols-3 sm:px-8 md:grid-cols-4 lg:grid-cols-5">
          {schools.map((school, index) => (
            <li key={school.id} className="flex justify-center">
              <SchoolLogoItem school={school} eager={index < 4} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="relative overflow-hidden py-1">
          <MarqueeTrack schools={schools} durationSec={durationSec} />
        </div>
      )}

      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-white to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-white to-transparent sm:w-24" />
    </section>
  );
}
