import { cn } from "@/lib/utils";
import { themes } from "./content";

export function ThemesMarquee({ className }: { className?: string }) {
  const items = [...themes, ...themes];

  return (
    <section
      aria-label="What we stand for"
      className={cn(
        "relative overflow-hidden border-y border-brand-100 bg-brand-50 py-2 sm:py-6",
        className,
      )}
    >
      <div className="animate-marquee flex w-max gap-8 sm:gap-12 hover:[animation-play-state:paused]">
        {items.map((theme, i) => (
          <span
            key={`${theme}-${i}`}
            aria-hidden={i >= themes.length}
            className="flex items-center gap-8 sm:gap-12 font-heading text-base font-semibold whitespace-nowrap text-brand-800/80 sm:text-2xl"
          >
            {theme}
            <span className="flex h-3.5 gap-1 sm:h-5" aria-hidden>
              <span className="w-1.5 rounded-[1px] bg-brand-800" />
              <span className="w-1.5 rounded-[1px] bg-brand-800/75" />
              <span className="w-1.5 rounded-[1px] bg-brand-800/50" />
            </span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-linear-to-r from-brand-50" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-l from-brand-50" />
    </section>
  );
}
