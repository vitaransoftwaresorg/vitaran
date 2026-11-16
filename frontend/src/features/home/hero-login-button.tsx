"use client";

import { ArrowRight } from "lucide-react";
import { openLoginDropdown } from "@/features/auth/login-dropdown";
import { cn } from "@/lib/utils";

/** Tiny client island — keeps the rest of the hero as instant server HTML. */
export function HeroLoginButton({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <button type="button" onClick={() => openLoginDropdown()} className={cn(className)}>
      Log in
      <ArrowRight className={iconClassName} />
    </button>
  );
}
