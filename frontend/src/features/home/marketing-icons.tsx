"use client";

import { useId } from "react";

/** Marketing landing icons — soft 3D look. Unique SVG ids per mount. */

export function IconBook({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bk1`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ddd6fe" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id={`${id}-bk2`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <filter id={`${id}-bksh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#4c1d95" floodOpacity=".25" />
        </filter>
      </defs>
      <g filter={`url(#${id}-bksh)`}>
        <path d="M14 16h28a4 4 0 0 1 4 4v36a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V16z" fill={`url(#${id}-bk1)`} />
        <path d="M22 14h30a5 5 0 0 1 5 5v38a5 5 0 0 1-5 5H28a6 6 0 0 1-6-6V14z" fill={`url(#${id}-bk2)`} />
        <path d="M30 24h18M30 32h14M30 40h16" stroke="#ede9fe" strokeWidth="2.5" strokeLinecap="round" opacity=".9" />
      </g>
    </svg>
  );
}

export function IconClipboard({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-cl1`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <filter id={`${id}-clsh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#1e3a8a" floodOpacity=".22" />
        </filter>
      </defs>
      <g filter={`url(#${id}-clsh)`}>
        <rect x="16" y="16" width="40" height="46" rx="8" fill={`url(#${id}-cl1)`} />
        <rect x="26" y="10" width="20" height="12" rx="4" fill="#1d4ed8" />
        <path d="M26 34h20M26 42h14M26 50h16" stroke="#eff6ff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="52" r="9" fill="#22c55e" />
        <path d="M46 52.5l2.6 2.6 5.2-5.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function IconPalette({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-pl1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <filter id={`${id}-plsh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#9a3412" floodOpacity=".22" />
        </filter>
      </defs>
      <g filter={`url(#${id}-plsh)`}>
        <path
          d="M36 10c-15 0-26 11-26 24 0 9 5.5 15 14 15h7c2.5 0 4.5 2 4.5 4.5 0 4.5-4.5 6.5-4.5 6.5S56 56 56 36C56 20 52 10 36 10z"
          fill={`url(#${id}-pl1)`}
        />
        <circle cx="24" cy="28" r="4.5" fill="#ef4444" />
        <circle cx="36" cy="22" r="4.5" fill="#3b82f6" />
        <circle cx="48" cy="28" r="4.5" fill="#22c55e" />
        <circle cx="40" cy="40" r="4.5" fill="#a855f7" />
      </g>
    </svg>
  );
}

export function IconChart({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-ch1`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#86efac" />
        </linearGradient>
        <filter id={`${id}-chsh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#14532d" floodOpacity=".2" />
        </filter>
      </defs>
      <g filter={`url(#${id}-chsh)`}>
        <rect x="12" y="12" width="48" height="48" rx="12" fill="#dcfce7" />
        <rect x="20" y="38" width="9" height="14" rx="2.5" fill={`url(#${id}-ch1)`} />
        <rect x="32" y="28" width="9" height="24" rx="2.5" fill="#22c55e" />
        <rect x="44" y="20" width="9" height="32" rx="2.5" fill="#166534" />
      </g>
    </svg>
  );
}

export function IconShield({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-sh1`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <filter id={`${id}-shsh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#4c1d95" floodOpacity=".25" />
        </filter>
      </defs>
      <g filter={`url(#${id}-shsh)`}>
        <path d="M36 10l22 9v15c0 15-9 24-22 28C23 58 14 49 14 34V19l22-9z" fill={`url(#${id}-sh1)`} />
        <path d="M27 35l6.5 6.5L47 27" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function IconHeadset({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-hd1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <filter id={`${id}-hdsh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#115e59" floodOpacity=".22" />
        </filter>
      </defs>
      <g filter={`url(#${id}-hdsh)`}>
        <path d="M16 38v-4c0-11 9-20 20-20s20 9 20 20v4" fill="none" stroke={`url(#${id}-hd1)`} strokeWidth="7" strokeLinecap="round" />
        <rect x="10" y="36" width="13" height="18" rx="5" fill="#14b8a6" />
        <rect x="49" y="36" width="13" height="18" rx="5" fill="#0d9488" />
        <path d="M36 54h10c3.5 0 6 2.5 6 6v2H36" fill="#134e4a" />
      </g>
    </svg>
  );
}

export function IconCap({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <filter id={`${id}-capsh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#1e3a8a" floodOpacity=".25" />
        </filter>
      </defs>
      <g filter={`url(#${id}-capsh)`}>
        <path d="M8 32l28-14 28 14-28 14L8 32z" fill="#60a5fa" />
        <path d="M18 36v12c7 7 29 7 36 0V36l-18 9-18-9z" fill="#2563eb" />
        <path d="M58 32v16" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="58" cy="50" r="3.5" fill="#f59e0b" />
      </g>
    </svg>
  );
}

export function IconBulb({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <filter id={`${id}-bulbsh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#92400e" floodOpacity=".22" />
        </filter>
      </defs>
      <g filter={`url(#${id}-bulbsh)`}>
        <circle cx="36" cy="30" r="18" fill="#fde68a" />
        <circle cx="36" cy="30" r="12" fill="#fbbf24" />
        <rect x="29" y="46" width="14" height="9" rx="2.5" fill="#94a3b8" />
        <rect x="31" y="55" width="10" height="5" rx="1.5" fill="#64748b" />
      </g>
    </svg>
  );
}

export function IconOpenBook({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 140 100" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-ob1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M70 20C46 8 20 14 10 18v58c14-7 38-9 60 3 22-12 46-10 60-3V18c-10-4-36-10-60 2z" fill={`url(#${id}-ob1)`} opacity=".95" />
      <path d="M70 20v61c-22-12-46-10-60-3V18c10-4 36-10 60 2z" fill="#a78bfa" />
      <path d="M70 20v61c22-12 46-10 60-3V18c-10-4-36-10-60 2z" fill="#8b5cf6" />
    </svg>
  );
}

/** LMS — courses and progress dashboard. */
export function IconLms({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-lms1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <filter id={`${id}-lmssh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#14532d" floodOpacity=".22" />
        </filter>
      </defs>
      <g filter={`url(#${id}-lmssh)`}>
        <rect x="12" y="14" width="48" height="36" rx="8" fill={`url(#${id}-lms1)`} />
        <rect x="18" y="20" width="16" height="12" rx="3" fill="#dcfce7" opacity=".95" />
        <path d="M38 22h14M38 28h10M38 34h12" stroke="#ecfdf5" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="24" y="52" width="24" height="6" rx="2" fill="#166534" />
        <rect x="30" y="48" width="12" height="5" rx="1.5" fill="#22c55e" />
      </g>
    </svg>
  );
}

/** Mobile OMR — phone camera scanning answer sheets. */
export function IconOmr({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-omr1`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <filter id={`${id}-omrsh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#4c1d95" floodOpacity=".25" />
        </filter>
      </defs>
      <g filter={`url(#${id}-omrsh)`}>
        <rect x="20" y="8" width="32" height="56" rx="8" fill={`url(#${id}-omr1)`} />
        <rect x="24" y="16" width="24" height="36" rx="3" fill="#ede9fe" />
        <circle cx="30" cy="24" r="2.2" fill="#7c3aed" />
        <circle cx="36" cy="24" r="2.2" fill="#a78bfa" />
        <circle cx="42" cy="24" r="2.2" fill="#7c3aed" />
        <circle cx="30" cy="32" r="2.2" fill="#a78bfa" />
        <circle cx="36" cy="32" r="2.2" fill="#7c3aed" />
        <circle cx="42" cy="32" r="2.2" fill="#ddd6fe" />
        <circle cx="30" cy="40" r="2.2" fill="#7c3aed" />
        <circle cx="36" cy="40" r="2.2" fill="#ddd6fe" />
        <circle cx="42" cy="40" r="2.2" fill="#7c3aed" />
        <circle cx="36" cy="56" r="2.5" fill="#ede9fe" />
      </g>
    </svg>
  );
}

/** Olympiad / I-CAPE — exam medal. */
export function IconOlympiad({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-oly1`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <filter id={`${id}-olysh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#115e59" floodOpacity=".22" />
        </filter>
      </defs>
      <g filter={`url(#${id}-olysh)`}>
        <path d="M24 12h8l4 14H28l-4-14z" fill="#14b8a6" />
        <path d="M40 12h8l-4 14h-8l4-14z" fill="#0d9488" />
        <circle cx="36" cy="42" r="18" fill={`url(#${id}-oly1)`} />
        <circle cx="36" cy="42" r="12" fill="#99f6e4" opacity=".35" />
        <path
          d="M36 32l2.6 7.2H46l-6 4.6 2.3 7.2L36 46.2l-6.3 4.8 2.3-7.2-6-4.6h7.4L36 32z"
          fill="#fff"
        />
      </g>
    </svg>
  );
}
