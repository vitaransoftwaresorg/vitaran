import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/features/admin/dashboard-parts";
import { cn } from "@/lib/utils";

export function StudentEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-6 py-14 text-center">
      <p className="text-base font-semibold text-neutral-950">{title}</p>
      <p className="max-w-sm text-sm text-brand-700">{hint}</p>
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "bad" | "warn" | "brand";
}) {
  const color =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-rose-700"
        : tone === "warn"
          ? "text-amber-700"
          : tone === "brand"
            ? "text-brand-900"
            : "text-neutral-950";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums sm:text-3xl", color)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

const TONE: Record<NonNullable<KpiTileTone>, string> = {
  default: "text-neutral-950",
  good: "text-emerald-700",
  bad: "text-rose-700",
  warn: "text-amber-700",
  brand: "text-brand-900",
};

type KpiTileTone = "default" | "good" | "bad" | "warn" | "brand";

export function StatStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number; tone?: KpiTileTone }>;
}) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-brand-100 bg-brand-100 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-white px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">{item.label}</p>
          <p className={cn("mt-0.5 text-xl font-bold tabular-nums", TONE[item.tone ?? "default"])}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

type Slice = { name: string; value: number; fill: string };

function ChartTooltip({
  active,
  payload,
  unit = "",
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { name?: string } }>;
  unit?: string;
}) {
  const item = payload?.[0];
  if (!active || item?.value == null) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-semibold text-neutral-900">{item.payload?.name ?? item.name}</p>
      <p className="tabular-nums text-neutral-600">
        {item.value}
        {unit}
      </p>
    </div>
  );
}

export function SubjectBarChart({
  data,
  kind = "percent",
}: {
  data: Slice[];
  kind?: "percent" | "count";
}) {
  const percent = kind === "percent";
  return (
    <div className="h-52 w-full sm:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ebebf3" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#525584", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis
            domain={percent ? [0, 100] : [0, "auto"]}
            tick={{ fill: "#525584", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={percent ? 44 : 36}
            tickFormatter={(value: number) => (percent ? `${value}%` : String(value))}
            allowDecimals={false}
          />
          <Tooltip cursor={{ fill: "#f6f6fa" }} content={<ChartTooltip unit={percent ? "%" : ""} />} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={42}>
            {data.map((row) => (
              <Cell key={row.name} fill={row.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SubjectPieChart({ data, unit = "" }: { data: Slice[]; unit?: string }) {
  const slices = data.filter((row) => row.value > 0);
  if (slices.length === 0) {
    return <p className="flex h-52 items-center justify-center text-sm text-neutral-500 sm:h-60">Nothing to chart yet.</p>;
  }
  return (
    <div className="h-52 w-full sm:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="46%"
            innerRadius={48}
            outerRadius={76}
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
          >
            {slices.map((row) => (
              <Cell key={row.name} fill={row.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Legend
            verticalAlign="bottom"
            height={28}
            formatter={(value) => <span className="text-xs text-neutral-700">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bar and pie side by side on desktop, stacked on a phone. */
export function ChartPair({
  barTitle,
  pieTitle,
  bar,
  pie,
  barKind,
  pieUnit,
}: {
  barTitle: string;
  pieTitle: string;
  bar: Slice[];
  pie: Slice[];
  barKind?: "percent" | "count";
  pieUnit?: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={barTitle} description="Bar chart" compact>
        <SubjectBarChart data={bar} kind={barKind ?? "percent"} />
      </Panel>
      <Panel title={pieTitle} description="Pie chart" compact>
        <SubjectPieChart data={pie} unit={pieUnit ?? ""} />
      </Panel>
    </div>
  );
}

type CompareRow = { name: string; latest: number; previous: number | null };

export function CompareBarChart({ data }: { data: CompareRow[] }) {
  const hasPrevious = data.some((row) => row.previous != null);
  return (
    <div className="h-52 w-full sm:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ebebf3" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#525584", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#525584", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(value: number) => `${value}%`}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "#f6f6fa" }}
            content={<ChartTooltip unit="%" />}
          />
          {hasPrevious && <Bar dataKey="previous" name="Previous" fill="#c4c6de" radius={[8, 8, 0, 0]} maxBarSize={28} />}
          <Bar dataKey="latest" name="Latest" fill="#191c5f" radius={[8, 8, 0, 0]} maxBarSize={28} />
          {hasPrevious && (
            <Legend
              verticalAlign="bottom"
              height={28}
              formatter={(value) => <span className="text-xs text-neutral-700">{value}</span>}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
