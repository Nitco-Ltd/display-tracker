// Builds the "Display Tracker Report" workbook in the exact column layout of the reference sample:
// one sheet "Report" holding one Excel table "Report", columns A–AY, one row per display, in RMI record order.
// Differences from RMI's file, by design: real numbers and dates (not text), frozen header, widths, number formats.
import ExcelJS from "exceljs";
import { addMonths, allDisplaysWithSales, matchesFilter, WINDOW_MONTHS, windowMonths, type DisplayWithSales, type SalesOptions } from "@/sales/window";
import { monthLabel, monthYear } from "@/lib/format";
import type { ReportFilter } from "./filters";
import { salesFunnel, type FunnelResult } from "@/sales/funnel";

/** Columns A–U, in order, with the field that feeds each (original RMI values, not normalized). */
export const DISPLAY_COLUMNS: { header: string; value: (r: DisplayWithSales) => string | Date | null; width: number }[] = [
  { header: "Sequence No", value: (r) => r.refNo, width: 16 },
  { header: "Product Display Date", value: (r) => (r.displayDate ? new Date(`${r.displayDate}T00:00:00Z`) : r.displayDateRaw), width: 14 },
  { header: "RMI Name", value: (r) => r.rmiName, width: 22 },
  { header: "Dealer Code", value: (r) => r.dealerCode, width: 12 },
  { header: "Dealer Name", value: (r) => r.dealerNameRaw, width: 40 },
  { header: "Dealer Status", value: (r) => r.dealerStatus, width: 10 },
  { header: "Zone", value: (r) => r.zone, width: 13 },
  { header: "Region", value: (r) => r.region, width: 16 },
  { header: "Location", value: (r) => r.location, width: 16 },
  { header: "Dealer / Franchise", value: (r) => r.dealerCategory, width: 14 },
  { header: "Franchise Type", value: (r) => r.franchiseType, width: 10 },
  { header: "Displayed Where", value: (r) => r.displayedWhere, width: 12 },
  { header: "Cassette Type", value: (r) => r.cassetteType, width: 18 },
  { header: "Cassette Number", value: (r) => r.cassetteNumber, width: 9 },
  { header: "Panel No", value: (r) => r.panelNo, width: 8 },
  { header: "Panel Size", value: (r) => r.panelSize, width: 11 },
  { header: "Product Type", value: (r) => r.productType, width: 20 },
  { header: "Size (MM)", value: (r) => r.sizeMm, width: 11 },
  { header: "Design Name", value: (r) => r.designName, width: 28 },
  { header: "Design Status", value: (r) => r.designStatus, width: 9 },
  { header: "Status", value: (r) => r.status, width: 18 },
];

/**
 * Full header row A–AY for a cohort month, e.g. "2026-08" -> […, "Jul-26 Sales Volume", "Jul-26 Sales Value", …].
 * cohort = null (export spanning several display months): months relative to each display, "M-1" … "M+12".
 */
export function reportHeaders(cohort: string | null, upTo: string = currentMonth()): string[] {
  const labels = cohort
    ? visibleMonths(cohort, upTo).map(monthLabel)
    : Array.from({ length: WINDOW_MONTHS }, (_, i) => (i === 1 ? "M" : i === 0 ? "M-1" : `M+${i - 1}`));
  const sales = labels.flatMap((l) => [`${l} Sales Volume`, `${l} Sales Value`]);
  return [...DISPLAY_COLUMNS.map((c) => c.header), ...sales, "Avg Sales Volume", "Avg Sales Value"];
}

/** "yyyy-mm" of today. */
export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/**
 * Months of a cohort's 14-month window that have started (decided 2026-11-24: future months are left out,
 * so the report grows by one month each month until it is complete). E.g. Sep-2026 in Nov-2026 -> Aug–Nov 2026.
 */
export function visibleMonths(cohort: string, upTo: string = currentMonth()): string[] {
  return windowMonths(cohort).filter((m) => m <= upTo);
}

/** "2026-08" -> "Display_Tracker_Report_-_Aug-2026.xlsx" */
export function reportFileName(cohort: string, opts: SalesOptions = {}): string {
  return `Display_Tracker_Report_-_${monthYear(cohort)}${opts.retailOnly ? "_Retail" : ""}${opts.withoutProjectDealers ? "_without_project_dealers" : ""}${opts.includeExtra ? "_incl_ZTDN_ZNTI_ZDMS" : ""}.xlsx`;
}

export function buildWorkbook(cohort: string | null, rows: DisplayWithSales[], upTo: string = currentMonth()): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Display Tracker";
  wb.created = new Date();
  const ws = wb.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = reportHeaders(cohort, upTo);
  const nDisplay = DISPLAY_COLUMNS.length;
  const nMonths = cohort ? visibleMonths(cohort, upTo).length : WINDOW_MONTHS; // window starts at M−1, so a prefix

  const data = rows.map((r) => [
    ...DISPLAY_COLUMNS.map((c) => c.value(r) ?? null),
    ...r.sales.slice(0, nMonths).flatMap((s) => [s.volume, s.value]),
    r.avgVolume,
    r.avgValue,
  ]);

  if (data.length) {
    // Same structure as the sample: an Excel table named "Report" (gives the filter buttons).
    ws.addTable({
      name: "Report",
      ref: "A1",
      headerRow: true,
      style: { theme: "TableStyleLight1", showRowStripes: true },
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows: data,
    });
  } else {
    ws.addRow(headers);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  }

  ws.getRow(1).font = { bold: true };
  headers.forEach((h, i) => {
    const col = ws.getColumn(i + 1);
    if (i < nDisplay) col.width = DISPLAY_COLUMNS[i].width;
    else col.width = Math.max(12, Math.min(22, h.length * 0.8));
    if (i === 1) col.numFmt = "dd mmm yyyy";
    else if (i >= nDisplay) col.numFmt = "#,##0.000";
  });

  // Second sheet (the "Report" sheet keeps RMI's exact layout): which SAP accounts and codes each row's sales come from.
  const how = wb.addWorksheet("How sales were matched", { views: [{ state: "frozen", ySplit: 1 }] });
  const extraIn = rows[0]?.includesExtra ?? false;
  how.addRow([
    "Sequence No",
    "Dealer Code",
    "SAP accounts counted",
    "SAP design codes counted",
    "Value from linked accounts",
    "Value, all 14 months",
    extraIn ? "of which ZTDN/ZNTI/ZDMS (included)" : "ZTDN/ZNTI/ZDMS value (NOT included)",
  ]);
  how.getRow(1).font = { bold: true };
  for (const r of rows) {
    how.addRow([
      r.refNo,
      r.dealerCode,
      r.salesAccounts.join(", "),
      r.salesCodes.length ? r.salesCodes.join(", ") : "(design not linked to SAP)",
      r.otherAccountValue,
      r.sales.reduce((a, s) => a + s.value, 0),
      r.extraValue ?? 0,
    ]);
  }
  [16, 12, 26, 52, 16, 16, 22].forEach((w, i) => (how.getColumn(i + 1).width = w));
  for (const c of [5, 6, 7]) how.getColumn(c).numFmt = "#,##0.00";
  how.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
  return wb;
}

/** Rows for a cohort month (plus optional extra filters), in RMI record order. */
export async function reportRows(cohort: string, filter: ReportFilter = {}, opts: SalesOptions = {}): Promise<DisplayWithSales[]> {
  const f = { ...filter, cohortMonths: [cohort] };
  return (await allDisplaysWithSales(opts)).filter((r) => matchesFilter(r, f));
}

export async function buildReportBuffer(
  cohort: string,
  filter: ReportFilter = {},
  upTo: string = currentMonth(),
  opts: SalesOptions = {},
): Promise<{ buffer: Buffer; rows: number }> {
  const rows = await reportRows(cohort, filter, opts);
  const summary = await salesFunnel(
    cohort,
    { zones: filter.zones, regions: filter.regions, dealerCodes: filter.dealerCodes, rmiNames: filter.rmiNames },
    opts,
  );
  const wb = buildWorkbook(cohort, rows, upTo);
  addSummarySheet(wb, cohort, summary, filter, upTo, opts);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, rows: rows.length };
}

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longMonth = (ym: string) => `${MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** "Summary" sheet: where the month's sales went (plain tree), the new displays, and what the Report sheet's columns mean. */
export function addSummarySheet(wb: ExcelJS.Workbook, cohort: string, f: FunnelResult, filter: ReportFilter, upTo: string, opts: SalesOptions = {}) {
  const ws = wb.addWorksheet("Summary");
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 62;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 14;
  const money = "₹#,##,##0";
  const area = [...(filter.regions ?? []), ...(filter.regions?.length ? [] : (filter.zones ?? []))].join(", ") || "All regions";
  const extra = [filter.rmiNames?.length ? `RMI: ${filter.rmiNames.join(", ")}` : "", filter.dealerCodes?.length ? `Dealers: ${filter.dealerCodes.join(", ")}` : ""].filter(Boolean).join(" · ");
  const title = ws.addRow([`Display Tracker Report · ${longMonth(cohort)} · ${area}${extra ? ` · ${extra}` : ""}`]);
  title.font = { bold: true, size: 14 };
  ws.addRow([opts.includeExtra ? "Sales include ZTDN, ZNTI and ZDMS invoices." : "Sales: SAP tile invoices net of returns and credit notes (ZTDN, ZNTI, ZDMS not included), as in the Sales data MIS."]);
  ws.addRow([
    `Customers: ${opts.retailOnly ? "Retail (Key Accounts and export left out)" : "Total (retail, key accounts and export)"}. Project dealers: ${opts.withoutProjectDealers ? "left out (storage locations F-KA, S-KA)" : "included"}.`,
  ]);
  ws.addRow([]);
  const head = (text: string) => {
    const r = ws.addRow([text]);
    r.font = { bold: true, size: 12 };
  };
  const line = (n: string, label: string, v: number, share?: number) => {
    const r = ws.addRow([n, label, v, share ?? null]);
    r.getCell(3).numFmt = money;
    r.getCell(4).numFmt = "0.0%";
  };
  const of = (v: number, t: number) => (t ? v / t : undefined);
  head(`1. Where ${longMonth(cohort)}'s sales went ("on display" = the RMI recorded that tile at that dealer this month or earlier)`);
  ws.addRow(["", "Sales", "Amount", "% of all sales"]).font = { bold: true };
  line("", "All sales (every tile sold in this area this month)", f.total, f.total ? 1 : undefined);
  line("", "   ├ Dealers without a display", f.total - f.displayDealers, of(f.total - f.displayDealers, f.total));
  line("", "   └ Dealers with a display", f.displayDealers, of(f.displayDealers, f.total));
  line("", "         ├ …other tiles (not on display at their shop)", f.displayDealers - f.displayedDesigns, of(f.displayDealers - f.displayedDesigns, f.total));
  line("", "         └ …tiles on display at their shop", f.displayedDesigns, of(f.displayedDesigns, f.total));
  line("", "               └ of which: tiles put on display this month (= the Report sheet's " + monthLabel(cohort) + " column)", f.monthDesigns, of(f.monthDesigns, f.total));
  ws.addRow([]);
  head(`2. New this month: ${f.monthDisplays} display${f.monthDisplays === 1 ? "" : "s"} put up at ${f.monthDealerCount} dealer${f.monthDealerCount === 1 ? "" : "s"} (the Report sheet)`);
  line("", "Bought of the newly displayed tiles this month (= the Report sheet's " + monthLabel(cohort) + " Sales Value column)", f.monthDesigns);
  line("", "Everything those dealers bought this month", f.monthDealers);
  ws.addRow([]);
  head("3. The month columns in the Report sheet");
  const vis = visibleMonths(cohort, upTo);
  const notes = [
    `Every display is followed for 14 months: ${monthLabel(addMonths(cohort, -1))} (the month before it was put up), ${monthLabel(cohort)} (the display month) and the 12 months after (to ${monthLabel(addMonths(cohort, 12))}).`,
    `Only months that have started are shown (${vis.map(monthLabel).join(", ")}); later months are added automatically as time passes.`,
    "Each column is that dealer's purchases of that displayed tile in that month (all the dealer's SAP accounts, and the tile's packaging variants).",
    "Avg Sales Value = the sum of all 14 months ÷ 14 (RMI's rule), with months not yet reached counted as 0.",
    "Sales in other places and by other dealers are in part 1; displays put up in other months are in that month's Display Tracker Report.",
  ];
  for (const n of notes) {
    const r = ws.addRow(["", n]);
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }
  ws.addRow([]);
  head("4. By region");
  const h = ws.addRow([
    "",
    "Zone · Region",
    "All sales",
    "Tiles on display, % of all",
    "Dealers with a display",
    "…other tiles",
    "…tiles on display",
    "Dealers without a display",
    "New displays",
    "Bought of the new tiles",
  ]);
  h.font = { bold: true };
  for (const x of f.byRegion) {
    const r = ws.addRow([
      "",
      `${x.zone} · ${x.region}`,
      x.total,
      x.total ? x.displayedDesigns / x.total : null,
      x.displayDealers,
      x.displayDealers - x.displayedDesigns,
      x.displayedDesigns,
      x.total - x.displayDealers,
      x.monthDisplays,
      x.monthDesigns,
    ]);
    for (const c of [3, 5, 6, 7, 8, 10]) r.getCell(c).numFmt = money;
    r.getCell(4).numFmt = "0.0%";
  }
  for (const c of [5, 6, 7, 8, 9, 10]) ws.getColumn(c).width = 18;

  ws.addRow([]);
  head("5. Which tiles dealers with a display bought (top 25 each; “not on display” = not at the dealer who bought it)");
  for (const [title, tiles] of [
    ["Other tiles (not on display at the buying dealer's shop)", f.tilesNotOnDisplay],
    ["Tiles on display at the buying dealer's shop", f.tilesOnDisplay],
  ] as const) {
    ws.addRow(["", title, "Sales", "Dealers"]).font = { bold: true };
    for (const x of tiles) {
      const r = ws.addRow(["", `${x.design}${x.size ? ` (${x.size})` : ""}`, x.value, x.dealers]);
      r.getCell(3).numFmt = money;
    }
    ws.addRow([]);
  }
}
