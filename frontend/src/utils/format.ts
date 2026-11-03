const ZONE = "Asia/Kolkata";
const numberFormatter = new Intl.NumberFormat("en-IN");

function partsOf(iso: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hourCycle: "h12", ...options }).formatToParts(
    new Date(iso),
  );
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((entry) => entry.type === type)?.value ?? "";
}

function dayPeriod(parts: Intl.DateTimeFormatPart[]) {
  return part(parts, "dayPeriod").replace(/\./g, "").toLowerCase();
}

/** Stable across Node and Chromium ICU so SSR markup matches the client. */
export const formatDate = (iso: string) => {
  const parts = partsOf(iso, { day: "numeric", month: "short", year: "numeric" });
  return `${part(parts, "day")} ${part(parts, "month")} ${part(parts, "year")}`;
};

export const formatTime = (iso: string) => {
  const parts = partsOf(iso, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${part(parts, "hour")}:${part(parts, "minute")} ${dayPeriod(parts)}`;
};

export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;

export const formatNumber = (value: number) => numberFormatter.format(value);

export const classLabel = (level: number) => `Class ${level}`;
