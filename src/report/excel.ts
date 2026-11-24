// Builds the "Display Tracker Report" workbook in the exact column layout of the reference sample:
// one sheet "Report" holding one Excel table "Report", columns A–AY, one row per display, in RMI record order.
// Differences from RMI's file, by design: real numbers and dates (not text), frozen header, widths, number formats.
import ExcelJS from "exceljs";
import { displaysWithSales, monthLabel, MONTH_ABBR, WINDOW_MONTHS, windowMonths, type DisplayWithSales } from "@/sales/window";
import { filterWhere, type ReportFilter } from "./filters";

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
export function reportHeaders(cohort: string | null): string[] {
  const labels = cohort
    ? windowMonths(cohort).map(monthLabel)
    : Array.from({ length: WINDOW_MONTHS }, (_, i) => (i === 1 ? "M" : i === 0 ? "M-1" : `M+${i - 1}`));
  const sales = labels.flatMap((l) => [`${l} Sales Volume`, `${l} Sales Value`]);
  return [...DISPLAY_COLUMNS.map((c) => c.header), ...sales, "Avg Sales Volume", "Avg Sales Value"];
}

/** "2026-08" -> "Display_Tracker_Report_-_Aug-2026.xlsx" */
export function reportFileName(cohort: string): string {
  const [y, m] = cohort.split("-").map(Number);
  return `Display_Tracker_Report_-_${MONTH_ABBR[m - 1]}-${y}.xlsx`;
}

export function buildWorkbook(cohort: string | null, rows: DisplayWithSales[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Display Tracker";
  wb.created = new Date();
  const ws = wb.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = reportHeaders(cohort);
  const nDisplay = DISPLAY_COLUMNS.length;

  const data = rows.map((r) => [
    ...DISPLAY_COLUMNS.map((c) => c.value(r) ?? null),
    ...r.sales.flatMap((s) => [s.volume, s.value]),
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
  return wb;
}

/** Rows for a cohort month (plus optional extra filters), in RMI record order. */
export async function reportRows(cohort: string, filter: ReportFilter = {}): Promise<DisplayWithSales[]> {
  return displaysWithSales(filterWhere({ ...filter, cohortMonths: [cohort] }));
}

export async function buildReportBuffer(cohort: string, filter: ReportFilter = {}): Promise<{ buffer: Buffer; rows: number }> {
  const rows = await reportRows(cohort, filter);
  const buffer = Buffer.from(await buildWorkbook(cohort, rows).xlsx.writeBuffer());
  return { buffer, rows: rows.length };
}
