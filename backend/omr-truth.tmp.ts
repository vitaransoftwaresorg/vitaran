import { readFile } from "node:fs/promises";
import { prepareSheet } from "/Users/naveenallu/Projects/vitaran/backend/src/scan/preprocess.ts";
import { readAnswerBubbles } from "/Users/naveenallu/Projects/vitaran/backend/src/scan/detect.ts";
import { locateAnswerGrid } from "/Users/naveenallu/Projects/vitaran/backend/src/utils/omr-grid.ts";

type Row = { file: string; grid: boolean; snapped?: number; patch?: number; answers: Record<string, string[]> };
const rows: Row[] = [];
for (const f of process.argv.slice(2)) {
  try {
    const p = await prepareSheet(await readFile(f));
    const g = locateAnswerGrid(p.rgba);
    const b = readAnswerBubbles(p.rgba);
    rows.push({ file: f.split("/").pop()!, grid: b.gridFound, snapped: g?.snapped, patch: g?.spacingError?.toFixed(2), answers: b.answers });
  } catch {}
}
const votes = new Map<number, Map<string, number>>();
for (const r of rows.filter((r) => r.grid)) {
  for (let q = 1; q <= 100; q++) {
    const k = (r.answers[q] ?? []).join("") || "-";
    const m = votes.get(q) ?? new Map();
    m.set(k, (m.get(k) ?? 0) + 1);
    votes.set(q, m);
  }
}
const truth = new Map<number, string>();
for (const [q, m] of votes) truth.set(q, [...m.entries()].sort((a, b) => b[1] - a[1])[0]![0]);
for (const r of rows) {
  let diff = 0;
  for (let q = 1; q <= 100; q++) if (((r.answers[q] ?? []).join("") || "-") !== truth.get(q)) diff++;
  console.log(diff, r.grid, r.snapped, r.patch, r.file);
}
process.exit(0);
