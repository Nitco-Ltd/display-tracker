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

export function monthName(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}
