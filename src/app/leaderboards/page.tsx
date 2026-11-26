import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { ParamLinks } from "@/components/SortLinks";
import { Tabs } from "@/components/Tabs";
import { filterOptions, loadRows, type SearchParams } from "@/analytics/data";
import { currentMonth, groupStats, type GroupStat } from "@/analytics/metrics";
import type { DisplayWithSales } from "@/sales/window";
import { inrCompact, num, pct } from "@/lib/format";

const MIN_PAIRS = 10; // the "bought afterwards" ranking ignores groups with fewer measurable displays
const TOP = 25;

const BOARDS: { id: string; title: string; one: string; key: (r: DisplayWithSales) => string | null; label?: (r: DisplayWithSales) => string | null }[] = [
  { id: "zones", title: "Zones", one: "Zone", key: (r) => r.zone },
  { id: "rmis", title: "RMIs", one: "RMI", key: (r) => r.rmiName },
  { id: "dealers", title: "Dealers", one: "Dealer", key: (r) => r.dealerCode, label: (r) => r.dealerName },
  {
    id: "tiles",
    title: "Tiles",
    one: "Tile",
    key: (r) => (r.designName ? `${r.designName}|${r.sizeMmNorm ?? ""}` : null),
    label: (r) => (r.designName ? `${r.designName} · ${r.sizeMm ?? ""}` : null),
  },
];

function Ranking({ one, stats, sort }: { one: string; stats: GroupStat[]; sort: "sales" | "conversion" }) {
  const ranked =
    sort === "conversion"
      ? stats.filter((s) => s.measurablePairs >= MIN_PAIRS && s.key !== "(blank)").sort((a, b) => b.conversion - a.conversion || b.afterValue - a.afterValue)
      : stats.filter((s) => s.key !== "(blank)").sort((a, b) => b.afterValue - a.afterValue);
  const top = ranked.slice(0, TOP);
  const metric = (s: GroupStat) => (sort === "conversion" ? s.conversion : s.afterValue);
  const maxV = Math.max(1e-9, ...top.map(metric));
  return (
    <div>
      <div className="text-[12.5px] text-ink-3 mb-3">
        Top {top.length} of {num(ranked.length)}
        {sort === "conversion" ? ` · at least ${MIN_PAIRS} displays ready to check` : ""}
      </div>
      <div className="overflow-auto max-h-[600px]">
        <table className="data">
          <thead>
            <tr>
              <th className="num w-[44px]">#</th>
              <th>{one}</th>
              <th style={{ width: "34%" }}>{sort === "conversion" ? "Led to a purchase" : "Sales after display"}</th>
              <th className="num">{sort === "conversion" ? "Sales after display" : "Led to a purchase"}</th>
              <th className="num">Displays</th>
            </tr>
          </thead>
          <tbody>
            {top.map((s, i) => (
              <tr key={s.key}>
                <td className="num text-ink-3">{i + 1}</td>
                <td className="max-w-[320px] truncate font-medium" title={s.label}>
                  {s.label}
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden" aria-hidden>
                      <div
                        className="grow-x h-full rounded-full"
                        style={{ width: `${Math.max(0, (metric(s) / maxV) * 100)}%`, background: "var(--series-1)", animationDelay: `${Math.min(i * 25, 400)}ms` }}
                      />
                    </div>
                    <span className="w-[72px] text-right font-semibold">{sort === "conversion" ? pct(s.conversion) : inrCompact(s.afterValue)}</span>
                  </div>
                </td>
                <td className="num text-ink-2" title={`${num(s.convertedPairs)} of ${num(s.measurablePairs)} displays`}>
                  {sort === "conversion" ? inrCompact(s.afterValue) : pct(s.conversion)}
                </td>
                <td className="num text-ink-2">{num(s.displays)}</td>
              </tr>
            ))}
            {!top.length && (
              <tr>
                <td colSpan={5} className="text-ink-3">
                  Nothing to rank for this selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function Rankings({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [rows, options] = await Promise.all([loadRows(sp), filterOptions()]);
  const cur = currentMonth();
  const sort = sp.sort === "conversion" ? "conversion" : "sales";
  return (
    <>
      <PageHeader eyebrow="Rankings" title="Where displays work best" description="Zones, RMIs, dealers and tiles, ranked by what dealers bought after the display." />
      <Suspense>
        <FilterBar options={options} />
      </Suspense>
      <Section
        title={sort === "conversion" ? "Ranked by purchase rate" : "Ranked by sales after display"}
        action={
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-ink-3">Rank by</span>
            <Suspense>
              <ParamLinks
                param="sort"
                fallback="sales"
                options={[
                  { value: "sales", label: "Sales after display" },
                  { value: "conversion", label: "Purchase rate" },
                ]}
              />
            </Suspense>
          </div>
        }
      >
        <Tabs tabs={BOARDS.map((b) => ({ id: b.id, label: b.title }))}>
          {BOARDS.map((b) => (
            <Ranking key={b.id} one={b.one} sort={sort} stats={groupStats(rows, b.key, b.label, cur)} />
          ))}
        </Tabs>
      </Section>
    </>
  );
}
