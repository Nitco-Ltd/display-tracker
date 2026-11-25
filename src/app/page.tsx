import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { BarChart } from "@/components/BarChart";
import { LineChart } from "@/components/LineChart";
import { Kpi, Section } from "@/components/Kpi";
import { Insight, PageHeader } from "@/components/PageHeader";
import { Tabs } from "@/components/Tabs";
import { filterOptions, loadRows, type SearchParams } from "@/analytics/data";
import { ALL_OFFSETS, beforeAfter, currentMonth, kpis, monthlyTrend, offsetLabel } from "@/analytics/metrics";
import { addMonths } from "@/sales/window";
import { inr, inrCompact, m2, monthName, num, pct } from "@/lib/format";

const MIN_N = 200; // fewer displays than this in a month-after point: drawn hollow (less reliable)

export default async function Overview({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [rows, options] = await Promise.all([loadRows(sp), filterOptions()]);
  const cur = currentMonth();
  const k = kpis(rows, cur);
  const ba = beforeAfter(rows, cur, ALL_OFFSETS);
  const trend = monthlyTrend(rows, cur);
  const short = (ym: string) => monthName(ym).replace(/ 20(\d\d)$/, " ’$1");

  // Takeaway: the month before display vs. the average of the three months after.
  const before = ba.find((p) => p.offset === -1)?.avgValue ?? NaN;
  const after3 = ba.filter((p) => p.offset >= 1 && p.offset <= 3 && Number.isFinite(p.avgValue));
  const afterAvg = after3.length ? after3.reduce((a, p) => a + p.avgValue, 0) / after3.length : NaN;
  const change = Number.isFinite(before) && before > 0 && Number.isFinite(afterAvg) ? afterAvg / before - 1 : NaN;
  const direction = !Number.isFinite(change) ? null : change > 0.05 ? "rose" : change < -0.05 ? "fell" : "stayed about the same";
  const nearlyNothing = Number.isFinite(afterAvg) && Number.isFinite(before) && before > 0 && afterAvg <= before * 0.05;
  const inProgress = after3.some((p) => p.offset >= 1) && rows.some((r) => r.cohortMonth && r.cohortMonth >= addMonths(cur, -3) && r.cohortMonth < cur);

  return (
    <>
      <PageHeader
        title="Do displays lead to sales?"
        description="Every display an RMI recorded, and what that same dealer then bought of that same tile, from SAP invoices. Filter by when the display was put up, where, and by whom."
      />
      <Suspense>
        <FilterBar options={options} />
      </Suspense>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
        <Kpi label="Displays recorded" value={num(k.displays)} sub={`at ${num(k.dealers)} dealers · ${num(k.unlinked)} can't be matched to a SAP tile`} />
        <Kpi
          label="Dealer bought the tile afterwards"
          value={pct(k.conversion)}
          sub={`${num(k.convertedPairs)} of ${num(k.measurablePairs)} displays, any month after the display month`}
        />
        <Kpi label="Sales of displayed tiles, after display" value={inrCompact(k.afterValue)} sub={`${m2(k.afterVolume)} · same dealer, months after display`} />
        <Kpi label="Average per display" value={inrCompact(k.avgValuePerPair)} sub={`${inrCompact(k.avgMonthlyValuePerPair)} per display per month`} />
      </div>

      {direction && (
        <Insight>
          A dealer bought <b>{inr(before)}</b> of a displayed tile in the month before it went on display
          {nearlyNothing ? (
            <>
              , and <b>almost nothing</b> in the three months after ({inr(afterAvg)} a month on average, returns and credit notes included).
            </>
          ) : (
            <>
              , and <b>{inr(afterAvg)}</b> a month on average in the three months after: sales <b>{direction}</b>
              {direction !== "stayed about the same" ? ` (${change > 0 ? "+" : ""}${pct(change)})` : ""}.
            </>
          )}{" "}
          Averages per display, same dealer and same tile.
          {inProgress ? ` ${monthName(cur)} is still in progress, so its numbers will grow.` : ""}
        </Insight>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Section
            title="Sales of the displayed tile, month by month"
            note={`Average sales per display, same dealer and same tile, from the month before display to 12 months after. The dashed line is the month-before level. Later months cover only older displays; hollow points have fewer than ${MIN_N} displays.`}
          >
            <LineChart
              ariaLabel="Average sales per display by month relative to the display month"
              format="inr"
              xTitle="Months since the display was put up"
              baselineIndex={0}
              height={260}
              points={ba.map((p) => ({
                key: String(p.offset),
                label: offsetLabel(p.offset),
                value: p.avgValue,
                faint: p.pairs < MIN_N,
                tooltip: [
                  offsetLabel(p.offset, true),
                  `Average sales ${inr(p.avgValue)} · ${m2(p.avgVolume)}`,
                  `${pct(p.withSales)} of displays had a purchase`,
                  `Based on ${num(p.pairs)} displays`,
                ],
              }))}
            />
          </Section>
        </div>
        <div className="lg:col-span-2">
          <Section title="By the month the display was put up" note="Recent months have had less time to sell; the current month is lighter.">
            <Tabs
              small
              tabs={[
                { id: "count", label: "Displays", hint: "Number of displays recorded in RMI." },
                { id: "sales", label: "Sales after", hint: "Sales of the displayed tiles in the months after display, so far." },
                { id: "rate", label: "Bought afterwards", hint: "Share of displays where the dealer bought the tile in a later month." },
              ]}
            >
              <BarChart
                ariaLabel="Displays recorded per month"
                format="num"
                height={220}
                bars={trend.map((t) => ({
                  key: t.month,
                  label: short(t.month),
                  value: t.displays,
                  muted: t.month === cur,
                  tooltip: [monthName(t.month), `${num(t.displays)} displays`, t.month === cur ? "Month in progress" : ""].filter(Boolean),
                }))}
              />
              <BarChart
                ariaLabel="Sales after display by display month"
                format="inr"
                height={220}
                bars={trend.map((t) => ({
                  key: t.month,
                  label: short(t.month),
                  value: t.afterValue,
                  muted: t.month === cur,
                  tooltip: [monthName(t.month), `Sales after display ${inr(t.afterValue)}`, `${num(t.displays)} displays`],
                }))}
              />
              <BarChart
                ariaLabel="Share of displays followed by a purchase, by display month"
                format="pct"
                height={220}
                bars={trend
                  .filter((t) => t.measurablePairs > 0)
                  .map((t) => ({
                    key: t.month,
                    label: short(t.month),
                    value: t.conversion,
                    tooltip: [monthName(t.month), `${pct(t.conversion)} bought afterwards`, `of ${num(t.measurablePairs)} displays`],
                  }))}
              />
            </Tabs>
          </Section>
        </div>
      </div>

      <details className="card px-4 py-3 text-[13px]">
        <summary className="cursor-pointer font-medium">How these numbers are calculated</summary>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-ink-2">
          <li>
            <b>Display:</b> a row in the RMI app (dealer, tile, date). <b>Sales:</b> SAP invoices for that dealer and that tile: invoices count, returns and credit notes
            (ZCBR, ZCPD) are subtracted; value is before GST.
          </li>
          <li>
            A dealer&apos;s other SAP accounts with the same GST number and PIN code count as the same dealer; a tile&apos;s packaging variants count as the same tile.
          </li>
          <li>
            <b>Bought afterwards</b> = any purchase of that tile by that dealer in a month after the display month. Displays put up this month, and the {num(k.unlinked)}{" "}
            displays that can&apos;t be matched to a SAP tile (blank or unknown design), are left out of the rates.
          </li>
          <li>The same dealer + tile + display month is counted once, even when several panels were recorded ({num(k.duplicateRows)} such rows here).</li>
        </ul>
      </details>
    </>
  );
}
