import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { ParamLinks } from "@/components/SortLinks";
import { filterOptions, loadRows, type SearchParams } from "@/analytics/data";
import { currentMonth, groupStats, type GroupStat } from "@/analytics/metrics";
import type { DisplayWithSales } from "@/sales/window";
import { inr, m2, num, pct } from "@/lib/format";

const MIN_PAIRS = 10; // conversion ranking ignores groups with fewer measurable display pairs

const BOARDS: { title: string; key: (r: DisplayWithSales) => string | null; label?: (r: DisplayWithSales) => string | null }[] = [
  { title: "Zones", key: (r) => r.zone },
  { title: "RMIs", key: (r) => r.rmiName },
  { title: "Dealers", key: (r) => r.dealerCode, label: (r) => r.dealerName },
  { title: "Designs", key: (r) => (r.designName ? `${r.designName}|${r.sizeMmNorm ?? ""}` : null), label: (r) => (r.designName ? `${r.designName} · ${r.sizeMm ?? ""}` : null) },
];

function Board({ title, stats, sort, limit }: { title: string; stats: GroupStat[]; sort: string; limit: number }) {
  const ranked =
    sort === "conversion"
      ? stats.filter((s) => s.measurablePairs >= MIN_PAIRS && s.key !== "(blank)").sort((a, b) => b.conversion - a.conversion || b.afterValue - a.afterValue)
      : stats.filter((s) => s.key !== "(blank)").sort((a, b) => b.afterValue - a.afterValue);
  const top = ranked.slice(0, limit);
  const maxV = Math.max(1, ...top.map((s) => (sort === "conversion" ? s.conversion : s.afterValue)));
  return (
    <Section title={title} note={`${num(ranked.length)} ranked${sort === "conversion" ? ` (at least ${MIN_PAIRS} measurable display pairs)` : ""}. Showing top ${top.length}.`}>
      <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>{title.replace(/s$/, "")}</th>
              <th className="num">Displays</th>
              <th className="num">Led to sales</th>
              <th className="num">Conversion</th>
              <th className="num">Sales after display</th>
              <th className="num">Volume</th>
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {top.map((s, i) => {
              const v = sort === "conversion" ? s.conversion : s.afterValue;
              return (
                <tr key={s.key}>
                  <td className="num text-ink-3">{i + 1}</td>
                  <td className="max-w-[320px] truncate" title={s.label}>
                    {s.label}
                  </td>
                  <td className="num">{num(s.displays)}</td>
                  <td className="num">
                    {num(s.convertedPairs)} / {num(s.measurablePairs)}
                  </td>
                  <td className="num">{pct(s.conversion)}</td>
                  <td className="num">{inr(s.afterValue)}</td>
                  <td className="num">{m2(s.afterVolume)}</td>
                  <td>
                    <div className="h-2 rounded-full bg-surface-0">
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(0, (v / maxV) * 100)}%`, background: "var(--series-1)" }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!top.length && (
              <tr>
                <td colSpan={8} className="text-ink-3">
                  Nothing to rank with the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export default async function Leaderboards({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [rows, options] = await Promise.all([loadRows(sp), filterOptions()]);
  const cur = currentMonth();
  const sort = sp.sort === "conversion" ? "conversion" : "sales";
  const limit = sp.all ? 1000 : 15;
  return (
    <>
      <Suspense>
        <FilterBar options={options} />
      </Suspense>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-[13px] text-ink-2">Rank by</span>
        <Suspense>
          <ParamLinks
            param="sort"
            fallback="sales"
            options={[
              { value: "sales", label: "Sales after display" },
              { value: "conversion", label: "Conversion rate" },
            ]}
          />
        </Suspense>
        <span className="text-[12px] text-ink-3">
          Conversion = display pairs with any sales from M+1 onwards ÷ measurable display pairs. Each dealer × design × month of sales counts once within a row.
        </span>
      </div>
      <div>
        {BOARDS.map((b) => (
          <Board key={b.title} title={b.title} sort={sort} limit={limit} stats={groupStats(rows, b.key, b.label, cur)} />
        ))}
      </div>
    </>
  );
}
