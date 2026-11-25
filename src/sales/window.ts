// Joins display rows to SAP monthly sales over the report window:
// month −1 (before display) … month +12 after the display month = 14 months.
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import { getDb, tables } from "@/db/client";
import { cached } from "@/lib/datacache";
import type { ReportFilter } from "@/report/filters";
import { linkedAccounts } from "./dealers";
import { packagingFamilyKey } from "./packaging";

export const WINDOW_BEFORE = 1;
export const WINDOW_AFTER = 12;
export const WINDOW_MONTHS = WINDOW_BEFORE + 1 + WINDOW_AFTER; // 14

/** "2026-08" + n months -> "yyyy-mm" */
export function addMonths(ym: string, n: number): string {
  // Plain arithmetic (no Date objects): this runs millions of times when the dashboard computes rankings.
  const total = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return `${y}-${m < 10 ? "0" : ""}${m}`;
}

/** ["2026-07", "2026-08", … "2027-08"] for cohort 2026-08 */
export function windowMonths(cohort: string): string[] {
  return Array.from({ length: WINDOW_MONTHS }, (_, i) => addMonths(cohort, i - WINDOW_BEFORE));
}

// Fixed list on purpose: locale month names vary ("Sept" in en-GB), the report needs "Sep".
export const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-07" -> "Jul-26" (report header style) */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_ABBR[m - 1]}-${String(y).slice(2)}`;
}

export interface MonthSales {
  month: string;
  volume: number;
  value: number;
}

export type DisplayRow = typeof import("@/db/schema.sqlite").rmiDisplay.$inferSelect;

export interface DisplayWithSales extends DisplayRow {
  salesFamily: string | null; // packaging-variant family of materialCode (see packagingFamilyKey); dedupe key for metrics
  salesCodes: string[]; // every SAP code whose sales count for this display (materialCode + its packaging variants)
  dealerGroup: string | null; // the dealer's linked accounts joined by "+" (or dealerCode); dedupe key for metrics
  salesAccounts: string[]; // every SAP customer account whose sales count (dealerCode + linked accounts, see dealers.ts)
  otherAccountValue: number; // part of the 14-month sales billed to a linked account rather than dealerCode
  otherAccountVolume: number;
  extraValue: number; // 14-month value from the undecided types (ZTDN, ZNTI, ZDMS), whether or not included in `sales`
  includesExtra: boolean; // true when `sales` includes them (the "incl." version)
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

export { packagingFamilyKey };

/** material code -> all codes in its packaging family (only codes with a family of 2+ are listed). */
export async function packagingFamilies(): Promise<{ familyOf: Map<string, string>; codesOf: Map<string, string[]> }> {
  const t = tables();
  const mats = await getDb().select({ code: t.sapMaterial.material, description: t.sapMaterial.description }).from(t.sapMaterial);
  const codesOf = new Map<string, string[]>();
  const familyOf = new Map<string, string>();
  for (const m of mats) {
    const k = packagingFamilyKey(m.code, m.description);
    if (k === m.code) continue;
    familyOf.set(m.code, k);
    (codesOf.get(k) ?? codesOf.set(k, []).get(k)!).push(m.code);
  }
  for (const codes of codesOf.values()) codes.sort();
  return { familyOf, codesOf };
}

export interface SalesOptions {
  /** Also count the undecided invoice types ZTDN, ZNTI, ZDMS (SAP_EXTRA_*). Default: no. */
  includeExtra?: boolean;
}

/** Every display with its sales, loaded once per data version (see src/lib/datacache.ts). Don't mutate the rows. */
export function allDisplaysWithSales(opts: SalesOptions = {}): Promise<DisplayWithSales[]> {
  return cached(`displays|${opts.includeExtra ? "incl" : "std"}`, () => displaysWithSales(undefined, opts));
}

/** In-memory version of filterWhere (src/report/filters.ts): same fields, same meaning. */
export function matchesFilter(r: DisplayRow, f: ReportFilter): boolean {
  const ok = (vals: string[] | undefined, v: string | null) => !vals?.length || (v !== null && vals.includes(v));
  return (
    ok(f.cohortMonths, r.cohortMonth) &&
    ok(f.zones, r.zone) &&
    ok(f.regions, r.region) &&
    ok(f.rmiNames, r.rmiName) &&
    ok(f.dealerCodes, r.dealerCode) &&
    ok(f.dealerCategories, r.dealerCategory) &&
    ok(f.productTypes, r.productTypeNorm) &&
    ok(f.sizes, r.sizeMmNorm) &&
    ok(f.designNames, r.designName) &&
    ok(f.designStatuses, r.designStatus) &&
    ok(f.displayedWhere, r.displayedWhereNorm)
  );
}

export async function displaysWithSales(where?: SQL, opts: SalesOptions = {}): Promise<DisplayWithSales[]> {
  const includeExtra = !!opts.includeExtra;
  const db = getDb();
  const t = tables();
  const rows = await db
    .select()
    .from(t.rmiDisplay)
    .where(where ? and(eq(t.rmiDisplay.inSource, 1), where) : eq(t.rmiDisplay.inSource, 1))
    .orderBy(asc(t.rmiDisplay.displayTrackerId), asc(t.rmiDisplay.refNo)); // RMI's own order (record id)

  // Fetch sales only for the dealers involved (and their linked accounts).
  const links = await linkedAccounts();
  const accountsOf = (d: string | null) => (d ? (links.get(d) ?? [d]) : []);
  const dealers = [...new Set(rows.flatMap((r) => accountsOf(r.dealerCode)))];
  const salesMap = new Map<string, { volume: number; value: number; extraVolume: number; extraValue: number }>();
  for (let i = 0; i < dealers.length; i += 500) {
    const chunk = dealers.slice(i, i + 500);
    for (const s of await db.select().from(t.sapSalesMonthly).where(inArray(t.sapSalesMonthly.dealerCode, chunk))) {
      salesMap.set(`${s.dealerCode}|${s.materialCode}|${s.month}`, { volume: s.volume, value: s.value, extraVolume: s.extraVolume, extraValue: s.extraValue });
    }
  }

  const { familyOf, codesOf } = await packagingFamilies();

  return rows.map((r) => {
    const fam = r.materialCode ? familyOf.get(r.materialCode) : undefined;
    const salesCodes = r.materialCode ? (fam ? codesOf.get(fam)! : [r.materialCode]) : [];
    const salesAccounts = accountsOf(r.dealerCode);
    const months = r.cohortMonth ? windowMonths(r.cohortMonth) : [];
    let otherAccountValue = 0;
    let otherAccountVolume = 0;
    let extraValue = 0;
    const sales = months.map((m) => {
      let volume = 0;
      let value = 0;
      for (const a of salesAccounts) {
        for (const c of salesCodes) {
          const s = salesMap.get(`${a}|${c}|${m}`);
          if (!s) continue;
          const v = s.volume + (includeExtra ? s.extraVolume : 0);
          const val = s.value + (includeExtra ? s.extraValue : 0);
          volume += v;
          value += val;
          extraValue += s.extraValue;
          if (a !== r.dealerCode) {
            otherAccountValue += val;
            otherAccountVolume += v;
          }
        }
      }
      return { month: m, volume, value };
    });
    return {
      ...r,
      salesFamily: fam ?? r.materialCode,
      salesCodes,
      dealerGroup: salesAccounts.length ? salesAccounts.join("+") : r.dealerCode,
      salesAccounts,
      otherAccountValue,
      otherAccountVolume,
      extraValue,
      includesExtra: includeExtra,
      sales,
      ...reportAverages(sales),
    };
  });
}
