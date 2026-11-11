import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "color" | "white";
  /** Smaller mark for portal headers on mobile. */
  compact?: boolean;
  href?: string;
  className?: string;
};

export function Logo({ variant = "color", compact = false, href = "/", className }: LogoProps) {
  return (
    <Link
      href={href}
      prefetch
      aria-label="Vitaran Learning home"
      className={cn("relative z-10 inline-flex shrink-0 items-center", className)}
    >
      <Image
        src="/brand/vitaran-logo.png"
        alt="Vitaran Learning"
        width={compact ? 88 : 100}
        height={compact ? 34 : 39}
        priority
        className={cn(
          "w-auto",
          compact ? "h-8" : "h-12",
          // The PNG has a solid white background: blend it away on dark surfaces.
          variant === "white" ? "mix-blend-screen grayscale invert" : "mix-blend-multiply",
        )}
      />
    </Link>
  );
}

export function BrandBars({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-stretch gap-[6%]", className)}>
      {[1, 0.75, 0.5].map((opacity, i) => (
        <span
          key={opacity}
          className="animate-bar-rise flex-1 origin-bottom rounded-[2px] bg-current"
          style={{ opacity, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}
