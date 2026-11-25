// Monthly report download with RMI-style filters. ?month=2026-08&zone=…&rmi=…&dealer=…&ptype=…&size=…&design=…
// &extra=1 -> the version that also counts ZTDN, ZNTI, ZDMS invoices.
import type { NextRequest } from "next/server";
import { parseFilter, type SearchParams } from "@/analytics/data";
import { getViewer, scopeFilter } from "@/auth/viewer";
import { ensureSchema } from "@/db/migrate";
import { buildReportBuffer, reportFileName } from "@/report/excel";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return Response.json({ error: "Please select display month & year." }, { status: 400 });
  await ensureSchema();
  const sp: SearchParams = {};
  for (const k of new Set(req.nextUrl.searchParams.keys())) if (k !== "month" && k !== "extra") sp[k] = req.nextUrl.searchParams.getAll(k);
  const filter = scopeFilter(await getViewer(), parseFilter(sp));
  const opts = { includeExtra: req.nextUrl.searchParams.get("extra") === "1" };
  const { buffer } = await buildReportBuffer(month, filter, undefined, opts);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportFileName(month, opts)}"`,
    },
  });
}
