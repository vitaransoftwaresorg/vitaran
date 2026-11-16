import { cn } from "@/lib/utils";
import { themes } from "./content";

export function ThemesMarquee({ className }: { className?: string }) {
  const items = [...themes, ...themes];

  return (
    <section
      aria-label="What we stand for"
      className={cn(
        "relative overflow-hidden border-y border-brand-100/80 bg-[#f8f7ff] py-3 sm:py-5",
        className,
      )}
    >
      <div className="animate-marquee flex w-max gap-8 sm:gap-12 hover:[animation-play-state:paused]">
        {items.map((theme, i) => (
          <span
            key={`${theme}-${i}`}
            aria-hidden={i >= themes.length}
            className="flex items-center gap-8 font-heading text-base font-semibold whitespace-nowrap text-brand-800/80 sm:gap-12 sm:text-2xl"
          >
            {theme}
            <span className="flex h-3.5 gap-1 sm:h-5" aria-hidden>
              <span className="w-1.5 rounded-[1px] bg-accent-violet" />
              <span className="w-1.5 rounded-[1px] bg-accent-violet/70" />
              <span className="w-1.5 rounded-[1px] bg-accent-pink/70" />
            </span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r from-[#f8f7ff] sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-[#f8f7ff] sm:w-24" />
    </section>
  );
}
