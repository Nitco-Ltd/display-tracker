// "Monthly sales" view: for one SALES month and an area, how total tile sales narrow down to the displayed designs.
//
//   1. total            all tile sales (division 02) to customers in the area          (= NITCO Sales data MIS)
//   2. displayDealers   …of which to dealers that have an RMI display (put up in or before this month)
//   3. displayedDesigns …of which the designs that dealer has on display (put up in or before this month)
//   4. monthDealers     everything bought by the dealers who got a display IN this month
//   5. monthDesigns     …of which the designs displayed in this month (= that month's Display Tracker Report, display-month column)
//
// Area = the customer's SAP sales district (zone) and sales office (region), named the way RMI names them
// (EZ1 → "East Zone 1", BH1/BH2/BHC → "Bihar"; learnt from the RMI dealers in each office).
// A dealer's linked accounts (same GST + PIN, see dealers.ts) and a design's packaging variants count as one.
import { desc, eq, lte } from "drizzle-orm";
import { getDb, tables } from "@/db/client";
import { cached } from "@/lib/datacache";
import { allDisplaysWithSales, type DisplayWithSales } from "./window";

/** Months that have SAP sales, newest first, up to `upTo` (the Monthly sales month picker). */
export function salesMonths(upTo: string): Promise<string[]> {
  return cached(`salesMonths|${upTo}`, async () => {
    const t = tables();
    const rows = await getDb()
      .selectDistinct({ m: t.sapCustomerMonthly.month })
      .from(t.sapCustomerMonthly)
      .where(lte(t.sapCustomerMonthly.month, upTo))
      .orderBy(desc(t.sapCustomerMonthly.month));
    return rows.map((r) => r.m);
  });
}

export interface Geo {
  zone: string;
  region: string;
}

export interface FunnelSteps {
  total: number;
  displayDealers: number;
  displayedDesigns: number;
  monthDealers: number;
  monthDesigns: number;
  monthDisplays: number; // displays put up in this month (in the area)
  monthDealerCount: number;
  customers: number; // customers who bought in this month (in the area)
  displayDealerCount: number;
}

export interface TileLine {
  design: string;
  size: string;
  value: number;
  dealers: number;
}

export interface FunnelResult extends FunnelSteps {
  month: string;
  byRegion: ({ zone: string; region: string } & FunnelSteps)[];
  /** Tiles bought by dealers with a display, split by whether that tile is on display at the buying dealer (top by value). */
  tilesNotOnDisplay: TileLine[];
  tilesOnDisplay: TileLine[];
}

const TOP_TILES = 25;

export interface FunnelFilter {
  zones?: string[];
  regions?: string[];
  dealerCodes?: string[]; // RMI dealer codes (their linked accounts are included)
  rmiNames?: string[]; // only the dealers this RMI covers
}

const majority = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0];

/** customer -> zone/region names (RMI naming). */
export async function customerGeo(): Promise<Map<string, Geo>> {
  const t = tables();
  const db = getDb();
  const cust = await db.select({ c: t.sapCustomer.customer, d: t.sapCustomer.salesDistrict, o: t.sapCustomer.salesOffice }).from(t.sapCustomer);
  const disp = await db.select({ d: t.rmiDisplay.dealerCode, z: t.rmiDisplay.zone, r: t.rmiDisplay.region }).from(t.rmiDisplay);
  const byCust = new Map(cust.map((c) => [c.c, c]));
  const zv = new Map<string, Map<string, number>>();
  const rv = new Map<string, Map<string, number>>();
  for (const x of disp) {
    const c = x.d ? byCust.get(x.d) : undefined;
    if (!c) continue;
    if (c.d && x.z) (zv.get(c.d) ?? zv.set(c.d, new Map()).get(c.d)!).set(x.z, (zv.get(c.d)?.get(x.z) ?? 0) + 1);
    if (c.o && x.r) (rv.get(c.o) ?? rv.set(c.o, new Map()).get(c.o)!).set(x.r, (rv.get(c.o)?.get(x.r) ?? 0) + 1);
  }
  const out = new Map<string, Geo>();
  for (const c of cust) {
    out.set(c.c, {
      zone: (c.d && zv.has(c.d) ? majority(zv.get(c.d)!) : c.d) || "Unknown",
      region: (c.o && rv.has(c.o) ? majority(rv.get(c.o)!) : c.o) || "Unknown",
    });
  }
  return out;
}

const empty = (): FunnelSteps => ({
  total: 0,
  displayDealers: 0,
  displayedDesigns: 0,
  monthDealers: 0,
  monthDesigns: 0,
  monthDisplays: 0,
  monthDealerCount: 0,
  customers: 0,
  displayDealerCount: 0,
});

export async function salesFunnel(month: string, f: FunnelFilter = {}, opts: { includeExtra?: boolean; displays?: DisplayWithSales[] } = {}): Promise<FunnelResult> {
  const t = tables();
  const db = getDb();
  const extra = !!opts.includeExtra;
  const geo = await cached("customerGeo", customerGeo);
  const displays = (opts.displays ?? (await allDisplaysWithSales())).filter(
    (r) => r.cohortMonth && r.cohortMonth <= month && r.dealerCode,
  );

  // Which customers are in scope.
  const inArea = (c: string) => {
    const g = geo.get(c);
    if (f.zones?.length && !f.zones.includes(g?.zone ?? "")) return false;
    if (f.regions?.length && !f.regions.includes(g?.region ?? "")) return false;
    return true;
  };
  let limitTo: Set<string> | null = null;
  if (f.dealerCodes?.length || f.rmiNames?.length) {
    limitTo = new Set(
      displays
        .filter((r) => (!f.dealerCodes?.length || f.dealerCodes.includes(r.dealerCode!)) && (!f.rmiNames?.length || f.rmiNames.includes(r.rmiName ?? "")))
        .flatMap((r) => r.salesAccounts),
    );
  }
  const inScope = (c: string) => inArea(c) && (!limitTo || limitTo.has(c));

  // Accounts of dealers with a display (by then) / with a display put up this month; and their displayed designs.
  const displayAccts = new Set<string>();
  const monthAccts = new Set<string>();
  const pairs = new Set<string>();
  const monthPairs = new Set<string>();
  const monthDisplayRows: DisplayWithSales[] = [];
  for (const r of displays) {
    for (const a of r.salesAccounts) {
      displayAccts.add(a);
      if (r.cohortMonth === month) monthAccts.add(a);
      for (const c of r.salesCodes) {
        pairs.add(`${a}|${c}`);
        if (r.cohortMonth === month) monthPairs.add(`${a}|${c}`);
      }
    }
    if (r.cohortMonth === month) monthDisplayRows.push(r);
  }

  const groupOf = new Map<string, string>();
  for (const r of displays) for (const a of r.salesAccounts) groupOf.set(a, r.dealerGroup ?? a);
  const groupOfAcct = (a: string) => groupOf.get(a) ?? a;
  const res: FunnelResult = { month, ...empty(), byRegion: [], tilesNotOnDisplay: [], tilesOnDisplay: [] };
  const desc = await cached(
    "materialNames",
    async () => new Map((await db.select({ m: t.sapMaterial.material, d: t.sapMaterial.description }).from(t.sapMaterial)).map((x) => [x.m, x.d ?? x.m])),
  );
  const tileAcc = { on: new Map<string, { v: number; d: Set<string> }>(), off: new Map<string, { v: number; d: Set<string> }>() };
  const tileKey = (code: string) => `${desc.get(code) ?? code}|${code.match(/(\d{3,4})X(\d{3,4})/i)?.slice(1).join("x") ?? ""}`;
  const addTile = (which: "on" | "off", code: string, dealer: string, v: number) => {
    const k = tileKey(code);
    const e = tileAcc[which].get(k) ?? tileAcc[which].set(k, { v: 0, d: new Set() }).get(k)!;
    e.v += v;
    e.d.add(dealer);
  };
  const regions = new Map<string, { zone: string; region: string } & FunnelSteps>();
  const bucket = (c: string) => {
    const g = geo.get(c) ?? { zone: "Unknown", region: "Unknown" };
    const k = `${g.zone}|${g.region}`;
    return regions.get(k) ?? regions.set(k, { zone: g.zone, region: g.region, ...empty() }).get(k)!;
  };
  const add = (key: keyof FunnelSteps, c: string, v: number) => {
    res[key] += v;
    bucket(c)[key] += v;
  };

  // Steps 1, 2, 4: all tile sales per customer.
  const custDealers = new Set<string>();
  const monthDealers = new Set<string>();
  const custMonth = await cached(`customerMonthly|${month}`, () => db.select().from(t.sapCustomerMonthly).where(eq(t.sapCustomerMonthly.month, month)));
  for (const s of custMonth) {
    if (!inScope(s.customer)) continue;
    const v = s.value + (extra ? s.extraValue : 0);
    add("total", s.customer, v);
    add("customers", s.customer, 1);
    if (displayAccts.has(s.customer)) {
      add("displayDealers", s.customer, v);
      custDealers.add(s.customer);
    }
    if (monthAccts.has(s.customer)) {
      add("monthDealers", s.customer, v);
      monthDealers.add(s.customer);
    }
  }
  // Steps 3, 5: the displayed designs, per dealer account.
  const salesMonth = await cached(`salesMonthly|${month}`, () => db.select().from(t.sapSalesMonthly).where(eq(t.sapSalesMonthly.month, month)));
  for (const s of salesMonth) {
    if (!inScope(s.dealerCode)) continue;
    const k = `${s.dealerCode}|${s.materialCode}`;
    const v = s.value + (extra ? s.extraValue : 0);
    if (pairs.has(k)) add("displayedDesigns", s.dealerCode, v);
    if (monthPairs.has(k)) add("monthDesigns", s.dealerCode, v);
    if (displayAccts.has(s.dealerCode) && v) addTile(pairs.has(k) ? "on" : "off", s.materialCode, groupOfAcct(s.dealerCode), v);
  }
  const top = (m: Map<string, { v: number; d: Set<string> }>): TileLine[] =>
    [...m]
      .map(([k, e]) => ({ design: k.split("|")[0], size: k.split("|")[1], value: e.v, dealers: e.d.size }))
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_TILES);
  res.tilesOnDisplay = top(tileAcc.on);
  res.tilesNotOnDisplay = top(tileAcc.off);
  // Counts of displays / dealers (by the RMI dealer's own account area).
  const monthDealerGroups = new Set<string>();
  for (const r of monthDisplayRows) {
    if (!r.salesAccounts.some(inScope)) continue;
    res.monthDisplays++;
    bucket(r.dealerCode!).monthDisplays++;
    if (!monthDealerGroups.has(r.dealerGroup ?? r.dealerCode!)) {
      monthDealerGroups.add(r.dealerGroup ?? r.dealerCode!);
      res.monthDealerCount++;
      bucket(r.dealerCode!).monthDealerCount++;
    }
  }
  res.displayDealerCount = new Set([...custDealers].map(groupOfAcct)).size;
  res.byRegion = [...regions.values()].filter((r) => r.total || r.monthDisplays).sort((a, b) => b.total - a.total);
  return res;
}
