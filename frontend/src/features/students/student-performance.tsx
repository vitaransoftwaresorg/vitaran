"use client";

import { useState, type ReactNode } from "react";
import { Award, BarChart3, ClipboardList, Minus, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { StudentTestResult } from "@/types/student";
import { formatDate } from "@/utils/format";

const SUBJECT_COLORS = ["#2f5bea", "#0f9f6e", "#e8622c", "#d63384", "#7048e8", "#0b93b8", "#c28a0a"];
const TOTAL_COLOR = "#10133f";
const TOTAL_KEY = "Total";

const titleCase = (label: string) =>
  label.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());

const pct = (value: number | null | undefined) =>
  value == null ? "—" : `${Math.round(value * 100) / 100}%`;

const ordinal = (rank: number | null) => {
  if (rank == null) return "—";
  const tail = rank % 100;
  if (tail >= 11 && tail <= 13) return `${rank}th`;
  return `${rank}${["th", "st", "nd", "rd"][rank % 10] ?? "th"}`;
};

const average = (values: Array<number | null>) => {
  const filled = values.filter((value): value is number => value != null);
  return filled.length ? filled.reduce((sum, value) => sum + value, 0) / filled.length : null;
};

function tone(percent: number | null) {
  if (percent == null) return "text-neutral-400";
  if (percent >= 75) return "text-emerald-700";
  if (percent >= 50) return "text-amber-700";
  return "text-red-600";
}

/** A student's saved tests: summary, a test-by-test percentage chart and every test in order. */
export function StudentPerformance({ results }: { results: StudentTestResult[] }) {
  const subjects = [...new Set(results.flatMap((test) => test.subjects.map((subject) => subject.label)))];
  const colorOf = (label: string) => SUBJECT_COLORS[subjects.indexOf(label) % SUBJECT_COLORS.length]!;
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (results.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
        <BarChart3 className="mx-auto size-8 text-brand-300" />
        <p className="mt-3 text-sm font-semibold text-neutral-900">No test results yet</p>
        <p className="mt-1 text-sm text-neutral-500">Performance appears here once results are saved.</p>
      </section>
    );
  }

  const repeated = new Set(
    results.map((test) => test.testNumber).filter((n, i, all) => all.indexOf(n) !== i),
  );
  const tickOf = (test: StudentTestResult) =>
    repeated.has(test.testNumber) ? `T${test.testNumber} · ${test.programName}` : `Test ${test.testNumber}`;
  const chart = results.map((test) => ({
    name: tickOf(test),
    [TOTAL_KEY]: test.percentage,
    ...Object.fromEntries(test.subjects.map((subject) => [subject.label, subject.percentage])),
  }));

  const latest = results.at(-1)!;
  const previous = results.at(-2);
  const delta =
    previous?.percentage != null && latest.percentage != null ? latest.percentage - previous.percentage : null;
  const percents = results.map((test) => test.percentage);
  const best = Math.max(...percents.filter((value): value is number => value != null), -Infinity);
  const bestRank = Math.min(...results.map((test) => test.classRank ?? Infinity));

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<ClipboardList />} label="Tests taken" value={String(results.length)} />
        <Stat icon={<BarChart3 />} label="Average" value={pct(average(percents))} />
        <Stat icon={<Award />} label="Best score" value={best === -Infinity ? "—" : pct(best)} />
        <Stat
          icon={<Trophy />}
          label="Latest"
          value={pct(latest.percentage)}
          hint={
            delta == null ? (
              bestRank !== Infinity ? `Best class rank ${ordinal(bestRank)}` : undefined
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-semibold",
                  delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-600" : "text-neutral-500",
                )}
              >
                {delta > 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : delta < 0 ? (
                  <TrendingDown className="size-3.5" />
                ) : (
                  <Minus className="size-3.5" />
                )}
                {delta > 0 ? "+" : ""}
                {Math.round(delta * 100) / 100}% vs previous
              </span>
            )
          }
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/60 px-4 py-2.5">
          <div>
            <h2 className="text-sm font-semibold text-brand-950">Performance trend</h2>
            <p className="text-xs text-neutral-500">Percentage in each test · tap a subject to hide it</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...subjects, TOTAL_KEY].map((key) => {
              const color = key === TOTAL_KEY ? TOTAL_COLOR : colorOf(key);
              const off = hidden.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={!off}
                  onClick={() => toggle(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-opacity",
                    off ? "border-neutral-200 bg-white text-neutral-400 opacity-60" : "border-transparent text-white",
                  )}
                  style={off ? undefined : { backgroundColor: color }}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: off ? color : "rgb(255 255 255 / 0.9)" }}
                  />
                  {key === TOTAL_KEY ? "Total" : titleCase(key)}
                </button>
              );
            })}
          </div>
        </header>
        <div className="h-72 px-2 pt-4 pb-2 sm:h-80 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebebf3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#525584", fontSize: 11 }}
                axisLine={{ stroke: "#d6d7e5" }}
                tickLine={false}
                padding={{ left: 24, right: 24 }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(value: number) => `${value}%`}
                tick={{ fill: "#525584", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [pct(typeof value === "number" ? value : null), name === TOTAL_KEY ? "Total" : titleCase(String(name))]}
                contentStyle={{ borderRadius: 10, borderColor: "#d6d7e5", fontSize: 12 }}
                labelStyle={{ fontWeight: 700, color: "#0a0c2e" }}
              />
              {subjects.map((label) =>
                hidden.has(label) ? null : (
                  <Line
                    key={label}
                    type="monotone"
                    dataKey={label}
                    stroke={colorOf(label)}
                    strokeWidth={2}
                    dot={{ r: 3.5, strokeWidth: 2, fill: "#fff" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ),
              )}
              {hidden.has(TOTAL_KEY) ? null : (
                <Line
                  type="monotone"
                  dataKey={TOTAL_KEY}
                  stroke={TOTAL_COLOR}
                  strokeWidth={3.5}
                  dot={{ r: 5, strokeWidth: 2.5, fill: "#fff" }}
                  activeDot={{ r: 6.5 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-brand-100 px-4 py-3 sm:grid-cols-4 lg:grid-cols-6">
          {subjects.map((label) => {
            const avg = average(results.map((test) => test.subjects.find((s) => s.label === label)?.percentage ?? null));
            return (
              <div key={label} className="min-w-0 rounded-lg border border-neutral-100 bg-neutral-50/70 px-3 py-2">
                <p className="flex items-center gap-1.5 truncate text-[11px] font-semibold text-neutral-600">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(label) }} />
                  {titleCase(label)}
                </p>
                <p className={cn("mt-0.5 text-sm font-bold tabular-nums", tone(avg))}>{pct(avg)}</p>
                <p className="text-[10px] text-neutral-400">average</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
        <header className="border-b border-brand-100 bg-brand-50/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-brand-950">All tests</h2>
          <p className="text-xs text-neutral-500">In test order</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-brand-100 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Test</th>
                {subjects.map((label) => (
                  <th key={label} className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: colorOf(label) }} />
                      {titleCase(label)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-right">%</th>
                <th className="px-3 py-2.5 text-right">Class rank</th>
                <th className="px-4 py-2.5 text-right">Section rank</th>
              </tr>
            </thead>
            <tbody>
              {[...results].reverse().map((test) => (
                <tr
                  key={`${test.resultSetId}-${test.classLevel}`}
                  className="border-b border-neutral-100 last:border-0 hover:bg-brand-50/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-900 text-white">
                        <span className="text-[8px] font-semibold tracking-wider text-white/60 uppercase">Test</span>
                        <span className="text-sm leading-none font-bold tabular-nums">{test.testNumber}</span>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-950">
                          {test.testId ? `Test ID ${test.testId}` : `Test ${test.testNumber}`}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {test.programName} · Class {test.classLevel} · {formatDate(test.date)}
                          {test.published ? null : (
                            <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-800">
                              Not published
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  {subjects.map((label) => {
                    const subject = test.subjects.find((row) => row.label === label);
                    return (
                      <td key={label} className="px-3 py-3 text-right tabular-nums">
                        {subject?.marks == null ? (
                          <span className="text-neutral-300">—</span>
                        ) : (
                          <>
                            <span className="font-semibold text-neutral-950">{subject.marks}</span>
                            {subject.max ? <span className="text-neutral-400">/{subject.max}</span> : null}
                            <span className={cn("block text-[11px] font-semibold", tone(subject.percentage))}>
                              {pct(subject.percentage)}
                            </span>
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="font-bold text-neutral-950">{test.total ?? "—"}</span>
                    {test.totalMax ? <span className="text-neutral-400">/{test.totalMax}</span> : null}
                  </td>
                  <td className={cn("px-3 py-3 text-right font-bold tabular-nums", tone(test.percentage))}>
                    {pct(test.percentage)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <RankBadge rank={test.classRank} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RankBadge rank={test.sectionRank} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="text-neutral-300">—</span>;
  const podium = rank <= 3;
  return (
    <span
      className={cn(
        "inline-flex min-w-10 justify-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums",
        rank === 1
          ? "bg-amber-100 text-amber-900"
          : podium
            ? "bg-brand-100 text-brand-900"
            : "bg-neutral-100 text-neutral-700",
      )}
    >
      {ordinal(rank)}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-800 [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">{label}</p>
        <p className="text-xl font-bold text-neutral-950 tabular-nums">{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p> : null}
      </div>
    </div>
  );
}
