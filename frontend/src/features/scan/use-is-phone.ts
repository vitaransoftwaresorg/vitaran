"use client";

import { useEffect, useState } from "react";

/** Same phone/tablet heuristic as the OMR camera (coarse pointer or mobile UA). */
export function useIsPhone() {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const sync = () => {
      setPhone(
        window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
          /iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent),
      );
    };
    sync();
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone;
}
