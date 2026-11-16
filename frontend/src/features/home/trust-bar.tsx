import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const TRUST_REGIONS = ["Andhra Pradesh", "Telangana", "Karnataka"] as const;

/** Compact one-line region strip — used inside the hero so it cannot spill a separate section. */
export function TrustRegions({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "flex w-full flex-nowrap items-center justify-center gap-x-1.5 text-[0.7rem] leading-none font-semibold text-[#2a2670] sm:gap-x-2.5 sm:text-[0.8rem] md:gap-x-3 md:text-[0.875rem]",
        className,
      )}
    >
      {TRUST_REGIONS.map((item, index) => (
        <li key={item} className="flex shrink-0 flex-nowrap items-center gap-x-1 sm:gap-x-1.5">
          {index > 0 ? (
            <span className="mr-0.5 text-[#ddd6fe] sm:mr-1" aria-hidden>
              |
            </span>
          ) : null}
          <CheckCircle2 className="size-3 shrink-0 text-[#7c3aed] sm:size-3.5" aria-hidden />
          <span className="whitespace-nowrap">{item}</span>
        </li>
      ))}
    </ul>
  );
}
