"use client";

import { useEffect, useState } from "react";

/** True for phones/tablets — not merely a narrowed desktop window. */
export function detectPhoneClient() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const touchPoints = navigator.maxTouchPoints || 0;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const mobileUa = /iPhone|iPod|Android.+Mobile|Mobile.+Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  );
  // iPadOS often reports as Macintosh; treat multi-touch Mac as a tablet.
  const iPad =
    /iPad/i.test(ua) ||
    (touchPoints > 1 && /Macintosh/i.test(ua) && noHover);
  return mobileUa || iPad || (coarse && noHover && touchPoints > 0);
}

/** Same phone/tablet heuristic as the OMR camera. Independent of sidebar width. */
export function useIsPhone() {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const sync = () => setPhone(detectPhoneClient());
    sync();
    const coarse = window.matchMedia("(pointer: coarse)");
    const hover = window.matchMedia("(hover: none)");
    coarse.addEventListener("change", sync);
    hover.addEventListener("change", sync);
    return () => {
      coarse.removeEventListener("change", sync);
      hover.removeEventListener("change", sync);
    };
  }, []);
  return phone;
}
