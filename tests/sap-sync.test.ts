// End-to-end SAP sync against a fake OData server (fixture data), on an in-memory SQLite DB.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.SAP_ODATA_BASE_URL = "https://sap.example.test/sap/opu/odata/sap/";
process.env.SAP_USER = "reader";
process.env.SAP_PASS = "secret";
process.env.SAP_SALES_DOC_TYPES = "F2";
process.env.SAP_RETURN_DOC_TYPES = "RE";

const d = (iso: string) => `/Date(${Date.parse(iso)})/`;
const doc = (no: string, type: string, date: string, soldTo: string, items: object[], cancelled = false) => ({
  BillingDocument: no,
  BillingDocumentType: type,
  SDDocumentCategory: "M",
  BillingDocumentDate: d(date),
  SoldToParty: soldTo,
  SalesOrganization: "1000",
  DistributionChannel: "10",
  Division: "10",
  BillingDocumentIsCancelled: cancelled,
  TransactionCurrency: "INR",
  LastChangeDateTime: d(date),
  to_Item: { results: items },
});
const item = (n: string, material: string, boxes: number, net: number) => ({
  BillingDocumentItem: n,
  Material: material,
  BillingQuantity: String(boxes),
  BillingQuantityUnit: "BOX",
  BillingQuantityInBaseUnit: String(boxes),
  BaseUnit: "BOX",
  NetAmount: String(net),
  TaxAmount: "0",
});

const MAT = "TIGVMPL1200X600NOGL02140";
const billing = [
  doc("9000001", "F2", "2026-08-10", "11000111", [item("10", MAT, 100, 50000)]), // OData strips leading zeros
  doc("9000002", "F2", "2026-09-05", "0011000111", [item("10", MAT, 50, 25000)]),
  doc("9000003", "RE", "2026-09-20", "0011000111", [item("10", MAT, 10, 5000)]), // return
  doc("9000004", "F2", "2026-09-21", "0011000111", [item("10", MAT, 999, 999999)], true), // cancelled
  doc("9000005", "S1", "2026-09-22", "0011000111", [item("10", MAT, 999, 999999)]), // cancellation doc
];
const products = [
  {
    Product: MAT,
    ProductType: "FERT",
    ProductGroup: "GVT",
    BaseUnit: "BOX",
    to_Description: { results: [{ Language: "EN", ProductDescription: "Aeon Armani - G" }] },
    // 1 M2 = 1 / 1.44 BOX  -> 1.44 m² per box
    to_ProductUnitsOfMeasure: { results: [{ AlternativeUnit: "M2", QuantityNumerator: "25", QuantityDenominator: "36" }] },
  },
];

const methods: string[] = [];

beforeAll(() => {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    methods.push(init?.method ?? "GET");
    const results = url.includes("A_Product") ? products : url.includes("A_BillingDocument") ? billing : [];
    return new Response(JSON.stringify({ d: { results } }), { status: 200, headers: { "content-type": "application/json" } });
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  (await import("@/db/client")).closeDb();
});

describe("SAP sync (fixture)", () => {
  it("aggregates sales per dealer × material × month with the agreed rules", async () => {
    const { syncSap } = await import("@/sync/sap-sync");
    const { getDb, tables } = await import("@/db/client");
    const r = await syncSap();
    expect(r.skipped).toBe(false);

    const rows = await getDb().select().from(tables().sapSalesMonthly);
    const byMonth = Object.fromEntries(rows.map((x) => [x.month, x]));
    expect(Object.keys(byMonth).sort()).toEqual(["2026-08", "2026-09"]);
    expect(byMonth["2026-08"]).toMatchObject({ dealerCode: "0011000111", materialCode: MAT, volume: 144, value: 50000 });
    // Sep: 50 boxes sale − 10 boxes return = 40 boxes = 57.6 m²; cancelled + S1 ignored
    expect(byMonth["2026-09"]).toMatchObject({ volume: 57.6, value: 20000, lineCount: 2 });
  });

  it("joins sales onto a display row over the 14-month window", async () => {
    const { getDb, tables } = await import("@/db/client");
    const { displaysWithSales, windowMonths } = await import("@/sales/window");
    const now = new Date().toISOString();
    await getDb().insert(tables().rmiDisplay).values({
      refNo: "WZ1/GOA/1",
      displayDate: "2026-08-04",
      cohortMonth: "2026-08",
      dealerCode: "0011000111",
      designName: "Aeon Armani - G",
      materialCode: MAT,
      mapStatus: "mapped",
      firstSeenAt: now,
      lastSeenAt: now,
    });
    const [row] = await displaysWithSales();
    expect(row.sales.map((s) => s.month)).toEqual(windowMonths("2026-08"));
    expect(row.sales).toHaveLength(14);
    expect(row.sales[1]).toMatchObject({ month: "2026-08", volume: 144, value: 50000 });
    expect(row.sales[2]).toMatchObject({ month: "2026-09", volume: 57.6, value: 20000 });
    expect(row.avgValue).toBeCloseTo(70000 / 14, 3);
  });

  it("only ever sends GET requests to SAP", () => {
    expect(methods.length).toBeGreaterThan(0);
    expect(new Set(methods)).toEqual(new Set(["GET"]));
  });
});
