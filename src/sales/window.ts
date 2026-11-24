// Joins display rows to SAP monthly sales over the report window:
// month −1 (before display) … month +12 after the display month = 14 months.
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import { getDb, tables } from "@/db/client";

export const WINDOW_BEFORE = 1;
export const WINDOW_AFTER = 12;
export const WINDOW_MONTHS = WINDOW_BEFORE + 1 + WINDOW_AFTER; // 14

/** "2026-08" + n months -> "yyyy-mm" */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** ["2026-07", "2026-08", … "2027-08"] for cohort 2026-08 */
export function windowMonths(cohort: string): string[] {
  return Array.from({ length: WINDOW_MONTHS }, (_, i) => addMonths(cohort, i - WINDOW_BEFORE));
}

/** "2026-07" -> "Jul-26" (report header style) */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" }) + "-" + String(y).slice(2);
}

export interface MonthSales {
  month: string;
  volume: number;
  value: number;
}

export type DisplayRow = typeof import("@/db/schema.sqlite").rmiDisplay.$inferSelect;

export interface DisplayWithSales extends DisplayRow {
  sales: MonthSales[]; // always WINDOW_MONTHS entries, zeros where no sales
  avgVolume: number; // report rule: sum of 14 months ÷ 14
  avgValue: number;
}

/**
 * Report rule (verified against the Aug-2026 sample): average = sum of all 14 window months ÷ 14,
 * with months that haven't happened yet counted as 0. Do not change without the business owner's OK.
 */
export function reportAverages(sales: { volume: number; value: number }[]): { avgVolume: number; avgValue: number } {
  const sumV = sales.reduce((a, s) => a + s.volume, 0);
  const sumR = sales.reduce((a, s) => a + s.value, 0);
  return { avgVolume: +(sumV / WINDOW_MONTHS).toFixed(3), avgValue: +(sumR / WINDOW_MONTHS).toFixed(3) };
}

export async function displaysWithSales(where?: SQL): Promise<DisplayWithSales[]> {
  const db = getDb();
  const t = tables();
  const rows = await db
    .select()
    .from(t.rmiDisplay)
    .where(where ? and(eq(t.rmiDisplay.inSource, 1), where) : eq(t.rmiDisplay.inSource, 1))
    .orderBy(asc(t.rmiDisplay.displayTrackerId), asc(t.rmiDisplay.refNo)); // RMI's own order (record id)

  // Fetch sales only for the dealers involved.
  const dealers = [...new Set(rows.map((r) => r.dealerCode).filter(Boolean))] as string[];
  const salesMap = new Map<string, { volume: number; value: number }>();
  for (let i = 0; i < dealers.length; i += 500) {
    const chunk = dealers.slice(i, i + 500);
    for (const s of await db.select().from(t.sapSalesMonthly).where(inArray(t.sapSalesMonthly.dealerCode, chunk))) {
      salesMap.set(`${s.dealerCode}|${s.materialCode}|${s.month}`, { volume: s.volume, value: s.value });
    }
  }

  return rows.map((r) => {
    const months = r.cohortMonth ? windowMonths(r.cohortMonth) : [];
    const sales = months.map((m) => {
      const s = r.dealerCode && r.materialCode ? salesMap.get(`${r.dealerCode}|${r.materialCode}|${m}`) : undefined;
      return { month: m, volume: s?.volume ?? 0, value: s?.value ?? 0 };
    });
    return { ...r, sales, ...reportAverages(sales) };
  });
}
