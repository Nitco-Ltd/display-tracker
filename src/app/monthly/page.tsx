import { Suspense } from "react";
import Link from "next/link";
import { desc, lte } from "drizzle-orm";
import { FilterBar } from "@/components/FilterBar";
import { Kpi, Section } from "@/components/Kpi";
import { filterOptions, type SearchParams } from "@/analytics/data";
import { currentMonth } from "@/analytics/metrics";
import { requireViewer } from "@/auth/viewer";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { salesFunnel, type FunnelFilter } from "@/sales/funnel";
import { addMonths } from "@/sales/window";
import { inr, inrCompact, monthName, num, pct } from "@/lib/format";

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

function StepBar({ n, label, help, value, of, strong }: { n: number; label: string; help: string; value: number; of: number; strong?: boolean }) {
  const share = of > 0 ? Math.max(0, value / of) : 0;
  return (
    <div className="grid grid-cols-[28px_1fr] gap-x-3 py-2.5 border-b border-line last:border-0">
      <div className="h-7 w-7 rounded-full bg-surface-0 border border-line text-[13px] font-semibold flex items-center justify-center">{n}</div>
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <div className="text-[14px] font-medium">{label}</div>
          <div className={`ml-auto text-[18px] tracking-tight ${strong ? "font-semibold" : "font-medium"}`}>{inrCompact(value)}</div>
          {n > 1 && <div className="text-[12px] text-ink-3 w-[70px] text-right">{pct(share)}</div>}
        </div>
        <div className="mt-1.5 h-2.5 rounded-full bg-surface-0 overflow-hidden" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, share * 100)}%`, background: "var(--series-1)" }} />
        </div>
        <div className="text-[12px] text-ink-3 mt-1">{help}</div>
      </div>
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
          {month === cur ? " (month so far)" : ""}. <b>{inrCompact(r.displayedDesigns)}</b> of that ({pct(r.total ? r.displayedDesigns / r.total : NaN)}) was a dealer buying a tile
          it has on display.
          {includeExtra ? " Includes ZTDN, ZNTI and ZDMS invoices." : ""}
        </p>
      </div>

      <Section
        title={`Where ${monthName(month)}'s sales went`}
        note="Each step is part of the one above it. Sales are SAP invoices for tiles (net of returns and credit notes), the same as the Sales data MIS."
      >
        <StepBar n={1} label="All tile sales" help="Everything NITCO invoiced in this month to customers in this area." value={r.total} of={r.total} strong />
        <StepBar
          n={2}
          label="…to dealers who have an RMI display"
          help={`${num(r.displayDealerCount)} dealers with at least one display put up by ${monthName(month)}. The rest went to dealers without any display.`}
          value={r.displayDealers}
          of={r.total}
        />
        <StepBar
          n={3}
          label="…of tiles that dealer has on display"
          help="The same dealer buying a design that is on display at its shop (displays put up by this month, any earlier month)."
          value={r.displayedDesigns}
          of={r.total}
          strong
        />
      </Section>

      <Section
        title={`Displays put up in ${monthName(month)}`}
        note={
          <>
            This is what the {monthName(month)} Display Tracker report covers. Its other columns ({monthName(addMonths(month, -1))}, and the months after{" "}
            {monthName(month)}) show the same dealers and tiles in other months.
          </>
        }
        action={
          <div className="flex gap-2">
            <Link href={displaysHref} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] border border-line">
              See these displays
            </Link>
            <Link href={reportHref} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium bg-accent text-white">
              Download report
            </Link>
          </div>
        }
      >
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Kpi label="Displays put up" value={num(r.monthDisplays)} />
          <Kpi label="Dealers" value={num(r.monthDealerCount)} />
          <Kpi label="4 · Everything these dealers bought" value={inrCompact(r.monthDealers)} sub={`in ${monthName(month)}, all tiles`} />
          <Kpi
            label="5 · …of the tiles displayed this month"
            value={inrCompact(r.monthDesigns)}
            sub={r.monthDealers ? `${pct(r.monthDesigns / r.monthDealers)} of what they bought` : undefined}
          />
        </div>
      </Section>

      <Section title="By region" note="Same steps, split by the customer's region in SAP (sales office).">
        <div className="overflow-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Region</th>
                <th className="num">1 · All tile sales</th>
                <th className="num">2 · To display dealers</th>
                <th className="num">3 · Displayed tiles</th>
                <th className="num">3 as % of 1</th>
                <th className="num">Displays put up</th>
                <th className="num">5 · Bought of those</th>
              </tr>
            </thead>
            <tbody>
              {r.byRegion.map((x) => (
                <tr key={`${x.zone}|${x.region}`}>
                  <td>{x.zone}</td>
                  <td>{x.region}</td>
                  <td className="num">{inr(x.total)}</td>
                  <td className="num">{inr(x.displayDealers)}</td>
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
      </Section>
    </>
  );
}
