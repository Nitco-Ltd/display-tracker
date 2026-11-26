// End-to-end SAP sync against a fake OData server (fixture data), on an in-memory SQLite DB.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.SAP_ODATA_BASE_URL = "https://sap.example.test/sap/opu/odata/sap/";
process.env.SAP_USER = "reader";
process.env.SAP_PASS = "secret";
process.env.SAP_SALES_DOC_TYPES = "F2";
process.env.SAP_RETURN_DOC_TYPES = "RE";
process.env.SAP_VALUE_ONLY_DOC_TYPES = "ZCPD";
process.env.SAP_EXTRA_DOC_TYPES = "ZNTI";
process.env.SAP_EXTRA_VALUE_ONLY_DOC_TYPES = "ZTDN";

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
  doc("9000006", "ZCPD", "2026-09-25", "0011000111", [item("10", MAT, 50, 1000)]), // rate-difference credit: value only
  doc("9000007", "ZNTI", "2026-09-26", "0011000111", [item("10", MAT, 5, 2500)]), // undecided type: kept apart
  doc("9000008", "ZTDN", "2026-09-27", "0011000111", [item("10", MAT, 5, 300)]), // undecided debit note: value only
  doc("9000009", "F2", "2026-10-02", "11000222", [item("10", MAT, 10, 4000)]), // the dealer's second account
];
const customers = [
  { Customer: "11000111", CustomerName: "Test Tiles", CustomerFullName: "Company Test Tiles/846004 DARBHANGA", TaxNumber3: "10COSPP0792L1ZG", CreationDate: d("2022-01-01"), DeletionIndicator: false },
  { Customer: "11000222", CustomerName: "Test Tiles", CustomerFullName: "Company Test Tiles/846004 Darbhanga", TaxNumber3: "10COSPP0792L1ZG", CreationDate: d("2026-08-27"), DeletionIndicator: false },
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
    const results = url.includes("A_Product") ? products : url.includes("A_BillingDocument") ? billing : url.includes("A_Customer") ? customers : [];
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
    const own = rows.filter((x) => x.dealerCode === "0011000111");
    const byMonthOwn = Object.fromEntries(own.map((x) => [x.month, x]));
    expect(Object.keys(byMonthOwn).sort()).toEqual(["2026-08", "2026-09"]);
    expect(byMonthOwn["2026-08"]).toMatchObject({ dealerCode: "0011000111", materialCode: MAT, volume: 144, value: 50000 });
    // Sep: 50 boxes sale − 10 boxes return = 40 boxes = 57.6 m²; ₹1,000 rate credit reduces value only;
    // cancelled invoice + S1 cancellation ignored
    expect(byMonthOwn["2026-09"]).toMatchObject({ volume: 57.6, value: 19000, lineCount: 3 });
    // ZNTI (5 boxes, ₹2,500) and ZTDN (₹300, value only) are kept apart
    expect(byMonthOwn["2026-09"]).toMatchObject({ extraVolume: 7.2, extraValue: 2800 });
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
    expect(row.sales[2]).toMatchObject({ month: "2026-09", volume: 57.6, value: 19000 });
    // Oct: bought on the dealer's second account (same GST number and PIN code)
    expect(row.salesAccounts).toEqual(["0011000111", "0011000222"]);
    expect(row.sales[3]).toMatchObject({ month: "2026-10", value: 4000 });
    expect(row.otherAccountValue).toBe(4000);
    expect(row.avgValue).toBeCloseTo(73000 / 14, 3);
    expect(row.extraValue).toBe(2800);

    const [incl] = await displaysWithSales(undefined, { includeExtra: true });
    expect(incl.sales[2]).toMatchObject({ month: "2026-09", value: 21800 });
    expect(incl.avgValue).toBeCloseTo(75800 / 14, 3);
  });

  it("only ever sends GET requests to SAP", () => {
    expect(methods.length).toBeGreaterThan(0);
    expect(new Set(methods)).toEqual(new Set(["GET"]));
  });
});

describe("export invoices in foreign currency", () => {
  it("converts USD lines to rupees at the invoice's exchange rate; INR lines stay as they are", async () => {
    const { toInr } = await import("@/sync/sap-sync");
    expect(toInr({ netAmount: 1000, currency: "USD", exchangeRate: 88.5 })).toBe(88500);
    expect(toInr({ netAmount: 1000, currency: "INR", exchangeRate: null })).toBe(1000);
  });
  it("reads SAP's rate the right way round when it is quoted indirectly", async () => {
    const { exchangeRateToInr } = await import("@/adapters/sap");
    expect(exchangeRateToInr(88.5, false)).toBe(88.5);
    expect(exchangeRateToInr(0.0113, true)).toBeCloseTo(88.5, 0);
    expect(exchangeRateToInr(null, false)).toBeNull();
  });
});

describe("cancellation documents", () => {
  const rules = {
    sales: new Set(["ZVDT", "S2"]),
    returns: new Set(["ZRTI", "S1", "S3"]),
    valueOnly: new Set(["ZCBR"]),
    extra: new Set(["ZNTI"]),
    extraValueOnly: new Set(["ZTDN"]),
  };
  it("count in the bucket of the document they cancel, with the opposite sign", async () => {
    const { lineTreatment } = await import("@/sync/sap-sync");
    expect(lineTreatment("S3", "ZTDN", rules)).toEqual({ isExtra: true, isValueOnly: true, sign: -1 }); // cancelled debit note
    expect(lineTreatment("S1", "ZVDT", rules)).toEqual({ isExtra: false, isValueOnly: false, sign: -1 }); // cancelled invoice
    expect(lineTreatment("S2", "ZRTI", rules)).toEqual({ isExtra: false, isValueOnly: false, sign: 1 }); // cancelled return
  });
  it("fall back to their own type when the cancelled document isn't known", async () => {
    const { lineTreatment } = await import("@/sync/sap-sync");
    expect(lineTreatment("S3", undefined, rules)).toEqual({ isExtra: false, isValueOnly: false, sign: -1 });
  });
});
