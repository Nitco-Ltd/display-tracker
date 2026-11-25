import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { BarChart } from "@/components/BarChart";
import { Kpi, Section } from "@/components/Kpi";
import { filterOptions, loadRows, type SearchParams } from "@/analytics/data";
import { beforeAfter, currentMonth, kpis, monthlyTrend } from "@/analytics/metrics";
import { inr, inrCompact, m2, monthName, num, pct } from "@/lib/format";

export default async function Overview({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [rows, options] = await Promise.all([loadRows(sp), filterOptions()]);
  const cur = currentMonth();
  const k = kpis(rows, cur);
  const ba = beforeAfter(rows, cur);
  const trend = monthlyTrend(rows, cur);
  const short = (ym: string) => monthName(ym).replace(/ 20(\d\d)$/, "-$1");

  return (
    <>
      <Suspense>
        <FilterBar options={options} />
      </Suspense>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 mb-5">
        <Kpi label="Displays" value={num(k.displays)} sub={`${num(k.unlinked)} without a linked design`} />
        <Kpi label="Dealers covered" value={num(k.dealers)} />
        <Kpi label="Displays that led to sales" value={pct(k.conversion)} sub={`${num(k.convertedPairs)} of ${num(k.measurablePairs)} display pairs`} />
        <Kpi label="Sales after display" value={inrCompact(k.afterValue)} sub={m2(k.afterVolume)} />
        <Kpi label="Avg sales per display" value={inrCompact(k.avgValuePerPair)} sub={`${m2(k.avgVolumePerPair)} · M+1 to M+12 so far`} />
        <Kpi label="Avg per display per month" value={inrCompact(k.avgMonthlyValuePerPair)} sub="over months elapsed" />
      </div>

      <Section
        title="Before vs after display: average sales per display pair"
        note={
          <>
            Same dealer and same design. M = display month, M−1 = the month before, M+3 = three months after. Each bar averages only
            display pairs for which that month has started, so later bars cover fewer, older displays (n shown below).
          </>
        }
      >
        <BarChart
          ariaLabel="Average sales value per display pair by month relative to display"
          format="inr"
          bars={ba.map((p) => ({
            key: p.label,
            label: p.label,
            value: p.avgValue,
            tooltip: [p.label, `Avg value ${inr(p.avgValue)}`, `Avg volume ${m2(p.avgVolume)}`, `${pct(p.withSales)} with sales`, `n = ${num(p.pairs)} pairs`],
          }))}
        />
        <table className="data mt-3">
          <thead>
            <tr>
              <th>Month</th>
              {ba.map((p) => (
                <th key={p.label} className="num">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Avg value</td>
              {ba.map((p) => (
                <td key={p.label} className="num">
                  {Number.isFinite(p.avgValue) ? inr(p.avgValue) : "–"}
                </td>
              ))}
            </tr>
            <tr>
              <td>Avg volume</td>
              {ba.map((p) => (
                <td key={p.label} className="num">
                  {Number.isFinite(p.avgVolume) ? m2(p.avgVolume) : "–"}
                </td>
              ))}
            </tr>
            <tr>
              <td>Pairs with sales</td>
              {ba.map((p) => (
                <td key={p.label} className="num">
                  {pct(p.withSales)}
                </td>
              ))}
            </tr>
            <tr>
              <td>Display pairs (n)</td>
              {ba.map((p) => (
                <td key={p.label} className="num">
                  {num(p.pairs)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Displays made per month" note="Number of displays logged in RMI, by display month.">
          <BarChart
            ariaLabel="Displays per month"
            format="num"
            bars={trend.map((t) => ({
              key: t.month,
              label: short(t.month),
              value: t.displays,
              muted: t.month === cur,
              tooltip: [monthName(t.month), `${num(t.displays)} displays`, t.month === cur ? "Month in progress" : ""].filter(Boolean),
            }))}
          />
        </Section>
        <Section title="Sales that followed, by display month" note="After-display sales (M+1 onwards, so far) of each month's displays. Recent months have had less time to sell.">
          <BarChart
            ariaLabel="After-display sales by display month"
            format="inr"
            bars={trend.map((t) => ({
              key: t.month,
              label: short(t.month),
              value: t.afterValue,
              muted: t.month === cur,
              tooltip: [monthName(t.month), `Sales after display ${inr(t.afterValue)}`, `Led to sales: ${pct(t.conversion)} of ${num(t.measurablePairs)} pairs`],
            }))}
          />
        </Section>
      </div>

      <details className="card p-4 mb-5 text-[13px]">
        <summary className="cursor-pointer font-medium">How these numbers are calculated</summary>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-ink-2">
          <li>Sales come from SAP invoices (sales org 1801): ZVDT invoices count, ZRTI returns are subtracted, ZCBR/ZCPD/ZCQC credit notes reduce value only. Value is net of GST; volume is in m².</li>
          <li>A display gets sales only for its own dealer and the SAP material its design is linked to. {num(k.unlinked)} of these displays have no linked design yet (blank design in RMI, or no matching SAP product).</li>
          <li>&quot;Display pair&quot; = same dealer + same design + same display month. Two panels of one design count once in rates and averages.</li>
          <li>Totals never count the same dealer × design × month of sales twice, even if it falls after several displays. {num(k.duplicateRows)} duplicate rows were merged here.</li>
          <li>&quot;Led to sales&quot; = any sales from M+1 onwards (months so far). Displays from the current month, and unlinked displays, are left out of rates.</li>
        </ul>
      </details>
    </>
  );
}
