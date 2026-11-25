import { Suspense } from "react";
import Link from "next/link";
import { desc, lte } from "drizzle-orm";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { filterOptions, type SearchParams } from "@/analytics/data";
import { currentMonth } from "@/analytics/metrics";
import { requireViewer } from "@/auth/viewer";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { salesFunnel, type FunnelFilter } from "@/sales/funnel";
import { addMonths } from "@/sales/window";
import { inr, inrCompact, monthName, num, pct } from "@/lib/format";

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

/** One row of a breakdown tree: code (A, B, B1…), name, plain description, value, share of the top line, and a bar. */
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
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, share * 100)}%`, background: level === 0 ? "var(--series-1)" : "var(--series-1-soft)" }} />
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
  const salesMonths = (
    await getDb().selectDistinct({ m: t.sapCustomerMonthly.month }).from(t.sapCustomerMonthly).where(lte(t.sapCustomerMonthly.month, cur)).orderBy(desc(t.sapCustomerMonthly.month))
  ).map((r) => r.m);
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

      <div className="mb-5">
        <h1 className="text-[20px] font-semibold tracking-tight">
          {monthName(month)} · {where}
          {who}
        </h1>
        <p className="text-[14px] text-ink-2 mt-1">
          Dealers here bought <b>{inr(r.total)}</b> of tiles from NITCO in {monthName(month)}
          {month === cur ? " (month so far)" : ""}. Of that, <b>{inrCompact(r.displayedDesigns)}</b> ({pct(r.total ? r.displayedDesigns / r.total : NaN)}) was dealers buying tiles they
          have on display (B2).
          {includeExtra ? " Includes ZTDN, ZNTI and ZDMS invoices." : ""}
        </p>
      </div>

      <Section
        title={`${monthName(month)} sales, broken down`}
        note={
          <>
            B + C = A, and B1 + B2 = B. Sales are SAP tile invoices minus returns and credit notes, the same as the Sales data MIS. “On display” means a
            display put up at that dealer in {monthName(month)} or earlier.
          </>
        }
      >
        <TreeTable pctOf="A">
          <TreeRow code="A" level={0} bold label="Total sales" help="Every tile sold in this area this month, to every dealer." value={r.total} total={r.total} />
          <TreeRow
            code="B"
            level={1}
            bold
            label="Sales to dealers with a display"
            help={`Everything bought by the ${num(r.displayDealerCount)} dealers who have at least one display.`}
            value={r.displayDealers}
            total={r.total}
          />
          <TreeRow
            code="B1"
            level={2}
            label="Dealers with a display, with tiles not on display"
            help="Tiles these dealers bought that are not on display at their shop."
            value={r.displayDealers - r.displayedDesigns}
            total={r.total}
          />
          <TreeRow
            code="B2"
            level={2}
            label="Dealers with a display, with tiles on display"
            help="Tiles these dealers bought that are on display at their shop."
            value={r.displayedDesigns}
            total={r.total}
          />
          <TreeRow code="C" level={1} bold label="Sales to dealers without a display" help="Everything bought by dealers who have no RMI display." value={r.total - r.displayDealers} total={r.total} />
        </TreeTable>
      </Section>

      <Section
        title="B1 and B2: which tiles dealers with a display bought"
        note="Top 25 tiles by sales in each list. “Not on display” means not on display at the dealer who bought it (another dealer may display it)."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {(
            [
              ["B1 · Tiles not on display at the dealer's shop", r.tilesNotOnDisplay, r.displayDealers - r.displayedDesigns],
              ["B2 · Tiles on display at the dealer's shop", r.tilesOnDisplay, r.displayedDesigns],
            ] as const
          ).map(([title, tiles, total]) => (
            <div key={title} className="overflow-auto">
              <div className="text-[14px] font-medium mb-1">
                {title} · {inrCompact(total)}
              </div>
              <table className="data">
                <thead>
                  <tr>
                    <th>Tile</th>
                    <th>Size</th>
                    <th className="num">Sales</th>
                    <th className="num">Dealers</th>
                  </tr>
                </thead>
                <tbody>
                  {tiles.map((x) => (
                    <tr key={`${x.design}|${x.size}`}>
                      <td>{x.design}</td>
                      <td>{x.size}</td>
                      <td className="num">{inr(x.value)}</td>
                      <td className="num">{num(x.dealers)}</td>
                    </tr>
                  ))}
                  {!tiles.length && (
                    <tr>
                      <td colSpan={4} className="text-ink-3">
                        None.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={`Display Tracker Report · displays put up in ${monthName(month)}`}
        note={
          <>
            {num(r.monthDisplays)} displays at {num(r.monthDealerCount)} dealers. D2 is the {monthName(month)} column of the {monthName(month)} Display Tracker Report. The
            report&apos;s other columns ({monthName(addMonths(month, -1))}, and the months after {monthName(month)}) show the same dealers and tiles in other months.
          </>
        }
        action={
          <div className="flex gap-2">
            <Link href={displaysHref} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] border border-line">
              See these displays
            </Link>
            <Link href={reportHref} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium bg-accent text-white">
              Download Display Tracker Report
            </Link>
          </div>
        }
      >
        <TreeTable pctOf="D">
          <TreeRow
            code="D"
            level={0}
            bold
            label={`Sales to the dealers who got a display in ${monthName(month)}`}
            help="Everything these dealers bought this month."
            value={r.monthDealers}
            total={r.monthDealers}
          />
          <TreeRow
            code="D1"
            level={1}
            label="…with tiles not put on display this month"
            help={`Tiles that were not part of the ${monthName(month)} displays at that dealer.`}
            value={r.monthDealers - r.monthDesigns}
            total={r.monthDealers}
          />
          <TreeRow
            code="D2"
            level={1}
            bold
            label="…with tiles put on display this month"
            help={`The tiles displayed at that dealer in ${monthName(month)} (Display Tracker Report, ${monthName(month)} column).`}
            value={r.monthDesigns}
            total={r.monthDealers}
          />
        </TreeTable>
      </Section>

      <Section title="By region" note="The same parts, split by the customer's region in SAP (sales office).">
        <div className="overflow-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Region</th>
                <th className="num">A · Total sales</th>
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
                  <td>{x.zone}</td>
                  <td>{x.region}</td>
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
                  <td colSpan={10} className="text-ink-3">
                    No sales for this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
