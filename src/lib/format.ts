// Indian number formatting (lakh / crore, ₹).
const intl0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const intl1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const intl2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** 1234567 -> "12,34,567" */
export const num = (n: number) => intl0.format(n);

/** 1234567.8 -> "₹12,34,568" */
export const inr = (n: number) => (n < 0 ? "−₹" : "₹") + intl0.format(Math.abs(n));

/** Compact rupees: ₹1.23 Cr, ₹4.56 L, ₹12,345 */
export function inrCompact(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e7) return `${sign}₹${intl2.format(a / 1e7)} Cr`;
  if (a >= 1e5) return `${sign}₹${intl2.format(a / 1e5)} L`;
  return `${sign}₹${intl0.format(a)}`;
}

/** Square metres, e.g. "1,234 m²" */
export const m2 = (n: number) => `${intl0.format(n)} m²`;

/** 0.1234 -> "12.3%" */
export const pct = (n: number) => (Number.isFinite(n) ? `${intl1.format(n * 100)}%` : "–");

// Month labels. A fixed list on purpose: locale month names vary ("Sept" in en-GB), the report needs "Sep".
export const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymParts = (ym: string) => ym.split("-").map(Number) as [number, number];

/** "2026-07" -> "Jul 2026" (pages, filters) */
export function monthName(ym: string): string {
  const [y, m] = ymParts(ym);
  return `${MONTH_ABBR[m - 1]} ${y}`;
}

/** "2026-07" -> "Jul-26" (report column headers) */
export function monthLabel(ym: string): string {
  const [y, m] = ymParts(ym);
  return `${MONTH_ABBR[m - 1]}-${String(y).slice(2)}`;
}

/** "2026-07" -> "Jul-2026" (RMI's own month picker and report file names) */
export function monthYear(ym: string): string {
  const [y, m] = ymParts(ym);
  return `${MONTH_ABBR[m - 1]}-${y}`;
}

/** Number formats a chart can be told to use by name (server pages can't pass functions to client components). */
export const CHART_FORMATS = { inr: inrCompact, num, m2, pct } as const;
export type ChartFormat = keyof typeof CHART_FORMATS;
