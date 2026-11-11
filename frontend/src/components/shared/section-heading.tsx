import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

type SectionHeadingProps = {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "light",
}: SectionHeadingProps) {
  const dark = tone === "dark";

  return (
    <Reveal
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
      )}
    >
      <p
        className={cn(
          "inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase",
          dark ? "text-brand-300" : "text-brand-500",
        )}
      >
        <span className="flex h-3 gap-0.5" aria-hidden>
          <span className="w-1 rounded-[1px] bg-current" />
          <span className="w-1 rounded-[1px] bg-current opacity-75" />
          <span className="w-1 rounded-[1px] bg-current opacity-50" />
        </span>
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-3 text-2xl font-bold text-balance sm:mt-4 sm:text-4xl lg:text-5xl",
          dark ? "text-white" : "text-brand-900",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-5 hidden text-lg leading-relaxed text-pretty sm:block",
            dark ? "text-brand-200/80" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}
