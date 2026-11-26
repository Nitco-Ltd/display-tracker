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

export const isLinked = (r: DisplayWithSales) => !!r.materialCode && r.mapStatus === "mapped";
const pairKey = (r: DisplayWithSales) => `${r.dealerGroup ?? r.dealerCode}|${r.salesFamily ?? r.materialCode}|${r.cohortMonth}`;

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
      const k = `${r.dealerGroup ?? r.dealerCode}|${r.salesFamily ?? r.materialCode}|${s.month}`;
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
export function beforeAfter(rows: DisplayWithSales[], cur = currentMonth(), offsets: number[] = [-1, 0, ...AFTER_OFFSETS]): BeforeAfterPoint[] {
  const pairs = uniquePairs(rows).filter(isLinked);
  return offsets.map((offset) => {
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

/** What happened to the displays (each dealer + tile + month once): checked = tile in SAP and a month old. */
export interface Outcomes {
  displays: number;
  unmatched: number; // tile not found in SAP
  tooNew: number; // put up this month
  checked: number;
  bought: number;
  rate: number; // bought / checked
}

export function outcomes(pairs: DisplayWithSales[], cur = currentMonth()): Outcomes {
  const checked = pairs.filter((r) => isMeasurable(r, cur));
  const bought = checked.filter((r) => isConverted(r, cur)).length;
  const unmatched = pairs.filter((r) => !isLinked(r)).length;
  return {
    displays: pairs.length,
    unmatched,
    tooNew: pairs.length - unmatched - checked.length,
    checked: checked.length,
    bought,
    rate: checked.length ? bought / checked.length : NaN,
  };
}

/** Outcomes by the month the display was put up, oldest first. Near-empty months at the start (a handful of early
 *  test entries, under 3% of the busiest month) are left out so a chart starts where displays did. */
export function outcomesByMonth(pairs: DisplayWithSales[], cur = currentMonth()): { month: string; o: Outcomes }[] {
  const byMonth = new Map<string, DisplayWithSales[]>();
  for (const r of pairs) if (r.cohortMonth && r.cohortMonth <= cur) (byMonth.get(r.cohortMonth) ?? byMonth.set(r.cohortMonth, []).get(r.cohortMonth)!).push(r);
  const sorted = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, rs]) => ({ month, o: outcomes(rs, cur) }));
  const peak = Math.max(0, ...sorted.map((m) => m.o.displays));
  return sorted.slice(Math.max(0, sorted.findIndex((m) => m.o.displays >= peak * 0.03)));
}

/** Month before display vs the average of the three months after (per display). `change` is after ÷ before − 1. */
export function beforeVsAfter(points: BeforeAfterPoint[]): { before: number; after: number; change: number } {
  const before = points.find((p) => p.offset === -1)?.avgValue ?? NaN;
  const after3 = points.filter((p) => p.offset >= 1 && p.offset <= 3 && Number.isFinite(p.avgValue));
  const after = after3.length ? after3.reduce((a, p) => a + p.avgValue, 0) / after3.length : NaN;
  const change = Number.isFinite(before) && before > 0 && Number.isFinite(after) ? after / before - 1 : NaN;
  return { before, after, change };
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

/** Every month from the one before display to 12 after: -1, 0, 1 … 12. */
export const ALL_OFFSETS = Array.from({ length: 14 }, (_, i) => i - 1);

/** Plain label for a month relative to display: "Month before", "Display month", "+1" … */
export function offsetLabel(offset: number, long = false): string {
  if (offset === -1) return long ? "The month before display" : "Before";
  if (offset === 0) return long ? "The display month" : "Display";
  return long ? `${offset} month${offset > 1 ? "s" : ""} after display` : `+${offset}`;
}
