// Proves "switch to Postgres by changing DATABASE_URL": runs migrations, a SAP sync, upserts, the design
// mapping, the sales join and the report on a real Postgres engine (PGlite, served over the Postgres protocol).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = 55432;
process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
process.env.SAP_ODATA_BASE_URL = "https://sap.example.test/sap/opu/odata/sap/";
process.env.SAP_USER = "reader";
process.env.SAP_PASS = "secret";
process.env.SAP_SALES_DOC_TYPES = "ZVDT";
process.env.SAP_RETURN_DOC_TYPES = "ZRTI";

let pg: PGlite;
let server: PGLiteSocketServer;

const MAT = "TIGVIBR1200X600NOMA02166";
const d = (iso: string) => `/Date(${Date.parse(iso)})/`;
const billing = [
  {
    BillingDocument: "1",
    BillingDocumentType: "ZVDT",
    SDDocumentCategory: "M",
    BillingDocumentDate: d("2026-09-10"),
    SoldToParty: "11000111",
    SalesOrganization: "1801",
    BillingDocumentIsCancelled: false,
    TransactionCurrency: "INR",
    LastChangeDateTime: d("2026-09-10"),
    to_Item: { results: [{ BillingDocumentItem: "10", Material: MAT, BillingQuantity: "10", BillingQuantityUnit: "BOX", BillingQuantityInBaseUnit: "10", BaseUnit: "BOX", NetAmount: "5000", TaxAmount: "900" }] },
  },
];
const products = [
  {
    Product: MAT,
    BaseUnit: "BOX",
    to_Description: { results: [{ Language: "EN", ProductDescription: "Marlow Frost" }] },
    to_ProductUnitsOfMeasure: { results: [{ AlternativeUnit: "M2", QuantityNumerator: "1000", QuantityDenominator: "1440" }] },
  },
];

beforeAll(async () => {
  pg = await PGlite.create();
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 });
  await server.start();
  vi.stubGlobal("fetch", async (url: string) =>
    new Response(JSON.stringify({ d: { results: url.includes("A_Product") ? products : url.includes("A_BillingDocument") ? billing : [] } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}, 60_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  await (await import("@/db/client")).closeDb();
  await server?.stop();
  await pg?.close();
});

describe("Postgres (via DATABASE_URL only)", () => {
  it("runs the whole pipeline", async () => {
    const { dialectOf, getDb, tables } = await import("@/db/client");
    expect(dialectOf(process.env.DATABASE_URL!)).toBe("postgres");
    const { ensureSchema } = await import("@/db/migrate");
    await ensureSchema();

    const db = getDb();
    const t = tables();
    const now = new Date().toISOString();
    await db.insert(t.rmiProduct).values({ productCode: MAT, productName: "Marlow Frost", category: "GVT", size: "600X1200", lastSeenAt: now });
    await db.insert(t.rmiDisplay).values({
      refNo: "WZ1/GOA/7589",
      displayTrackerId: 1,
      displayDate: "2026-08-04",
      cohortMonth: "2026-08",
      displayDateRaw: "04 Aug 2026",
      dealerCode: "0011000111",
      dealerNameRaw: "0011000111 - Concrete Concept",
      designName: "Marlow Frost",
      sizeMm: "600X1200",
      firstSeenAt: now,
      lastSeenAt: now,
    });

    const { rebuildDesignMap } = await import("@/sync/design-match");
    expect(await rebuildDesignMap()).toMatchObject({ mapped: 1 });
    expect(await rebuildDesignMap()).toMatchObject({ mapped: 1 }); // upsert path on Postgres

    const { syncSap } = await import("@/sync/sap-sync");
    const r = await syncSap();
    expect(r.skipped).toBe(false);

    const { displaysWithSales } = await import("@/sales/window");
    const [row] = await displaysWithSales();
    expect(row.sales[2]).toMatchObject({ month: "2026-09", value: 5000 });
    expect(row.sales[2].volume).toBeCloseTo(14.4, 3);

    const { buildReportBuffer } = await import("@/report/excel");
    const rep = await buildReportBuffer("2026-08");
    expect(rep.rows).toBe(1);

    const runs = await db.select().from(t.syncRuns);
    expect(runs.map((x) => x.status)).toContain("ok");
  }, 60_000);
});
