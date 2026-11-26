import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { LineChart } from "@/components/LineChart";
import { GroupTitle, Section } from "@/components/Kpi";
import { Hero } from "@/components/Hero";
import { Funnel } from "@/components/Funnel";
import { StackedBarChart } from "@/components/StackedBarChart";
import { Icon } from "@/components/Icon";
import { filterOptions, loadRows, type SearchParams } from "@/analytics/data";
import { ALL_OFFSETS, beforeAfter, currentMonth, isConverted, isLinked, isMeasurable, kpis, offsetLabel, uniquePairs } from "@/analytics/metrics";
import { inr, inrCompact, m2, monthName, num, pct } from "@/lib/format";

const MIN_N = 200; // fewer displays than this in a month-after point: drawn hollow (less reliable)

export default async function Overview({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [rows, options] = await Promise.all([loadRows(sp), filterOptions()]);
  const cur = currentMonth();
  const k = kpis(rows, cur);
  const ba = beforeAfter(rows, cur, ALL_OFFSETS);
  const short = (ym: string) => monthName(ym).replace(/ 20(\d\d)$/, " ’$1");

  // Each dealer + tile + display month counted once.
  const pairs = uniquePairs(rows);
  const judged = pairs.filter((r) => isLinked(r) && isMeasurable(r, cur));
  const bought = judged.filter((r) => isConverted(r, cur));
  const unmatched = pairs.filter((r) => !isLinked(r)).length;
  const tooNew = pairs.length - unmatched - judged.length;
  const rate = judged.length ? bought.length / judged.length : NaN;
  const perDisplay = judged.length ? k.afterValue / judged.length : NaN;

  // Month before display vs. the average of the three months after.
  const before = ba.find((p) => p.offset === -1)?.avgValue ?? NaN;
  const after3 = ba.filter((p) => p.offset >= 1 && p.offset <= 3 && Number.isFinite(p.avgValue));
  const afterAvg = after3.length ? after3.reduce((a, p) => a + p.avgValue, 0) / after3.length : NaN;
  const change = Number.isFinite(before) && before > 0 && Number.isFinite(afterAvg) ? afterAvg / before - 1 : NaN;
  const hasBA = Number.isFinite(before) && Number.isFinite(afterAvg);
  const baMax = Math.max(1, before || 0, afterAvg || 0);

  // Displays by the month they were put up, split by what happened.
  const byMonth = new Map<string, { all: number; judged: number; bought: number }>();
  for (const r of pairs) {
    if (!r.cohortMonth || r.cohortMonth > cur) continue;
    const m = byMonth.get(r.cohortMonth) ?? { all: 0, judged: 0, bought: 0 };
    m.all++;
    if (isLinked(r) && isMeasurable(r, cur)) {
      m.judged++;
      if (isConverted(r, cur)) m.bought++;
    }
    byMonth.set(r.cohortMonth, m);
  }
  const sorted = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  // Skip the near-empty months at the start (a handful of early test entries), so the chart starts where displays did.
  const peak = Math.max(0, ...sorted.map(([, s]) => s.all));
  const firstReal = sorted.findIndex(([, s]) => s.all >= peak * 0.03);
  const months = sorted.slice(Math.max(0, firstReal));

  const where = [...(Array.isArray(sp.region) ? sp.region : sp.region ? [sp.region] : []), ...(Array.isArray(sp.zone) ? sp.zone : sp.zone ? [sp.zone] : [])].join(", ");

  return (
    <>
      <Suspense>
        <FilterBar options={options} />
      </Suspense>

      <Hero
        eyebrow={`Overview · ${where || "all zones"}`}
        title={Number.isFinite(rate) ? `${pct(rate).replace(".0%", "%")} of displays led to a purchase.` : "No displays to check for this selection yet."}
        share={judged.length ? rate : undefined}
        shareCaption="led to a purchase"
        stats={[
          { label: "Displays", value: num(pairs.length), sub: `at ${num(k.dealers)} dealer${k.dealers === 1 ? "" : "s"}` },
          { label: "Bought afterwards", value: num(bought.length), sub: `of ${num(judged.length)} ready to check` },
          { label: "Sales that followed", value: inrCompact(k.afterValue), sub: "same dealer, same tile" },
          { label: "Per display", value: inr(perDisplay), sub: "on average, after display" },
        ]}
      >
        {judged.length ? (
          <>
            Dealers went on to buy <b className="text-[var(--hero-text)] font-semibold">{inrCompact(k.afterValue)}</b> of the tiles they had on display.
            {Number.isFinite(change) && (
              <>
                {" "}
                Per display, they bought {pct(Math.abs(change))} {change >= 0 ? "more" : "less"} of the tile in the three months after than in the month before.
              </>
            )}
          </>
        ) : (
          "Every display an RMI recorded, and whether the dealer then bought that tile."
        )}
      </Hero>

      <GroupTitle title="What happened to the displays" note="Each dealer + tile + month counted once" />
      <div className="grid gap-x-5 lg:grid-cols-5">
        <Section className="lg:col-span-3" title="From display to purchase" note="Each bar is part of the one above it.">
          <Funnel
            max={pairs.length}
            steps={[
              { label: "Displays recorded", value: pairs.length, display: num(pairs.length), color: "var(--neutral-mark)" },
              {
                label: "Ready to check",
                hint: "tile found in SAP, up for a month or more",
                value: judged.length,
                display: num(judged.length),
                share: pct(judged.length / (pairs.length || 1)),
                color: "var(--series-1-soft)",
              },
              { label: "Dealer bought the tile", value: bought.length, display: num(bought.length), share: pct(rate), color: "var(--series-1)" },
            ]}
          />
          {(unmatched > 0 || tooNew > 0) && (
            <div className="mt-6 flex items-start gap-2 text-[11.5px] text-ink-3">
              <Icon name="info" size={15} className="mt-px shrink-0" />
              <span>
                Not checked yet: {num(unmatched)} with a tile that can&apos;t be found in SAP
                {tooNew > 0 ? `, ${num(tooNew)} put up this month` : ""}.
              </span>
            </div>
          )}
        </Section>

        <Section className="lg:col-span-2" title="Before and after display" note="Average monthly purchase of the displayed tile, per display.">
          {hasBA ? (
            <>
              <div className="flex items-end justify-center gap-10 h-[168px] px-4">
                {[
                  { label: "Month before", v: before, color: "var(--neutral-mark)" },
                  { label: "3 months after", v: afterAvg, color: "var(--series-1)" },
                ].map((b, i) => (
                  <div key={b.label} className="flex flex-col items-center justify-end h-full w-[104px]">
                    <div className="text-[15px] font-semibold mb-2">{inr(b.v)}</div>
                    <div
                      className="grow-y w-full rounded-t-[6px] rounded-b-[2px]"
                      style={{ height: `${Math.max(2, (Math.max(0, b.v) / baMax) * 120)}px`, background: b.color, animationDelay: `${0.2 + i * 0.15}s` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-10 px-4 mt-2.5 text-[11.5px] text-ink-2">
                <div className="w-[104px] text-center">Month before</div>
                <div className="w-[104px] text-center">3 months after</div>
              </div>
              {Number.isFinite(change) && (
                <div className="mt-5 flex justify-center">
                  <span className={`pill ${change >= 0 ? "pill-good" : "pill-bad"}`}>
                    {pct(Math.abs(change))} {change >= 0 ? "higher" : "lower"} after display
                  </span>
                </div>
              )}
              <details className="mt-5 group">
                <summary className="cursor-pointer list-none text-[12px] font-medium text-accent inline-flex items-center gap-1 [&::-webkit-details-marker]:hidden">
                  Month by month
                  <Icon name="chevron" size={14} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3">
                  <LineChart
                    ariaLabel="Average purchase per display by month relative to the display month"
                    format="inr"
                    xTitle="Months after display"
                    baselineIndex={0}
                    height={220}
                    points={ba.map((p) => ({
                      key: String(p.offset),
                      label: offsetLabel(p.offset),
                      value: p.avgValue,
                      faint: p.pairs < MIN_N,
                      tooltip: [offsetLabel(p.offset, true), `Average ${inr(p.avgValue)} · ${m2(p.avgVolume)}`, `${pct(p.withSales)} bought`, `${num(p.pairs)} displays`],
                    }))}
                  />
                </div>
              </details>
            </>
          ) : (
            <div className="text-[14px] text-ink-3 py-10 text-center">Not enough history for this selection yet.</div>
          )}
        </Section>
      </div>

      <GroupTitle title="Month by month" note="By the month the display was put up · recent months have had less time to sell" />
      <Section title="Displays and what happened to them">
        <StackedBarChart
          ariaLabel="Displays put up each month, split into bought, not bought yet, and not checked yet"
          parts={[
            { key: "bought", label: "Dealer bought the tile", color: "var(--series-1)" },
            { key: "not", label: "Not bought yet", color: "var(--neutral-mark)" },
            { key: "na", label: "Not checked yet", color: "var(--neutral-faint)" },
          ]}
          bars={months.map(([m, s]) => ({
            key: m,
            label: short(m),
            values: [s.bought, s.judged - s.bought, s.all - s.judged],
            tooltip: [
              monthName(m),
              `${num(s.all)} displays`,
              s.judged ? `${num(s.bought)} bought · ${pct(s.bought / s.judged)} of those checked` : "Too new to check",
            ],
          }))}
        />
      </Section>

      <details className="group px-1 py-2 text-[12px]">
        <summary className="cursor-pointer list-none text-ink-3 flex items-center gap-1.5 [&::-webkit-details-marker]:hidden">
          <Icon name="chevron" size={13} className="-rotate-90 transition-transform group-open:rotate-0" />
          How these numbers are calculated
        </summary>
        <ul className="mt-3 space-y-1.5 text-ink-2 leading-relaxed list-disc pl-5">
          <li>A display is one dealer, one tile and one month in the RMI app. Repeats count once.</li>
          <li>Sales are SAP invoices from that dealer for that tile, less returns and credit notes, before GST.</li>
          <li>A dealer&apos;s other SAP accounts (same GST number and PIN code) count as the same dealer.</li>
          <li>
            A tile keeps its design but gets a new SAP code when NITCO changes the box (for example 2 tiles a box, …02160, became 3 tiles a box, …03021).
            Purchases under any of these codes count as the same tile.
          </li>
          <li>“Bought” means any purchase in the 12 months after the display month, as far as data exists.</li>
        </ul>
      </details>
    </>
  );
}
