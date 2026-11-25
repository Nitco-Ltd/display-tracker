import { Suspense } from "react";
import Link from "next/link";
import { desc, lte } from "drizzle-orm";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { Insight, PageHeader } from "@/components/PageHeader";
import { SplitBar } from "@/components/SplitBar";
import { Tabs } from "@/components/Tabs";
import { filterOptions, type SearchParams } from "@/analytics/data";
import { currentMonth } from "@/analytics/metrics";
import { requireViewer } from "@/auth/viewer";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { cached } from "@/lib/datacache";
import { salesFunnel, type FunnelFilter } from "@/sales/funnel";
import { inr, inrCompact, monthName, num, pct } from "@/lib/format";

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

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
  help: string;
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
            <div className="text-[14px]">{label}</div>
            <div className="text-[12px] text-ink-3 font-normal">{help}</div>
          </div>
        </div>
      </td>
      <td className="num text-[15px] whitespace-nowrap">{inr(value)}</td>
      <td className="num whitespace-nowrap">{pct(total ? value / total : NaN)}</td>
      <td className="hidden md:table-cell w-[30%] min-w-[90px]">
        <div className="h-2.5 rounded-full bg-surface-0 overflow-hidden" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, share * 100)}%`, background: color }} />
        </div>
      </td>
    </tr>
  );
}

export default async function Monthly({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  await ensureSchema();
  const viewer = await requireViewer();
  const t = tables();
  const cur = currentMonth();
  const salesMonths = await cached(`salesMonths|${cur}`, async () =>
    (
      await getDb().selectDistinct({ m: t.sapCustomerMonthly.month }).from(t.sapCustomerMonthly).where(lte(t.sapCustomerMonthly.month, cur)).orderBy(desc(t.sapCustomerMonthly.month))
    ).map((r) => r.m),
  );
  const month = list(sp.month)[0] ?? salesMonths.find((m) => m < cur) ?? cur;
  const includeExtra = list(sp.sales).includes("incl");

  const f: FunnelFilter = { zones: list(sp.zone), regions: list(sp.region), dealerCodes: list(sp.dealer), rmiNames: list(sp.rmi) };
  if (viewer.role === "zonal") f.zones = [viewer.zone!];
  if (viewer.role === "rmi") f.rmiNames = [viewer.rmiName!];

  const [r, options] = await Promise.all([salesFunnel(month, f, { includeExtra }), filterOptions()]);
  const where = [...(f.regions ?? []), ...(f.regions?.length ? [] : (f.zones ?? []))].join(", ") || "all regions";
  const who = f.rmiNames?.length ? ` · ${f.rmiNames.join(", ")}'s dealers` : f.dealerCodes?.length ? " · selected dealers" : "";
  const keep = new URLSearchParams();
  for (const [k, v] of [["zone", f.zones], ["region", f.regions], ["rmi", f.rmiNames], ["dealer", f.dealerCodes]] as const) for (const x of v ?? []) keep.append(k, x);
  const reportHref = `/download?month=${month}`;
  const displaysHref = `/displays?month=${month}&${keep.toString()}`;

  const pctA = (v: number) => (r.total ? v / r.total : NaN);
  const noDisplay = r.total - r.displayDealers;
  const otherTiles = r.displayDealers - r.displayedDesigns;

  const regionTable = (
    <div className="overflow-auto">
      <table className="data">
        <thead>
          <tr>
            <th>Zone · Region</th>
            <th className="num">All sales</th>
            <th className="num">Dealers without a display</th>
            <th className="num">Dealers with a display</th>
            <th className="num">…other tiles</th>
            <th className="num">…tiles on display</th>
            <th className="num">Tiles on display, % of all</th>
            <th className="num">New displays</th>
            <th className="num">Bought of the new tiles</th>
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
              <td className="num">{inr(x.displayDealers)}</td>
              <td className="num">{inr(x.displayDealers - x.displayedDesigns)}</td>
              <td className="num">{inr(x.displayedDesigns)}</td>
              <td className="num">{pct(x.total ? x.displayedDesigns / x.total : NaN)}</td>
              <td className="num">{num(x.monthDisplays)}</td>
              <td className="num">{inr(x.monthDesigns)}</td>
            </tr>
          ))}
          {!r.byRegion.length && (
            <tr>
              <td colSpan={9} className="text-ink-3">
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
        <thead className="sticky top-0 bg-[var(--surface-1)]">
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
      <PageHeader
        title={`Sales in ${monthName(month)} · ${where}${who}`}
        description={
          <>
            All tile sales in the chosen month (the same figures as the Sales data MIS), split by whether the dealer has a display, and whether the tile they bought
            is on display at their shop. Pick the <b>sales month</b> below.
          </>
        }
      />
      <Suspense>
        <FilterBar
          options={{ ...options, months: salesMonths }}
          fields={["month", "zone", "region", "rmi", "dealer"]}
          labels={{ month: "Sales month" }}
          singles={["month"]}
        />
      </Suspense>

      <Insight>
        Dealers here bought <b>{inr(r.total)}</b> of tiles in {monthName(month)}
        {month === cur ? " (month so far)" : ""}. <b>{inrCompact(r.displayedDesigns)}</b> ({pct(pctA(r.displayedDesigns))}) was dealers buying a tile that is on
        display at their own shop.
        {includeExtra ? " Includes ZTDN, ZNTI and ZDMS invoices." : ""}
      </Insight>

      <Section
        title={`Where ${monthName(month)}'s sales went`}
        note={<>“On display” = the RMI recorded that tile at that dealer in {monthName(month)} or earlier.</>}
      >
        <SplitBar
          ariaLabel="All sales split into tiles on display, other tiles, and dealers without a display"
          total={r.total}
          parts={[
            { code: "", label: "Tiles on display (dealer with a display)", value: r.displayedDesigns },
            { code: "", label: "Other tiles (dealer with a display)", value: otherTiles },
            { code: "", label: "Dealers without a display", value: noDisplay },
          ]}
        />
        <div className="mt-3 overflow-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Sales</th>
                <th className="num">Amount</th>
                <th className="num">% of all sales</th>
                <th aria-label="share" className="hidden md:table-cell" />
              </tr>
            </thead>
            <tbody>
              <TreeRow level={0} bold color={COLOR.total} label="All sales" help="Every tile sold in this area this month, to every dealer." value={r.total} total={r.total} />
              <TreeRow level={1} color={COLOR.noDisplay} label="Dealers without a display" help="Dealers with no display in the RMI app." value={noDisplay} total={r.total} />
              <TreeRow
                level={1}
                bold
                color={COLOR.total}
                last
                label="Dealers with a display"
                help={`Everything bought by the ${num(r.displayDealerCount)} dealers who have a display.`}
                value={r.displayDealers}
                total={r.total}
              />
              <TreeRow level={2} color={COLOR.otherTiles} label="…other tiles" help="Tiles that are not on display at the dealer's own shop." value={otherTiles} total={r.total} />
              <TreeRow
                level={2}
                bold
                color={COLOR.onDisplay}
                last
                label="…tiles on display"
                help="Tiles that are on display at the dealer's own shop."
                value={r.displayedDesigns}
                total={r.total}
              />
              <TreeRow
                level={3}
                color={COLOR.onDisplay}
                last
                label={`of which: tiles put on display in ${monthName(month)}`}
                help={`Only the displays put up this month (${num(r.monthDisplays)} display${r.monthDisplays === 1 ? "" : "s"}). = the ${monthName(month)} column of the Display Tracker Report.`}
                value={r.monthDesigns}
                total={r.total}
              />
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-0 px-3 py-2.5">
          <div className="flex-1 min-w-[260px] text-[13px]">
            <b>New this month:</b> {num(r.monthDisplays)} display{r.monthDisplays === 1 ? "" : "s"} put up at {num(r.monthDealerCount)} dealer
            {r.monthDealerCount === 1 ? "" : "s"}. {r.monthDealerCount === 1 ? "That dealer" : "Those dealers"} bought{" "}
            <b>{inr(r.monthDesigns)}</b> of the newly displayed tiles in {monthName(month)}
            {r.monthDealers ? <> (out of {inr(r.monthDealers)} they bought in all)</> : null}. This is the {monthName(month)} column of the {monthName(month)} Display
            Tracker Report.
          </div>
          <Link href={displaysHref} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] border border-line bg-[var(--surface-1)]">
            See these displays
          </Link>
          <Link href={reportHref} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium bg-accent text-white">
            Download report
          </Link>
        </div>
      </Section>

      <Section title="Details">
        <Tabs
          tabs={[
            { id: "regions", label: "By region", hint: "The same split, by the customer's region in SAP (sales office)." },
            { id: "on", label: `Tiles on display (${inrCompact(r.displayedDesigns)})`, hint: "Top 25 tiles bought by a dealer who has that tile on display at its shop." },
            {
              id: "other",
              label: `Other tiles (${inrCompact(otherTiles)})`,
              hint: "Top 25 tiles bought by dealers with a display, where that tile is not on display at their shop (another dealer may display it).",
            },
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
