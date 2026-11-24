// Dashboard metrics. Every definition the dashboard shows lives here.
//
// Terms
//   display        one RMI row (dealer × design × display date).
//   display month  M = the calendar month of the display date. "Before" = M−1. "After" = M+1 … M+12.
//                  The display month itself is shown separately (display may be mid-month).
//   linked         the row's design is linked to a SAP material (design_material_map auto/approved/manual).
//   measurable     linked AND at least one after-month (M+1) has started. Only measurable displays enter
//                  conversion rates and averages, so new or unlinked displays don't drag them down.
//   converted      measurable display with any positive sales value in M+1 … M+12 (months so far).
//
// Duplicate rule (no double counting in totals)
//   1. The same dealer + design displayed more than once in the same month (e.g. on two panels) is one
//      "display pair": averages and conversion count it once.
//   2. Each SAP month of sales for a dealer + design is counted at most once in any total, even when it
//      falls inside the windows of several displays (e.g. displayed again two months later).
//   Display COUNTS still count every row, because each row is a physical display.
import { addMonths } from "@/sales/window";
import type { DisplayWithSales } from "@/sales/window";

export const AFTER_OFFSETS = [1, 3, 6, 12] as const;

export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** Sales for one offset from the display month (−1 … 12); null if that month hasn't started yet. */
function at(r: DisplayWithSales, offset: number, cur: string) {
  if (!r.cohortMonth) return null;
  const m = addMonths(r.cohortMonth, offset);
  if (m > cur) return null;
  return r.sales.find((s) => s.month === m) ?? { month: m, volume: 0, value: 0 };
}

const isLinked = (r: DisplayWithSales) => !!r.materialCode && r.mapStatus === "mapped";
const pairKey = (r: DisplayWithSales) => `${r.dealerCode}|${r.materialCode}|${r.cohortMonth}`;

export function isMeasurable(r: DisplayWithSales, cur: string): boolean {
  return isLinked(r) && !!r.cohortMonth && addMonths(r.cohortMonth, 1) <= cur;
}

/** After-display months that have started, M+1 … M+12 (or up to `upTo`). */
export function afterMonths(r: DisplayWithSales, cur: string, upTo = 12) {
  const out: { month: string; volume: number; value: number }[] = [];
  for (let k = 1; k <= upTo; k++) {
    const s = at(r, k, cur);
    if (s) out.push(s);
  }
  return out;
}

export function isConverted(r: DisplayWithSales, cur: string, upTo = 12): boolean {
  return afterMonths(r, cur, upTo).some((s) => s.value > 0);
}

/** One representative row per display pair (rule 1). Keeps RMI's first record. */
export function uniquePairs(rows: DisplayWithSales[]): DisplayWithSales[] {
  const seen = new Map<string, DisplayWithSales>();
  for (const r of rows) {
    const k = isLinked(r) ? pairKey(r) : `row|${r.refNo}`;
    if (!seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

/** Total after-display sales with each dealer × material × month counted once (rule 2). */
export function afterSalesTotal(rows: DisplayWithSales[], cur: string): { value: number; volume: number } {
  const seen = new Set<string>();
  let value = 0;
  let volume = 0;
  for (const r of rows) {
    if (!isLinked(r)) continue;
    for (const s of afterMonths(r, cur)) {
      const k = `${r.dealerCode}|${r.materialCode}|${s.month}`;
      if (seen.has(k)) continue;
      seen.add(k);
      value += s.value;
      volume += s.volume;
    }
  }
  return { value, volume };
}

export interface Kpis {
  displays: number;
  dealers: number;
  linked: number;
  measurablePairs: number;
  convertedPairs: number;
  conversion: number;
  afterValue: number;
  afterVolume: number;
  avgValuePerPair: number;
  avgVolumePerPair: number;
  avgMonthlyValuePerPair: number; // average over elapsed after-months (dashboard-only figure)
  duplicateRows: number;
  unlinked: number;
}

export function kpis(rows: DisplayWithSales[], cur = currentMonth()): Kpis {
  const pairs = uniquePairs(rows);
  const measurable = pairs.filter((r) => isMeasurable(r, cur));
  const converted = measurable.filter((r) => isConverted(r, cur));
  const total = afterSalesTotal(rows, cur);
  const elapsedMonths = measurable.reduce((a, r) => a + afterMonths(r, cur).length, 0);
  const linked = rows.filter(isLinked).length;
  return {
    displays: rows.length,
    dealers: new Set(rows.map((r) => r.dealerCode).filter(Boolean)).size,
    linked,
    measurablePairs: measurable.length,
    convertedPairs: converted.length,
    conversion: measurable.length ? converted.length / measurable.length : NaN,
    afterValue: total.value,
    afterVolume: total.volume,
    avgValuePerPair: measurable.length ? total.value / measurable.length : NaN,
    avgVolumePerPair: measurable.length ? total.volume / measurable.length : NaN,
    avgMonthlyValuePerPair: elapsedMonths ? total.value / elapsedMonths : NaN,
    duplicateRows: rows.filter(isLinked).length - pairs.filter(isLinked).length,
    unlinked: rows.length - linked,
  };
}

export interface BeforeAfterPoint {
  label: string; // "M−1", "M", "M+1" …
  offset: number;
  pairs: number; // display pairs for which this month has started
  avgValue: number;
  avgVolume: number;
  withSales: number; // share of those pairs with sales that month
}

/** Average sales per display pair in the month before vs. selected months after (same dealer + design). */
export function beforeAfter(rows: DisplayWithSales[], cur = currentMonth()): BeforeAfterPoint[] {
  const pairs = uniquePairs(rows).filter(isLinked);
  return [-1, 0, ...AFTER_OFFSETS].map((offset) => {
    const vals = pairs.map((r) => at(r, offset, cur)).filter((s): s is NonNullable<typeof s> => !!s);
    const n = vals.length;
    return {
      label: offset === 0 ? "M" : offset < 0 ? `M${offset}`.replace("-", "−") : `M+${offset}`,
      offset,
      pairs: n,
      avgValue: n ? vals.reduce((a, s) => a + s.value, 0) / n : NaN,
      avgVolume: n ? vals.reduce((a, s) => a + s.volume, 0) / n : NaN,
      withSales: n ? vals.filter((s) => s.value > 0).length / n : NaN,
    };
  });
}

export interface GroupStat {
  key: string;
  label: string;
  displays: number;
  dealers: number;
  measurablePairs: number;
  convertedPairs: number;
  conversion: number;
  afterValue: number;
  afterVolume: number;
}

export function groupStats(
  rows: DisplayWithSales[],
  keyOf: (r: DisplayWithSales) => string | null,
  labelOf: (r: DisplayWithSales) => string | null = keyOf,
  cur = currentMonth(),
): GroupStat[] {
  const groups = new Map<string, DisplayWithSales[]>();
  const labels = new Map<string, string>();
  for (const r of rows) {
    const k = keyOf(r) ?? "(blank)";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
    if (!labels.has(k)) labels.set(k, labelOf(r) ?? "(blank)");
  }
  return [...groups.entries()].map(([key, g]) => {
    const k = kpis(g, cur);
    return {
      key,
      label: labels.get(key)!,
      displays: k.displays,
      dealers: k.dealers,
      measurablePairs: k.measurablePairs,
      convertedPairs: k.convertedPairs,
      conversion: k.conversion,
      afterValue: k.afterValue,
      afterVolume: k.afterVolume,
    };
  });
}

export interface TrendPoint {
  month: string;
  displays: number;
  measurablePairs: number;
  conversion: number;
  afterValue: number;
}

export function monthlyTrend(rows: DisplayWithSales[], cur = currentMonth()): TrendPoint[] {
  return groupStats(rows, (r) => r.cohortMonth, undefined, cur)
    .filter((g) => g.key !== "(blank)" && g.key <= cur)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((g) => ({ month: g.key, displays: g.displays, measurablePairs: g.measurablePairs, conversion: g.conversion, afterValue: g.afterValue }));
}

/** Linked displays with no sales in M+1 … M+N, where M+N has already started. */
export function zeroSales(rows: DisplayWithSales[], n: number, cur = currentMonth()): DisplayWithSales[] {
  return rows.filter((r) => isLinked(r) && r.cohortMonth && addMonths(r.cohortMonth, n) <= cur && !isConverted(r, cur, n));
}

/** Per-row summary used by the drill-down table. */
export function rowSummary(r: DisplayWithSales, cur = currentMonth()) {
  const before = at(r, -1, cur);
  const after = afterMonths(r, cur);
  return {
    beforeValue: before?.value ?? 0,
    displayMonthValue: at(r, 0, cur)?.value ?? 0,
    afterValue: after.reduce((a, s) => a + s.value, 0),
    afterVolume: after.reduce((a, s) => a + s.volume, 0),
    afterMonths: after.length,
  };
}
