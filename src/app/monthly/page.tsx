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
import { addMonths } from "@/sales/window";
import { inr, inrCompact, monthName, num, pct } from "@/lib/format";

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

/** One row of a breakdown tree: code (A, B, B1…), name, plain description, value, share of the top line, and a bar. */
// Same colours as the split bars: B2/D2 = series 1, B1/D1 = series 2, C = series 3; totals (A, B, D) in neutral grey.
const CODE_COLOR: Record<string, string> = { B2: "var(--series-1)", D2: "var(--series-1)", B1: "var(--series-2)", D1: "var(--series-2)", C: "var(--series-3)" };

function TreeRow({ code, label, help, value, total, level, bold }: { code: string; label: string; help: string; value: number; total: number; level: 0 | 1 | 2; bold?: boolean }) {
  const share = total > 0 ? Math.max(0, value / total) : 0;
  return (
    <tr className={bold ? "font-semibold" : undefined}>
      <td style={{ whiteSpace: "normal" }}>
        <div className="flex items-start gap-2" style={{ paddingLeft: `${level * 16}px` }}>
          <span className="shrink-0 min-w-[26px] rounded border border-line bg-surface-0 px-1 text-center text-[12px] font-semibold">{code}</span>
          <div>
            <div className="text-[14px]">{label}</div>
            <div className="text-[12px] text-ink-3 font-normal">{help}</div>
          </div>
        </div>
      </td>
      <td className="num text-[15px] whitespace-nowrap">{inr(value)}</td>
      <td className="num whitespace-nowrap">{pct(total ? value / total : NaN)}</td>
      <td className="hidden lg:table-cell w-[28%] min-w-[90px]">
        <div className="h-2.5 rounded-full bg-surface-0 overflow-hidden" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, share * 100)}%`, background: CODE_COLOR[code] ?? "var(--axis)" }} />
        </div>
      </td>
    </tr>
  );
}

function TreeTable({ children, pctOf }: { children: React.ReactNode; pctOf: string }) {
  return (
    <div className="overflow-auto">
      <table className="data">
        <thead>
          <tr>
            <th>Part</th>
            <th className="num">Sales</th>
            <th className="num">% of {pctOf}</th>
            <th aria-label="share" className="hidden lg:table-cell" />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
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
  const regionTable = (
    <div className="overflow-auto">
      <table className="data">
        <thead>
          <tr>
            <th>Zone · Region</th>
            <th className="num">A · Total</th>
            <th className="num">B · With a display</th>
            <th className="num">B1 · Tiles not on display</th>
            <th className="num">B2 · Tiles on display</th>
            <th className="num">C · Without a display</th>
            <th className="num">B2 as % of A</th>
            <th className="num">Displays put up</th>
            <th className="num">D2 · Report column</th>
          </tr>
        </thead>
        <tbody>
          {r.byRegion.map((x) => (
            <tr key={`${x.zone}|${x.region}`}>
              <td>
                {x.zone} · <b>{x.region}</b>
              </td>
              <td className="num">{inr(x.total)}</td>
              <td className="num">{inr(x.displayDealers)}</td>
              <td className="num">{inr(x.displayDealers - x.displayedDesigns)}</td>
              <td className="num">{inr(x.displayedDesigns)}</td>
              <td className="num">{inr(x.total - x.displayDealers)}</td>
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
            All tile sales made in the chosen month (the same figures as the Sales data MIS), and how much of it went to dealers who have a display, and to the tiles on
            their display. Pick the <b>sales month</b> below; the rest of the dashboard filters by the month a display was put up.
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
        {month === cur ? " (month so far)" : ""}. <b>{pct(pctA(r.displayDealers))}</b> of it went to dealers who have a display, and{" "}
        <b>{inrCompact(r.displayedDesigns)}</b> ({pct(pctA(r.displayedDesigns))}) was those dealers buying a tile that is on display at their shop.
        {includeExtra ? " Includes ZTDN, ZNTI and ZDMS invoices." : ""}
      </Insight>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title={`A · All ${monthName(month)} sales, split three ways`}
          note={<>B1 + B2 + C = A. “On display” = a display put up at that dealer in {monthName(month)} or earlier (from the RMI app).</>}
        >
          <SplitBar
            ariaLabel="Total sales split into tiles on display, tiles not on display, and dealers without a display"
            total={r.total}
            parts={[
              { code: "B2", label: "Dealers with a display, with tiles on display", value: r.displayedDesigns },
              { code: "B1", label: "Dealers with a display, with tiles not on display", value: r.displayDealers - r.displayedDesigns },
              { code: "C", label: "Dealers without a display", value: r.total - r.displayDealers },
            ]}
          />
          <div className="mt-3">
            <TreeTable pctOf="A">
              <TreeRow code="A" level={0} bold label="Total sales" help="Every tile sold in this area this month, to every dealer." value={r.total} total={r.total} />
              <TreeRow
                code="B"
                level={1}
                bold
                label="Sales to dealers with a display"
                help={`Everything bought by the ${num(r.displayDealerCount)} dealers who have a display.`}
                value={r.displayDealers}
                total={r.total}
              />
              <TreeRow code="B1" level={2} label="…with tiles not on display" help="Tiles not on display at the dealer's own shop." value={r.displayDealers - r.displayedDesigns} total={r.total} />
              <TreeRow code="B2" level={2} label="…with tiles on display" help="Tiles on display at the dealer's own shop." value={r.displayedDesigns} total={r.total} />
              <TreeRow code="C" level={1} bold label="Sales to dealers without a display" help="Dealers with no display in the RMI app." value={r.total - r.displayDealers} total={r.total} />
            </TreeTable>
          </div>
        </Section>

        <Section
          title={`D · Display Tracker Report: displays put up in ${monthName(month)}`}
          note={
            <>
              {num(r.monthDisplays)} displays at {num(r.monthDealerCount)} dealers. D2 is the {monthName(month)} column of the {monthName(month)} Display Tracker Report;
              its other columns ({monthName(addMonths(month, -1))} and the months after) show the same dealers and tiles in other months.
            </>
          }
          action={
            <div className="flex gap-2">
              <Link href={displaysHref} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] border border-line">
                See displays
              </Link>
              <Link href={reportHref} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium bg-accent text-white">
                Download report
              </Link>
            </div>
          }
        >
          <SplitBar
            ariaLabel="Sales to dealers who got a display this month, split by tiles displayed this month"
            total={r.monthDealers}
            parts={[
              { code: "D2", label: "Tiles put on display this month", value: r.monthDesigns },
              { code: "D1", label: "Other tiles", value: r.monthDealers - r.monthDesigns },
            ]}
          />
          <div className="mt-3">
            <TreeTable pctOf="D">
              <TreeRow
                code="D"
                level={0}
                bold
                label="Sales to the dealers who got a display this month"
                help="Everything these dealers bought this month."
                value={r.monthDealers}
                total={r.monthDealers}
              />
              <TreeRow code="D1" level={1} label="…with tiles not put on display this month" help="Other tiles these dealers bought." value={r.monthDealers - r.monthDesigns} total={r.monthDealers} />
              <TreeRow code="D2" level={1} bold label="…with tiles put on display this month" help="= the Display Tracker Report's column for this month." value={r.monthDesigns} total={r.monthDealers} />
            </TreeTable>
          </div>
        </Section>
      </div>

      <Section title="Details">
        <Tabs
          tabs={[
            { id: "regions", label: "By region", hint: "The same parts, split by the customer's region in SAP (sales office)." },
            { id: "b2", label: `B2 · Tiles on display (${inrCompact(r.displayedDesigns)})`, hint: "Top 25 tiles bought by a dealer who has that tile on display at its shop." },
            {
              id: "b1",
              label: `B1 · Tiles not on display (${inrCompact(r.displayDealers - r.displayedDesigns)})`,
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
