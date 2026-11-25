// The daily job copies the dashboard tables from the local SQLite to the cloud Postgres (Neon) used by Vercel.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";

const PORT = 55433;
const CLOUD = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`;
process.env.PUBLISH_DATABASE_URL = CLOUD;

let pg: PGlite;
let server: PGLiteSocketServer;

beforeAll(async () => {
  pg = await PGlite.create();
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 });
  await server.start();
}, 60_000);
afterAll(async () => {
  await (await import("@/db/client")).closeDb();
  await server?.stop();
  await pg?.close();
});

describe("publish to the cloud database", () => {
  it("copies the dashboard tables, and replaces them on the next run", async () => {
    const { getDb, tables } = await import("@/db/client");
    const { ensureSchema } = await import("@/db/migrate");
    const { publishToCloud } = await import("@/sync/publish");
    await ensureSchema();
    const db = getDb();
    const t = tables();
    const now = new Date().toISOString();
    await db.insert(t.rmiDisplay).values({ refNo: "EZ1/BH/1", cohortMonth: "2026-08", dealerCode: "0011000111", designName: "Oyster Blue Onyx", materialCode: "M1", mapStatus: "mapped", firstSeenAt: now, lastSeenAt: now });
    await db.insert(t.sapSalesMonthly).values({ dealerCode: "0011000111", materialCode: "M1", month: "2026-08", volume: 10, value: 5000, extraVolume: 0, extraValue: 300, lineCount: 1, updatedAt: now });
    await db.insert(t.sapBillingItem).values({ billingDocument: "1", item: "10", fetchedAt: now }); // stays local

    const r1 = await publishToCloud();
    expect(r1.rows).toMatchObject({ rmiDisplay: 1, sapSalesMonthly: 1 });

    const sql = postgres(CLOUD, { max: 1 });
    expect(await sql`select ref_no, material_code from rmi_display`).toEqual([{ ref_no: "EZ1/BH/1", material_code: "M1" }]);
    expect(Number((await sql`select extra_value from sap_sales_monthly`)[0].extra_value)).toBe(300);
    expect((await sql`select count(*)::int n from sap_billing_item`)[0].n).toBe(0);

    await db.update(t.sapSalesMonthly).set({ value: 7000 });
    await publishToCloud();
    const after = await sql`select value from sap_sales_monthly`;
    expect(after.map((x) => Number(x.value))).toEqual([7000]);
    await sql.end();
  });
});
