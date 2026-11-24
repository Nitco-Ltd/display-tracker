// Excel export of the current dashboard filter (Displays page and Zero-sales list).
// One display month selected -> exact report layout; several -> months relative to each display (M-1 … M+12).
import type { NextRequest } from "next/server";
import { loadRows, type SearchParams } from "@/analytics/data";
import { currentMonth, zeroSales } from "@/analytics/metrics";
import { buildWorkbook } from "@/report/excel";

export async function GET(req: NextRequest) {
  const sp: SearchParams = {};
  for (const k of new Set(req.nextUrl.searchParams.keys())) sp[k] = req.nextUrl.searchParams.getAll(k);
  let rows = await loadRows(sp);
  const zero = Number(req.nextUrl.searchParams.get("zero"));
  if (zero) rows = zeroSales(rows, zero, currentMonth());
  const months = [...new Set(rows.map((r) => r.cohortMonth).filter(Boolean))] as string[];
  const cohort = months.length === 1 ? months[0] : null;
  const buf = await buildWorkbook(cohort, rows).xlsx.writeBuffer();
  const name = `Display_Tracker_${zero ? `No_Sales_${zero}m_` : ""}Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
