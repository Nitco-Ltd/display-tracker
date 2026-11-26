"use client";
// Filters, kept in the URL so every page and the Excel export see the same selection.
// One row of main filters, the rest behind "More filters", a switch for which invoice types count as sales,
// and chips for the active filters (click × to remove one).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { MultiSelect } from "./MultiSelect";
import type { FilterOptions } from "@/analytics/data";
import { monthName } from "@/lib/format";


const PRIMARY = ["month", "zone", "region", "rmi", "dealer"];

export function FilterBar({
  options,
  fields: only,
  labels = {},
  singles = [],
  showSales = true,
}: {
  options: FilterOptions;
  fields?: string[]; // show only these URL params (default: all)
  labels?: Record<string, string>; // relabel a field, e.g. { month: "Sales month" }
  singles?: string[]; // single-choice fields
  showSales?: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const get = (p: string) => sp.getAll(p);

  const go = (next: URLSearchParams) => {
    next.delete("page");
    start(() => router.push(`${path}?${next.toString()}`, { scroll: false }));
  };
  const set = (p: string, vals: string[]) => {
    const next = new URLSearchParams(sp.toString());
    next.delete(p);
    for (const v of vals) next.append(p, v);
    go(next);
  };
  const removeOne = (p: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    const keep = next.getAll(p).filter((x) => x !== v);
    next.delete(p);
    for (const x of keep) next.append(p, x);
    go(next);
  };
  const o = (vals: string[]) => vals.map((v) => ({ value: v, label: v }));

  const all: [string, string, { value: string; label: string }[]][] = [
    ["month", "Display month", options.months.map((m) => ({ value: m, label: monthName(m) }))],
    ["zone", "Zone", o(options.zones)],
    ["region", "Region", o(options.regions)],
    ["rmi", "RMI", o(options.rmis)],
    ["dealer", "Dealer", options.dealers.map((d) => ({ value: d.code, label: d.name }))],
    ["dtype", "Dealer type", o(options.dtypes)],
    ["ptype", "Product type", o(options.ptypes)],
    ["size", "Size (mm)", o(options.sizes)],
    ["design", "Design", o(options.designs)],
    ["dstatus", "Design status", o(options.dstatuses)],
    ["where", "Displayed where", o(options.wheres)],
  ];
  const fields = all.filter(([p]) => !only || only.includes(p));
  const primary = fields.filter(([p]) => PRIMARY.includes(p));
  const more = fields.filter(([p]) => !PRIMARY.includes(p));
  const moreActive = more.filter(([p]) => get(p).length).length;
  const [open, setOpen] = useState(moreActive > 0);
  const incl = get("sales").includes("incl");
  const retail = get("scope").includes("retail");
  const noPd = get("pd").includes("without");

  const chips = fields.flatMap(([p, label, opts]) =>
    get(p).map((v) => ({ p, v, text: `${labels[p] ?? label}: ${opts.find((x) => x.value === v)?.label ?? v}` })),
  );
  const field = ([p, label, opts]: (typeof all)[number]) => (
    <MultiSelect key={p} label={labels[p] ?? label} single={singles.includes(p)} options={opts} selected={get(p)} onChange={(v) => set(p, v)} />
  );

  return (
    <div className={`card relative z-20 p-2.5 mb-5 transition-opacity duration-200 ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 items-end">
        {primary.map(field)}
        <div className="flex gap-2 items-end">
          {(more.length > 0 || showSales) && (
            <button onClick={() => setOpen((x) => !x)} className="btn btn-ghost h-[42px] flex-1 !rounded-[8px] !text-[12px]" aria-expanded={open}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 6h18M7 12h10M10 18h4" />
              </svg>
              {open ? "Fewer filters" : `More filters${moreActive + (incl ? 1 : 0) ? ` (${moreActive + (incl ? 1 : 0)})` : ""}`}
            </button>
          )}
        </div>
      </div>
      {open && more.length > 0 && <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mt-2">{more.map(field)}</div>}
      <div className={`flex flex-wrap items-center gap-2 ${showSales || chips.length || pending ? "mt-3 px-1" : ""}`}>
        {showSales && (
          <div className="seg" role="group" aria-label="Which customers count">
            {[
              ["", "Total", "Every customer: retail, key accounts and export"],
              ["retail", "Retail", "Leaves out Key Accounts (SAP Customer Group 2) and export (sales org 1802)"],
            ].map(([v, l, tip]) => (
              <button key={v} onClick={() => set("scope", v ? [v] : [])} aria-pressed={retail === !!v} title={tip}>
                {l}
              </button>
            ))}
          </div>
        )}
        {showSales && (
          <div className="seg" role="group" aria-label="Project dealers">
            {[
              ["", "With project dealers", "Includes sales from project-dealer storage locations (F-KA, S-KA)"],
              ["without", "Without project dealers", "Leaves out sales from project-dealer storage locations (F-KA, S-KA)"],
            ].map(([v, l, tip]) => (
              <button key={v} onClick={() => set("pd", v ? [v] : [])} aria-pressed={noPd === !!v} title={tip}>
                {l}
              </button>
            ))}
          </div>
        )}
        {showSales && (open || incl) && (
          <div className="seg" role="group" aria-label="Which invoices count as sales">
            {[
              ["", "Standard sales"],
              ["incl", "Include debit notes & samples"],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => set("sales", v ? [v] : [])}
                aria-pressed={incl === !!v}
                title={v ? "Also count debit notes (ZTDN), ZNTI and samples (ZDMS)" : "SAP invoices minus returns and credit notes, as in the Sales data MIS"}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        {chips.map((c) => (
          <button
            key={`${c.p}|${c.v}`}
            onClick={() => removeOne(c.p, c.v)}
            className="chip"
            title="Remove this filter"
          >
            {c.text} <span aria-hidden>×</span>
          </button>
        ))}
        {chips.length > 0 && (
          <button onClick={() => start(() => router.push(path))} className="text-[12px] font-medium text-accent ml-1 hover:underline">
            Clear all
          </button>
        )}
        {pending && <span className="text-[12px] text-ink-3 ml-auto">Updating…</span>}
      </div>
    </div>
  );
}
