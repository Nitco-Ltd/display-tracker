import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { ParamLinks } from "@/components/SortLinks";
import { DisplayTable } from "@/components/DisplayTable";
import { Icon } from "@/components/Icon";
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
        eyebrow="Follow-up"
        title={`${num(list.length)} display${list.length === 1 ? "" : "s"} with no purchase yet`}
        description={`The dealer hasn't bought the tile in the ${n} month${n > 1 ? "s" : ""} after display. A good list for the next visit.`}
      />
      <Suspense>
        <FilterBar options={options} />
      </Suspense>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5">
        <span className="text-[13.5px] text-ink-2">No purchase within</span>
        <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
          <Suspense>
            <ParamLinks param="n" fallback="3" options={CHOICES.map((c) => ({ value: String(c), label: `${c} month${c > 1 ? "s" : ""}` }))} />
        </Suspense>
        </div>
        <span className="text-[13.5px] text-ink-2">of display</span>
      </div>
      <Section
        title="Displays to follow up"
        note={`Only displays up for ${n} full month${n > 1 ? "s" : ""} or more, with a tile found in SAP.`}
        action={
          <a href={`/api/export?${qs.toString()}`} className="btn btn-primary">
            <Icon name="download" size={16} />
            Excel
          </a>
        }
      >
        <DisplayTable rows={list.slice(0, 100)} status={false} />
        {list.length > 100 && <div className="text-[12.5px] text-ink-3 mt-3">Showing 100 of {num(list.length)}. The Excel file has them all.</div>}
      </Section>
    </>
  );
}
