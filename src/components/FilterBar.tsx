"use client";
// Filters, kept in the URL so every page and the Excel export see the same selection.
// One row of main filters, the rest behind "More filters", a switch for which invoice types count as sales,
// and chips for the active filters (click × to remove one).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { MultiSelect } from "./MultiSelect";
import type { FilterOptions } from "@/analytics/data";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}

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
    ["month", "Display month", options.months.map((m) => ({ value: m, label: monthLabel(m) }))],
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

  const chips = fields.flatMap(([p, label, opts]) =>
    get(p).map((v) => ({ p, v, text: `${labels[p] ?? label}: ${opts.find((x) => x.value === v)?.label ?? v}` })),
  );
  const field = ([p, label, opts]: (typeof all)[number]) => (
    <MultiSelect key={p} label={labels[p] ?? label} single={singles.includes(p)} options={opts} selected={get(p)} onChange={(v) => set(p, v)} />
  );

  return (
    <div className={`card p-3 mb-4 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 items-end">
        {primary.map(field)}
        <div className="flex gap-2 items-end">
          {more.length > 0 && (
            <button
              onClick={() => setOpen((x) => !x)}
              className="h-[46px] flex-1 rounded-md border border-line px-3 text-[13px] text-ink-2 hover:bg-surface-0 whitespace-nowrap"
              aria-expanded={open}
            >
              {open ? "Fewer filters" : `More filters${moreActive ? ` (${moreActive})` : ""}`}
            </button>
          )}
        </div>
      </div>
      {open && more.length > 0 && <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mt-2">{more.map(field)}</div>}
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        {showSales && (
          <div className="inline-flex rounded-md border border-line overflow-hidden text-[12px]" role="group" aria-label="Which invoices count as sales">
            {[
              ["", "Standard sales"],
              ["incl", "+ ZTDN, ZNTI, ZDMS"],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => set("sales", v ? [v] : [])}
                aria-pressed={incl === !!v}
                className={`px-2.5 py-1 ${incl === !!v ? "bg-[var(--accent)] text-white" : "text-ink-2 hover:bg-surface-0"}`}
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
            className="rounded-full border border-line bg-surface-0 px-2.5 py-0.5 text-[12px] text-ink-2 hover:border-[var(--accent)]"
            title="Remove this filter"
          >
            {c.text} <span aria-hidden>×</span>
          </button>
        ))}
        {chips.length > 0 && (
          <button onClick={() => start(() => router.push(path))} className="text-[12px] text-accent ml-1">
            Clear all
          </button>
        )}
        {pending && <span className="text-[12px] text-ink-3 ml-auto">Updating…</span>}
      </div>
    </div>
  );
}
