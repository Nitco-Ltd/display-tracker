// Loads display rows (with SAP sales) for the dashboard, applying URL filters and the viewer's scope.
import "server-only";
import { asc, isNotNull } from "drizzle-orm";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { getViewer, scopeFilter } from "@/auth/viewer";
import { filterWhere, type ReportFilter } from "@/report/filters";
import { displaysWithSales } from "@/sales/window";

export type SearchParams = Record<string, string | string[] | undefined>;

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
export const FILTER_PARAM: Record<string, keyof ReportFilter> = Object.fromEntries(KEYS.map(([k, p]) => [p, k]));

export function parseFilter(sp: SearchParams): ReportFilter {
  const f: ReportFilter = {};
  for (const [key, param] of KEYS) {
    const v = sp[param];
    const vals = (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
    if (vals.length) (f[key] as string[]) = vals;
  }
  return f;
}

export async function loadRows(sp: SearchParams) {
  await ensureSchema();
  const viewer = await getViewer();
  const filter = scopeFilter(viewer, parseFilter(sp));
  return displaysWithSales(filterWhere(filter));
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
  const viewer = await getViewer();
  const t = tables().rmiDisplay;
  const rows = await getDb()
    .select({
      month: t.cohortMonth,
      zone: t.zone,
      region: t.region,
      rmi: t.rmiName,
      dealer: t.dealerCode,
      dealerName: t.dealerName,
      dtype: t.dealerCategory,
      ptype: t.productTypeNorm,
      size: t.sizeMmNorm,
      design: t.designName,
      dstatus: t.designStatus,
      where: t.displayedWhereNorm,
    })
    .from(t)
    .where(filterWhere(scopeFilter(viewer, {})) ?? isNotNull(t.refNo))
    .orderBy(asc(t.cohortMonth));
  const uniq = (f: (r: (typeof rows)[number]) => string | null) =>
    [...new Set(rows.map(f).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  const dealers = new Map<string, string>();
  for (const r of rows) if (r.dealer) dealers.set(r.dealer, r.dealerName ?? r.dealer);
  return {
    // Future months only come from typos in RMI's display date (e.g. SZ1/KT/4 dated 05 Feb 2029): not offered.
    months: uniq((r) => r.month)
      .filter((m) => m <= new Date().toISOString().slice(0, 7))
      .reverse(),
    zones: uniq((r) => r.zone),
    regions: uniq((r) => r.region),
    rmis: uniq((r) => r.rmi),
    dealers: [...dealers.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
    dtypes: uniq((r) => r.dtype),
    ptypes: uniq((r) => r.ptype),
    sizes: uniq((r) => r.size),
    designs: uniq((r) => r.design),
    dstatuses: uniq((r) => r.dstatus),
    wheres: uniq((r) => r.where),
  };
}
