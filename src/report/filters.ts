// Filters shared by the Excel download and the dashboard (same fields as RMI's own report page).
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { tables } from "@/db/client";

export interface ReportFilter {
  cohortMonths?: string[]; // yyyy-mm (Display Month & Year)
  zones?: string[];
  regions?: string[];
  rmiNames?: string[];
  dealerCodes?: string[];
  dealerCategories?: string[]; // Dealer / Franchise
  productTypes?: string[]; // normalized product type
  sizes?: string[]; // normalized tile size, e.g. 600x1200
  designNames?: string[];
  designStatuses?: string[]; // New / Existing
  displayedWhere?: string[]; // normalized
}

export function filterWhere(f: ReportFilter): SQL | undefined {
  const t = tables().rmiDisplay;
  const parts: (SQL | undefined)[] = [];
  const add = <T>(vals: T[] | undefined, col: Parameters<typeof eq>[0]) => {
    if (vals?.length) parts.push(vals.length === 1 ? eq(col, vals[0]) : inArray(col, vals as unknown[]));
  };
  add(f.cohortMonths, t.cohortMonth);
  add(f.zones, t.zone);
  add(f.regions, t.region);
  add(f.rmiNames, t.rmiName);
  add(f.dealerCodes, t.dealerCode);
  add(f.dealerCategories, t.dealerCategory);
  add(f.productTypes, t.productTypeNorm);
  add(f.sizes, t.sizeMmNorm);
  add(f.designNames, t.designName);
  add(f.designStatuses, t.designStatus);
  add(f.displayedWhere, t.displayedWhereNorm);
  const p = parts.filter(Boolean) as SQL[];
  return p.length ? and(...p) : undefined;
}
