import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { ParamLinks } from "@/components/SortLinks";
import { DisplayTable } from "@/components/DisplayTable";
import { filterOptions, loadRows, type SearchParams } from "@/analytics/data";
import { currentMonth, zeroSales } from "@/analytics/metrics";
import { num } from "@/lib/format";

const CHOICES = [1, 2, 3, 6, 12];

export default async function ZeroSales({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const n = CHOICES.includes(Number(sp.n)) ? Number(sp.n) : 3;
  const [rows, options] = await Promise.all([loadRows(sp), filterOptions()]);
  const list = zeroSales(rows, n, currentMonth());
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v ? [v] : []) if (k !== "page") qs.append(k, x);
  qs.set("zero", String(n));

  return (
    <>
      <Suspense>
        <FilterBar options={options} />
      </Suspense>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-[13px] text-ink-2">No sales within</span>
        <Suspense>
          <ParamLinks param="n" fallback="3" options={CHOICES.map((c) => ({ value: String(c), label: `${c} month${c > 1 ? "s" : ""}` }))} />
        </Suspense>
        <span className="text-[13px] text-ink-2">after the display month</span>
      </div>
      <Section
        title={`Follow-up list: ${num(list.length)} displays with no sales in M+1 … M+${n}`}
        note="Only displays whose design is linked to a SAP material and whose first N months after display have started. Displays without a linked design are not listed here (see Design review)."
        action={
          <a href={`/api/export?${qs.toString()}`} className="rounded-md px-3 py-1.5 text-[13px] font-medium bg-accent text-white">
            Export to Excel
          </a>
        }
      >
        <DisplayTable rows={list.slice(0, 500)} />
        {list.length > 500 && <div className="text-[12px] text-ink-3 mt-2">Showing the first 500. Export to Excel for all {num(list.length)}.</div>}
      </Section>
    </>
  );
}
