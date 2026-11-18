"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SCHOOL_LOGIN_PATH } from "@/constants/auth";
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
    <>
      <Link href={SCHOOL_LOGIN_PATH} className={cn(className, "lg:hidden")}>
        Log in
        <ArrowRight className={iconClassName} />
      </Link>
      <button
        type="button"
        onClick={() => openLoginDropdown()}
        className={cn(className, "hidden lg:inline-flex")}
      >
        Log in
        <ArrowRight className={iconClassName} />
      </button>
    </>
  );
}
