import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { BarChart } from "@/components/BarChart";
import { LineChart } from "@/components/LineChart";
import { Section } from "@/components/Kpi";
import { Insight, PageHeader } from "@/components/PageHeader";
import { Tabs } from "@/components/Tabs";
import { Tree } from "@/components/Tree";
import { filterOptions, loadRows, type SearchParams } from "@/analytics/data";
import { ALL_OFFSETS, beforeAfter, currentMonth, isConverted, isLinked, isMeasurable, kpis, monthlyTrend, offsetLabel, uniquePairs } from "@/analytics/metrics";
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

  // What happened to the displays (each dealer + tile + display month counted once).
  const pairs = uniquePairs(rows);
  const linked = pairs.filter(isLinked);
  const judged = linked.filter((r) => isMeasurable(r, cur));
  const bought = judged.filter((r) => isConverted(r, cur));
  const of = (a: number, b: number) => (b ? a / b : NaN);

  // Takeaway: the month before display vs. the average of the three months after.
  const before = ba.find((p) => p.offset === -1)?.avgValue ?? NaN;
  const after3 = ba.filter((p) => p.offset >= 1 && p.offset <= 3 && Number.isFinite(p.avgValue));
  const afterAvg = after3.length ? after3.reduce((a, p) => a + p.avgValue, 0) / after3.length : NaN;
  const change = Number.isFinite(before) && before > 0 && Number.isFinite(afterAvg) ? afterAvg / before - 1 : NaN;
  const direction = !Number.isFinite(change) ? null : change > 0.05 ? "rose" : change < -0.05 ? "fell" : "stayed about the same";
  const nearlyNothing = Number.isFinite(afterAvg) && Number.isFinite(before) && before > 0 && afterAvg <= before * 0.05;
  const inProgress = rows.some((r) => r.cohortMonth && r.cohortMonth >= addMonths(cur, -3) && r.cohortMonth < cur);

  return (
    <>
      <PageHeader
        title="Do displays lead to sales?"
        description="Every display an RMI recorded, and whether that same dealer then bought that same tile (SAP invoices). Filter by the month the display was put up, the area, and the RMI."
      />
      <Suspense>
        <FilterBar options={options} />
      </Suspense>

      <Insight>
        Of <b>{num(judged.length)}</b> displays old enough to judge, the dealer bought the displayed tile afterwards in <b>{num(bought.length)}</b> (
        <b>{pct(of(bought.length, judged.length))}</b>), worth <b>{inrCompact(k.afterValue)}</b>.{" "}
        {direction &&
          (nearlyNothing ? (
            <>
              Per display, dealers bought {inr(before)} of the tile in the month before display and almost nothing in the three months after.
            </>
          ) : (
            <>
              Per display, dealers bought {inr(before)} of the tile in the month before display and {inr(afterAvg)} a month in the three months after: sales{" "}
              <b>{direction}</b>
              {direction !== "stayed about the same" ? ` (${change > 0 ? "+" : ""}${pct(change)})` : ""}.
            </>
          ))}
        {inProgress ? ` ${monthName(cur)} is still in progress.` : ""}
      </Insight>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="What happened to the displays" note="Each line is part of the line above it. A dealer + tile + month recorded more than once counts once.">
          <Tree
            valueHeader="Displays"
            shareHeader="% of line above"
            lines={[
              {
                level: 0,
                bold: true,
                label: "Displays recorded",
                help: `${num(rows.length)} entries in the RMI app${rows.length !== pairs.length ? `, ${num(rows.length - pairs.length)} of them repeats` : ""}.`,
                value: num(pairs.length),
                share: 1,
              },
              {
                level: 1,
                label: "Tile can't be matched to SAP",
                help: "Design blank or unknown in the RMI app, so its sales can't be looked up.",
                value: num(pairs.length - linked.length),
                share: of(pairs.length - linked.length, pairs.length),
                color: "var(--series-3)",
              },
              { level: 1, last: true, bold: true, label: "Tile matched to SAP", value: num(linked.length), share: of(linked.length, pairs.length) },
              {
                level: 2,
                label: "Too new to judge",
                help: "Put up this month: no month after the display yet.",
                value: num(linked.length - judged.length),
                share: of(linked.length - judged.length, linked.length),
                color: "var(--series-3)",
              },
              { level: 2, last: true, bold: true, label: "Old enough to judge", value: num(judged.length), share: of(judged.length, linked.length) },
              {
                level: 3,
                label: "Dealer hasn't bought the tile since",
                value: num(judged.length - bought.length),
                share: of(judged.length - bought.length, judged.length),
                color: "var(--series-2)",
              },
              {
                level: 3,
                last: true,
                bold: true,
                label: "Dealer bought the tile afterwards",
                help: "Any purchase of that tile by that dealer in a month after the display month.",
                value: num(bought.length),
                note: `${inrCompact(k.afterValue)} of sales`,
                share: of(bought.length, judged.length),
                color: "var(--series-1)",
              },
            ]}
          />
        </Section>

        <Section
          title="Did dealers buy more after the display?"
          note={`Average purchase of the displayed tile per display, by the same dealer, from the month before display to 12 months after. Dashed line = the month before. Hollow points: fewer than ${MIN_N} displays.`}
        >
          <LineChart
            ariaLabel="Average sales per display by month relative to the display month"
            format="inr"
            xTitle="Months since the display was put up"
            baselineIndex={0}
            height={300}
            points={ba.map((p) => ({
              key: String(p.offset),
              label: offsetLabel(p.offset),
              value: p.avgValue,
              faint: p.pairs < MIN_N,
              tooltip: [
                offsetLabel(p.offset, true),
                `Average ${inr(p.avgValue)} · ${m2(p.avgVolume)}`,
                `${pct(p.withSales)} of displays had a purchase`,
                `Based on ${num(p.pairs)} displays`,
              ],
            }))}
          />
        </Section>
      </div>

      <Section title="By the month the display was put up" note="Recent months have had less time to sell; the current month is lighter.">
        <Tabs
          small
          tabs={[
            { id: "count", label: "Displays put up", hint: "Number of displays recorded in the RMI app." },
            { id: "sales", label: "Sales afterwards", hint: "Sales of the displayed tiles in the months after display, so far." },
            { id: "rate", label: "% bought afterwards", hint: "Share of displays where the dealer bought the tile in a later month." },
          ]}
        >
          <BarChart
            ariaLabel="Displays recorded per month"
            format="num"
            height={200}
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
            height={200}
            bars={trend.map((t) => ({
              key: t.month,
              label: short(t.month),
              value: t.afterValue,
              muted: t.month === cur,
              tooltip: [monthName(t.month), `Sales afterwards ${inr(t.afterValue)}`, `${num(t.displays)} displays`],
            }))}
          />
          <BarChart
            ariaLabel="Share of displays followed by a purchase, by display month"
            format="pct"
            height={200}
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

      <details className="card px-4 py-3 text-[13px]">
        <summary className="cursor-pointer font-medium">How these numbers are calculated</summary>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-ink-2">
          <li>
            <b>Display:</b> a row in the RMI app (dealer, tile, date). <b>Sales:</b> SAP invoices for that dealer and that tile: invoices count, returns and credit notes
            (ZCBR, ZCPD) are subtracted; value is before GST. ZTDN, ZNTI and ZDMS count only with the “+ ZTDN, ZNTI, ZDMS” switch.
          </li>
          <li>A dealer&apos;s other SAP accounts with the same GST number and PIN code count as the same dealer; a tile&apos;s packaging variants count as the same tile.</li>
          <li>“Afterwards” = any month after the display month, up to 12 months, as far as data exists.</li>
        </ul>
      </details>
    </>
  );
}
