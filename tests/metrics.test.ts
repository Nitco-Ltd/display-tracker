import { describe, expect, it } from "vitest";
import { afterSalesTotal, beforeAfter, kpis, uniquePairs, zeroSales } from "@/analytics/metrics";
import { windowMonths, reportAverages, type DisplayWithSales } from "@/sales/window";

const CUR = "2026-11";
function row(ref: string, cohort: string, sales: Record<string, number>, over: Partial<DisplayWithSales> = {}): DisplayWithSales {
  const s = windowMonths(cohort).map((m) => ({ month: m, volume: (sales[m] ?? 0) / 100, value: sales[m] ?? 0 }));
  return {
    refNo: ref,
    cohortMonth: cohort,
    dealerCode: "D1",
    materialCode: "MAT1",
    mapStatus: "mapped",
    sales: s,
    ...reportAverages(s),
    ...over,
  } as DisplayWithSales;
}

describe("dashboard metrics", () => {
  // One dealer+design's SAP months (identical for every display of that pair, as in real data):
  const d1 = { "2026-05": 100, "2026-07": 500, "2026-09": 300, "2026-10": 200 };
  const a = row("A", "2026-06", d1);
  const aDup = row("A2", "2026-06", d1); // same pair, second panel
  const b = row("B", "2026-08", d1); // same dealer+design displayed again two months later
  const c = row("C", "2026-07", {}, { dealerCode: "D2", materialCode: "MAT2" }); // no sales
  const u = row("U", "2026-07", {}, { materialCode: null, mapStatus: "unmapped" }); // not linked
  const fresh = row("F", "2026-11", {}, { dealerCode: "D3", materialCode: "MAT3" }); // no after-month yet

  it("counts same dealer + design + month once (rule 1)", () => {
    expect(uniquePairs([a, aDup, b])).toHaveLength(2);
  });

  it("counts each dealer × material × month once in totals (rule 2)", () => {
    // a after: Jul 500 + Sep 300 + Oct 200; aDup identical; b after: Sep + Oct (already counted) -> 1000
    expect(afterSalesTotal([a, aDup, b], CUR).value).toBe(1000);
  });

  it("kpis use only measurable display pairs for rates", () => {
    const k = kpis([a, aDup, b, c, u, fresh], CUR);
    expect(k.displays).toBe(6);
    expect(k.measurablePairs).toBe(3); // a, b, c  (aDup merged, u unlinked, fresh has no M+1 yet)
    expect(k.convertedPairs).toBe(2);
    expect(k.conversion).toBeCloseTo(2 / 3);
    expect(k.unlinked).toBe(1);
    expect(k.duplicateRows).toBe(1);
  });

  it("before vs after only includes months that have started", () => {
    const pts = beforeAfter([a, b, c], CUR);
    const m1 = pts.find((p) => p.label === "M−1")!;
    expect(m1.pairs).toBe(3);
    const m12 = pts.find((p) => p.label === "M+12")!;
    expect(m12.pairs).toBe(0);
    const m3 = pts.find((p) => p.label === "M+3")!; // a: Sep (300), b: Nov (0), c: Oct (0)
    expect(m3.pairs).toBe(3);
    expect(m3.avgValue).toBeCloseTo(100);
  });

  it("zero-sales list: linked, N months passed, nothing sold in M+1..M+N", () => {
    expect(zeroSales([a, b, c, u, fresh], 3, CUR).map((r) => r.refNo)).toEqual(["C"]);
  });
});

describe("packaging variants in metrics", () => {
  it("two displays of the same design under old and new packaging codes count once", () => {
    const fam = "TIGVMPL1200X600NOGL|oyster blue onyx";
    const a = row("A", "2026-08", { "2026-09": 1000 }, { materialCode: "TIGVMPL1200X600NOGL02160", salesFamily: fam });
    const b = row("B", "2026-08", { "2026-09": 1000 }, { materialCode: "TIGVMPL1200X600NOGL03021", salesFamily: fam });
    expect(uniquePairs([a, b])).toHaveLength(1);
    expect(afterSalesTotal([a, b], CUR).value).toBe(1000);
  });
});

describe("linked dealer accounts in metrics", () => {
  it("two displays recorded under a dealer's two accounts count once", () => {
    const g = "0011002222+0011007639";
    const a = row("A", "2026-08", { "2026-09": 500 }, { dealerCode: "0011002222", dealerGroup: g });
    const b = row("B", "2026-08", { "2026-09": 500 }, { dealerCode: "0011007639", dealerGroup: g });
    expect(uniquePairs([a, b])).toHaveLength(1);
    expect(afterSalesTotal([a, b], CUR).value).toBe(500);
  });
});
