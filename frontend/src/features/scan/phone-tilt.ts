"use client";

import { useEffect, useRef, useState } from "react";

/** Camera must meet the sheet at 80° or steeper: at most this far from pointing straight down. */
export const MAX_TILT_DEG = 10;
/** Share of each sensor reading blended into the shown tilt, so hand tremor does not flicker it. */
const SMOOTHING = 0.25;

type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

/** iOS only reports orientation after asking inside a tap; call this from the button that opens the scanner. */
export function requestTiltPermission() {
  const request = (globalThis.DeviceOrientationEvent as OrientationPermission | undefined)?.requestPermission;
  if (typeof request === "function") void request().catch(() => undefined);
}

/** Degrees between the phone's camera axis and straight down, as for a sheet lying on a desk. */
function tiltOf(beta: number, gamma: number) {
  const rad = Math.PI / 180;
  const cos = Math.cos(beta * rad) * Math.cos(gamma * rad);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / rad;
}

/** Live phone tilt in whole degrees, or null when the phone has no orientation sensor (or it is blocked). */
export function usePhoneTilt(active: boolean) {
  const [tilt, setTilt] = useState<number | null>(null);
  const smooth = useRef<number | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return;
      const next = tiltOf(event.beta, event.gamma);
      const prev = smooth.current;
      smooth.current = prev == null ? next : prev + (next - prev) * SMOOTHING;
      const shown = Math.round(smooth.current);
      setTilt((current) => (current === shown ? current : shown));
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      smooth.current = null;
    };
  }, [active]);

  return tilt;
}
