import { Suspense } from "react";
import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { GroupTitle, Section } from "@/components/Section";
import { Hero } from "@/components/Hero";
import { Icon } from "@/components/Icon";
import { SplitBar } from "@/components/SplitBar";
import { Tabs } from "@/components/Tabs";
import { filterOptions, type SearchParams } from "@/analytics/data";
import { currentMonth } from "@/analytics/metrics";
import { requireViewer } from "@/auth/viewer";
import { ensureSchema } from "@/db/migrate";
import { salesFunnel, salesMonths as loadSalesMonths, type FunnelFilter } from "@/sales/funnel";
import { paramList as list, toQuery } from "@/lib/params";
import { inr, inrCompact, monthName, num, pct } from "@/lib/format";


// Colours match the split bar: tiles on display = series 1, other tiles = series 2, no display = series 3; totals grey.
const COLOR = { onDisplay: "var(--series-1)", otherTiles: "var(--series-2)", noDisplay: "var(--series-3)", total: "var(--axis)" };

/** One row of the breakdown tree: name, plain description, value, share of all sales, and a bar. */
function TreeRow({
  label,
  help,
  value,
  total,
  level,
  bold,
  color,
  last,
}: {
  label: string;
  help?: string;
  value: number;
  total: number;
  level: 0 | 1 | 2 | 3;
  bold?: boolean;
  color: string;
  last?: boolean; // last row of its branch (└ instead of ├)
}) {
  const share = total > 0 ? Math.max(0, value / total) : 0;
  return (
    <tr className={bold ? "font-semibold" : undefined}>
      <td style={{ whiteSpace: "normal" }}>
        <div className="flex items-start gap-2" style={{ paddingLeft: `${level * 20}px` }}>
          {level > 0 && <span className="text-ink-3 font-normal" aria-hidden>{last ? "└" : "├"}</span>}
          <div>
            <div className="text-[13px]">{label}</div>
            {help && <div className="text-[11.5px] text-ink-3 font-normal">{help}</div>}
          </div>
        </div>
      </td>
      <td className="num text-[13px] whitespace-nowrap">{inr(value)}</td>
      <td className="num whitespace-nowrap">{pct(total ? value / total : NaN)}</td>
      <td className="hidden md:table-cell w-[30%] min-w-[90px]">
        <div className="h-[5px] rounded-full bg-[var(--surface-3)] overflow-hidden" aria-hidden>
          <div className="grow-x h-full rounded-full" style={{ width: `${Math.min(100, share * 100)}%`, background: color }} />
        </div>
      </td>
    </tr>
  );
}

export default async function Monthly({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  await ensureSchema();
  const viewer = await requireViewer();
  const cur = currentMonth();
  const salesMonths = await loadSalesMonths(cur);
  const month = list(sp.month)[0] ?? salesMonths.find((m) => m < cur) ?? cur;
  const includeExtra = list(sp.sales).includes("incl");

  const f: FunnelFilter = { zones: list(sp.zone), regions: list(sp.region), dealerCodes: list(sp.dealer), rmiNames: list(sp.rmi) };
  if (viewer.role === "zonal") f.zones = [viewer.zone!];
  if (viewer.role === "rmi") f.rmiNames = [viewer.rmiName!];

  const [r, options] = await Promise.all([salesFunnel(month, f, { includeExtra }), filterOptions()]);
  const where = [...(f.regions ?? []), ...(f.regions?.length ? [] : (f.zones ?? []))].join(", ") || "all regions";
  const who = f.rmiNames?.length ? ` · ${f.rmiNames.join(", ")}'s dealers` : f.dealerCodes?.length ? " · selected dealers" : "";
  const reportHref = `/download?month=${month}`;
  const displaysHref = `/displays?${toQuery({ zone: f.zones, region: f.regions, rmi: f.rmiNames, dealer: f.dealerCodes }, { set: { month } })}`;

  const pctA = (v: number) => (r.total ? v / r.total : NaN);
  const noDisplay = r.total - r.displayDealers;
  const otherTiles = r.displayDealers - r.displayedDesigns;

  const regionTable = (
    <div className="overflow-auto max-h-[480px]">
      <table className="data">
        <thead>
          <tr>
            <th>Zone · Region</th>
            <th className="num">All sales</th>
            <th className="num">No display</th>
            <th className="num">Other tiles</th>
            <th className="num">Tiles on display</th>
            <th className="num">% on display</th>
            <th className="num">New displays</th>
            <th className="num">New tiles bought</th>
          </tr>
        </thead>
        <tbody>
          {r.byRegion.map((x) => (
            <tr key={`${x.zone}|${x.region}`}>
              <td>
                {x.zone} · <b>{x.region}</b>
              </td>
              <td className="num">{inr(x.total)}</td>
              <td className="num">{inr(x.total - x.displayDealers)}</td>
              <td className="num">{inr(x.displayDealers - x.displayedDesigns)}</td>
              <td className="num">{inr(x.displayedDesigns)}</td>
              <td className="num">{pct(x.total ? x.displayedDesigns / x.total : NaN)}</td>
              <td className="num">{num(x.monthDisplays)}</td>
              <td className="num">{inr(x.monthDesigns)}</td>
            </tr>
          ))}
          {!r.byRegion.length && (
            <tr>
              <td colSpan={8} className="text-ink-3">
                No sales for this selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
  const tileTable = (tiles: typeof r.tilesOnDisplay) => (
    <div className="overflow-auto max-h-[420px]">
      <table className="data">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Tile</th>
            <th>Size</th>
            <th className="num">Sales</th>
            <th className="num">Dealers who bought it</th>
          </tr>
        </thead>
        <tbody>
          {tiles.map((x, i) => (
            <tr key={`${x.design}|${x.size}`}>
              <td className="num text-ink-3">{i + 1}</td>
              <td>{x.design}</td>
              <td>{x.size}</td>
              <td className="num">{inr(x.value)}</td>
              <td className="num">{num(x.dealers)}</td>
            </tr>
          ))}
          {!tiles.length && (
            <tr>
              <td colSpan={5} className="text-ink-3">
                None.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Suspense>
        <FilterBar
          options={{ ...options, months: salesMonths }}
          fields={["month", "zone", "region", "rmi", "dealer"]}
          labels={{ month: "Sales month" }}
          singles={["month"]}
        />
      </Suspense>

      <Hero
        eyebrow={`Monthly sales · ${monthName(month)} · ${where}${who}`}
        badge={month === cur ? <span className="pill pill-warn">Month in progress</span> : undefined}
        title={`${inrCompact(r.total)} of tiles sold in ${monthName(month)}${month === cur ? " so far" : ""}.`}
        share={r.total ? r.displayedDesigns / r.total : undefined}
        shareCaption="of it was a tile on display"
        stats={[
          { label: "All sales", value: inrCompact(r.total), sub: includeExtra ? "incl. debit notes & samples" : "all tiles, all dealers" },
          { label: "Dealers with a display", value: inrCompact(r.displayDealers), sub: `${pct(pctA(r.displayDealers))} of sales · ${num(r.displayDealerCount)} dealers` },
          { label: "Tiles on display", value: inrCompact(r.displayedDesigns), sub: `${pct(pctA(r.displayedDesigns))} of sales` },
          { label: "New displays", value: num(r.monthDisplays), sub: `at ${num(r.monthDealerCount)} dealer${r.monthDealerCount === 1 ? "" : "s"}` },
        ]}
      >
        {r.total ? (
          <>
            <b className="text-[var(--hero-text)] font-semibold">{inrCompact(r.displayedDesigns)}</b> of it was dealers buying a tile that is on display in
            their own shop.
          </>
        ) : null}
      </Hero>

      <GroupTitle title="Where the sales came from" note={`“On display” means the RMI recorded that tile at that dealer in ${monthName(month)} or earlier`} />
      <Section title="All sales, split three ways">
        <SplitBar
          ariaLabel="All sales split into tiles on display, other tiles, and dealers without a display"
          total={r.total}
          parts={[
            { code: "", label: "Tiles on display", value: r.displayedDesigns },
            { code: "", label: "Other tiles, same dealers", value: otherTiles },
            { code: "", label: "Dealers without a display", value: noDisplay },
          ]}
        />
        <div className="mt-6 overflow-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Breakdown</th>
                <th className="num">Amount</th>
                <th className="num">% of all sales</th>
                <th aria-label="share" className="hidden md:table-cell" />
              </tr>
            </thead>
            <tbody>
              <TreeRow level={0} bold color={COLOR.total} label="All sales" value={r.total} total={r.total} />
              <TreeRow level={1} color={COLOR.noDisplay} label="Dealers without a display" value={noDisplay} total={r.total} />
              <TreeRow
                level={1}
                bold
                color={COLOR.total}
                last
                label="Dealers with a display"
                help={`${num(r.displayDealerCount)} dealers`}
                value={r.displayDealers}
                total={r.total}
              />
              <TreeRow level={2} color={COLOR.otherTiles} label="Other tiles" value={otherTiles} total={r.total} />
              <TreeRow
                level={2}
                bold
                color={COLOR.onDisplay}
                last
                label="Tiles on display"
                help="on display in the dealer's own shop"
                value={r.displayedDesigns}
                total={r.total}
              />
              <TreeRow
                level={3}
                color={COLOR.onDisplay}
                last
                label={`of which: put on display in ${monthName(month)}`}
                help={`${num(r.monthDisplays)} new display${r.monthDisplays === 1 ? "" : "s"}`}
                value={r.monthDesigns}
                total={r.total}
              />
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[8px] border border-line bg-surface-2 px-4 py-3">
          <span className="h-8 w-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ color: "var(--series-2)", background: "color-mix(in srgb, var(--series-2) 12%, transparent)" }}>
            <Icon name="sparkle" size={17} />
          </span>
          <div className="flex-1 min-w-[240px] text-[12.5px]">
            <b>New this month:</b> {num(r.monthDisplays)} display{r.monthDisplays === 1 ? "" : "s"} at {num(r.monthDealerCount)} dealer
            {r.monthDealerCount === 1 ? "" : "s"}, who bought <b>{inr(r.monthDesigns)}</b> of those tiles.
          </div>
          <Link href={displaysHref} className="btn">
            View displays
          </Link>
          <Link href={reportHref} className="btn btn-primary">
            <Icon name="download" size={16} />
            Report
          </Link>
        </div>
      </Section>

      <GroupTitle title="Details" />
      <Section title="By region and by tile">
        <Tabs
          tabs={[
            { id: "regions", label: "By region" },
            { id: "on", label: "Top tiles on display", hint: "Top 25 tiles bought by dealers who display them." },
            { id: "other", label: "Top other tiles", hint: "Top 25 tiles bought by dealers with a display, where that tile isn't on display in their shop." },
          ]}
        >
          {regionTable}
          {tileTable(r.tilesOnDisplay)}
          {tileTable(r.tilesNotOnDisplay)}
        </Tabs>
      </Section>
    </>
  );
}
