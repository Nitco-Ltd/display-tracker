// Phase 2 acceptance test: rebuild the Aug-2026 report from fixture data and compare with the reference sample.
// The sample's sales numbers are used only as fixture INPUT (to check our layout and the average formula),
// never as a check of sales correctness.
import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { afterAll, describe, expect, it } from "vitest";
import { readXlsx, colLetter } from "@/lib/xlsx-read";
import { mapExportRows } from "@/adapters/rmi";
import { parseRmiDate } from "@/lib/normalize";

const SAMPLE = "reference/Display Tracker Report - Aug-2026.xlsx";
const hasSample = existsSync(SAMPLE);

afterAll(async () => (await import("@/db/client")).closeDb());

async function readBack(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb.getWorksheet("Report")!;
}

describe("report layout", () => {
  it("builds headers dynamically from the cohort month", async () => {
    const { reportHeaders, reportFileName } = await import("@/report/excel");
    const h = reportHeaders("2026-08", "2027-08"); // complete window
    expect(h).toHaveLength(51);
    expect(h[0]).toBe("Sequence No");
    expect(h[20]).toBe("Status");
    expect(h[21]).toBe("Jul-26 Sales Volume");
    expect(h[23]).toBe("Aug-26 Sales Volume");
    expect(h[24]).toBe("Aug-26 Sales Value");
    expect(h[25]).toBe("Sep-26 Sales Volume");
    expect(h[48]).toBe("Aug-27 Sales Value");
    expect(h.slice(-2)).toEqual(["Avg Sales Volume", "Avg Sales Value"]);
    expect(reportHeaders("2026-01", "2027-01")[21]).toBe("Dec-25 Sales Volume");
    expect(reportFileName("2026-08")).toBe("Display_Tracker_Report_-_Aug-2026.xlsx");
    expect(reportFileName("2026-09")).toBe("Display_Tracker_Report_-_Sep-2026.xlsx");
  });

  it.skipIf(!hasSample)("headers are identical to the sample's", async () => {
    const { reportHeaders } = await import("@/report/excel");
    const s = readXlsx(new Uint8Array(readFileSync(SAMPLE)));
    expect(reportHeaders("2026-08", "2027-08")).toEqual(Array.from({ length: 51 }, (_, i) => s.header[colLetter(i + 1)]));
  });

  it.skipIf(!hasSample)("average = sum of 14 months ÷ 14 reproduces every sample row", async () => {
    const { reportAverages } = await import("@/sales/window");
    const s = readXlsx(new Uint8Array(readFileSync(SAMPLE)));
    for (const r of s.rows) {
      const sales = Array.from({ length: 14 }, (_, i) => ({ volume: +r[colLetter(22 + 2 * i)], value: +r[colLetter(23 + 2 * i)] }));
      const avg = reportAverages(sales);
      expect(avg.avgVolume).toBeCloseTo(+r.AX, 3);
      expect(avg.avgValue).toBeCloseTo(+r.AY, 3);
    }
  });
});

describe("months that haven't started are left out", () => {
  it("Sep-2026 report built in Nov-2026 has Aug–Nov 2026 only", async () => {
    const { reportHeaders, visibleMonths } = await import("@/report/excel");
    expect(visibleMonths("2026-09", "2026-11")).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    const h = reportHeaders("2026-09", "2026-11");
    expect(h).toHaveLength(21 + 4 * 2 + 2);
    expect(h.slice(21, 29)).toEqual([
      "Aug-26 Sales Volume", "Aug-26 Sales Value", "Sep-26 Sales Volume", "Sep-26 Sales Value",
      "Oct-26 Sales Volume", "Oct-26 Sales Value", "Nov-26 Sales Volume", "Nov-26 Sales Value",
    ]);
    expect(h.slice(-2)).toEqual(["Avg Sales Volume", "Avg Sales Value"]);
    expect(reportHeaders("2026-11", "2026-11")).toHaveLength(21 + 2 * 2 + 2); // Oct-26, Nov-26
  });

  it("writes only the visible months' numbers, averages unchanged (÷14)", async () => {
    const { buildWorkbook } = await import("@/report/excel");
    const { windowMonths, reportAverages } = await import("@/sales/window");
    const sales = windowMonths("2026-09").map((m, i) => ({ month: m, volume: i, value: i * 10 }));
    const row = { refNo: "X/1", cohortMonth: "2026-09", salesAccounts: [], salesCodes: [], otherAccountValue: 0, sales, ...reportAverages(sales) } as never;
    const wb = buildWorkbook("2026-09", [row], "2026-11");
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const ws = await readBack(buf);
    const r = ws.getRow(2);
    expect([22, 23, 28, 29].map((c) => r.getCell(c).value)).toEqual([0, 0, 3, 30]); // Aug vol/val, Nov vol/val
    expect(r.getCell(30).value).toBeCloseTo(91 / 14, 3); // avg volume: all 14 months (0..13) ÷ 14
    expect(ws.getRow(1).cellCount).toBe(31);
  });
});

describe.skipIf(!hasSample)("rebuild Aug-2026 from the sample as fixture data", () => {
  it("reproduces columns A–U and the averages cell for cell, with real numbers and dates", async () => {
    const { getDb, tables } = await import("@/db/client");
    const { ensureSchema } = await import("@/db/migrate");
    const { buildReportBuffer } = await import("@/report/excel");
    const { windowMonths } = await import("@/sales/window");
    await ensureSchema();
    const db = getDb();
    const t = tables();

    const s = readXlsx(new Uint8Array(readFileSync(SAMPLE)));
    const headerAU = Object.fromEntries(Object.entries(s.header).filter(([k]) => k.length === 1 && k <= "U"));
    const display = mapExportRows(headerAU, s.rows);
    const months = windowMonths("2026-08");
    const now = new Date().toISOString();

    // Fixture: one display row per sample row (its own material code), and SAP monthly sales equal to its numbers.
    const sales: (typeof t.sapSalesMonthly.$inferInsert)[] = [];
    await db.insert(t.rmiDisplay).values(
      display.map((d, i) => {
        const iso = parseRmiDate(d.displayDate);
        months.forEach((m, j) => {
          const volume = +s.rows[i][colLetter(22 + 2 * j)];
          const value = +s.rows[i][colLetter(23 + 2 * j)];
          if (volume || value) sales.push({ dealerCode: d.dealerCode!, materialCode: `FIX${i}`, month: m, volume, value, lineCount: 1, updatedAt: now });
        });
        return {
          refNo: d.refNo,
          displayTrackerId: i + 1,
          displayDate: iso,
          cohortMonth: iso!.slice(0, 7),
          displayDateRaw: d.displayDate,
          rmiName: d.rmiName,
          dealerCode: d.dealerCode,
          dealerNameRaw: d.dealerName,
          dealerStatus: d.dealerStatus,
          zone: d.zone,
          region: d.region,
          location: d.location,
          dealerCategory: d.dealerCategory,
          franchiseType: d.franchiseType,
          displayedWhere: d.displayedWhere,
          cassetteType: d.cassetteType,
          cassetteNumber: d.cassetteNumber,
          panelNo: d.panelNo,
          panelSize: d.panelSize,
          productType: d.productType,
          sizeMm: d.sizeMm,
          designName: d.designName,
          designStatus: d.designStatus,
          status: d.status,
          materialCode: `FIX${i}`,
          mapStatus: "mapped",
          firstSeenAt: now,
          lastSeenAt: now,
        };
      }),
    );
    if (sales.length) await db.insert(t.sapSalesMonthly).values(sales);

    const { buffer, rows } = await buildReportBuffer("2026-08", {}, "2027-08"); // complete window = sample layout
    expect(rows).toBe(831);
    const ws = await readBack(buffer);
    expect(ws.name).toBe("Report");
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });

    const text = (v: unknown) =>
      v instanceof Date
        ? `${String(v.getUTCDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][v.getUTCMonth()]} ${v.getUTCFullYear()}`
        : v == null ? "" : String(v);
    for (let i = 0; i < 831; i++) {
      const row = ws.getRow(i + 2);
      for (let c = 1; c <= 21; c++) expect(text(row.getCell(c).value), `${colLetter(c)}${i + 2}`).toBe((s.rows[i][colLetter(c)] ?? "").trim());
      expect(row.getCell(2).value).toBeInstanceOf(Date);
      for (let c = 22; c <= 51; c++) expect(typeof row.getCell(c).value).toBe("number");
      expect(row.getCell(50).value as number).toBeCloseTo(+s.rows[i].AX, 3);
      expect(row.getCell(51).value as number).toBeCloseTo(+s.rows[i].AY, 3);
    }
    expect(typeof ws.getRow(2).getCell(4).value).toBe("string"); // dealer code keeps its leading zeros
  });
});
