import { formatDate, formatTime } from "@/utils/format";

/** Date over time, so the column stays narrow. Renders a dash when there is no date. */
export function DateTime({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-sm text-neutral-300">—</span>;
  return (
    <time dateTime={iso} className="block whitespace-nowrap">
      <span className="block text-sm text-neutral-900">{formatDate(iso)}</span>
      <span className="block text-xs text-neutral-500">{formatTime(iso)}</span>
    </time>
  );
}
