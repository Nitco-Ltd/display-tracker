import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
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
      <PageHeader
        title="Follow-up: displays with no purchase yet"
        description="Displays where the dealer hasn't bought the displayed tile in the months after it was put up. Use this list to follow up with RMIs and dealers."
      />
      <Suspense>
        <FilterBar options={options} />
      </Suspense>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-[13px] text-ink-2">No purchase within</span>
        <Suspense>
          <ParamLinks param="n" fallback="3" options={CHOICES.map((c) => ({ value: String(c), label: `${c} month${c > 1 ? "s" : ""}` }))} />
        </Suspense>
        <span className="text-[13px] text-ink-2">after the display month</span>
      </div>
      <Section
        title={`${num(list.length)} displays with no purchase in the ${n} month${n > 1 ? "s" : ""} after display`}
        note={`Only displays old enough to have had ${n} full month${n > 1 ? "s" : ""} after the display month, and whose tile is matched to SAP. Displays with a blank or unknown design aren't listed.`}
        action={
          <a href={`/api/export?${qs.toString()}`} className="btn btn-primary">
            Export to Excel
          </a>
        }
      >
        <DisplayTable rows={list.slice(0, 100)} />
        {list.length > 100 && <div className="text-[12px] text-ink-3 mt-2">Showing the first 100. Export to Excel for all {num(list.length)}.</div>}
      </Section>
    </>
  );
}
