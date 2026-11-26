// Loads display rows (with SAP sales) for the dashboard, applying URL filters and the viewer's scope.
// All rows are loaded once per data version (src/lib/datacache.ts) and filtered in memory, so switching pages
// or filters doesn't go back to the database.
import "server-only";
import { requireViewer, scopeFilter } from "@/auth/viewer";
import { ensureSchema } from "@/db/migrate";
import { cached } from "@/lib/datacache";
import { currentMonth } from "@/analytics/metrics";
import type { ReportFilter } from "@/report/filters";
import { allDisplaysWithSales, matchesFilter, type DisplayWithSales, type SalesOptions } from "@/sales/window";

import { paramList, type SearchParams } from "@/lib/params";

export type { SearchParams };

const KEYS: [keyof ReportFilter, string][] = [
  ["cohortMonths", "month"],
  ["zones", "zone"],
  ["regions", "region"],
  ["rmiNames", "rmi"],
  ["dealerCodes", "dealer"],
  ["dealerCategories", "dtype"],
  ["productTypes", "ptype"],
  ["sizes", "size"],
  ["designNames", "design"],
  ["designStatuses", "dstatus"],
  ["displayedWhere", "where"],
];

export function parseFilter(sp: SearchParams): ReportFilter {
  const f: ReportFilter = {};
  for (const [key, param] of KEYS) {
    const vals = paramList(sp[param]);
    if (vals.length) (f[key] as string[]) = vals;
  }
  return f;
}

/** Sales options from the URL: ?sales=incl also counts ZTDN, ZNTI, ZDMS; ?scope=retail counts retail customers only. */
export function salesOptionsFrom(sp: SearchParams): SalesOptions {
  return { includeExtra: paramList(sp.sales).includes("incl"), retailOnly: paramList(sp.scope).includes("retail") };
}

export async function loadRows(sp: SearchParams): Promise<DisplayWithSales[]> {
  await ensureSchema();
  const viewer = await requireViewer();
  const filter = scopeFilter(viewer, parseFilter(sp));
  const all = await allDisplaysWithSales(salesOptionsFrom(sp));
  return all.filter((r) => matchesFilter(r, filter));
}

export interface FilterOptions {
  months: string[];
  zones: string[];
  regions: string[];
  rmis: string[];
  dealers: { code: string; name: string }[];
  dtypes: string[];
  ptypes: string[];
  sizes: string[];
  designs: string[];
  dstatuses: string[];
  wheres: string[];
}

export async function filterOptions(): Promise<FilterOptions> {
  await ensureSchema();
  const viewer = await requireViewer();
  const scope = scopeFilter(viewer, {});
  const key = `filteroptions|${JSON.stringify(scope)}`;
  return cached(key, async () => {
    const rows = (await allDisplaysWithSales({ includeExtra: false })).filter((r) => matchesFilter(r, scope));
    const uniq = (f: (r: DisplayWithSales) => string | null) =>
      [...new Set(rows.map(f).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
    const dealers = new Map<string, string>();
    for (const r of rows) if (r.dealerCode) dealers.set(r.dealerCode, r.dealerName ?? r.dealerCode);
    const cur = currentMonth();
    return {
      // Future months only come from typos in RMI's display date (e.g. SZ1/KT/4 dated 05 Feb 2029): not offered.
      months: uniq((r) => r.cohortMonth)
        .filter((m) => m <= cur)
        .reverse(),
      zones: uniq((r) => r.zone),
      regions: uniq((r) => r.region),
      rmis: uniq((r) => r.rmiName),
      dealers: [...dealers.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
      dtypes: uniq((r) => r.dealerCategory),
      ptypes: uniq((r) => r.productTypeNorm),
      sizes: uniq((r) => r.sizeMmNorm),
      designs: uniq((r) => r.designName),
      dstatuses: uniq((r) => r.designStatus),
      wheres: uniq((r) => r.displayedWhereNorm),
    };
  });
}
